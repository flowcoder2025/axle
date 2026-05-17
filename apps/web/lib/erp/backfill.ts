/**
 * Counterparty backfill engine (Phase 21 WI-723b).
 *
 * Links existing `Order.counterpartyId IS NULL` rows to `ErpCounterparty`
 * masters introduced in WI-721/722. The logic is split into a *chunked*,
 * *restartable* runner so it works inside Vercel's request budget (one chunk
 * per HTTP call) and as a CLI dry-run.
 *
 * Invariants enforced by the design:
 *
 *  - **Exactly one writer per org**: each chunk wraps the work in a Postgres
 *    transaction guarded by `pg_advisory_xact_lock(hashtext(orgId), hashtext('counterparty-backfill'))`.
 *    Concurrent calls return `lockBusy=true` instead of corrupting the batch.
 *  - **Restart-safe**: progress is checkpointed on `CounterpartyBackfillBatch.lastOrderId`.
 *    Restarting picks up at `id > lastOrderId` so a crash in the middle of 100k
 *    rows does not redo work or double-count statistics.
 *  - **Conservative auto-match**: an Order is auto-linked **only** when the
 *    normalized counterpartyName resolves to exactly one ErpCounterparty AND
 *    that counterparty has a non-null bizRegNo (strong evidence). Everything
 *    else is left null and surfaced via `pendingReview` for human resolution
 *    in the staging UI (R1 from the design doc — "bizRegNo 없는 row 자동 머지 금지").
 *  - **Dry-run is observable**: when `dryRun=true` no `UPDATE` runs (Orders
 *    untouched, batch counters untouched). The function still returns what it
 *    *would* have done so the CLI can emit JSON.
 *
 * Schema source of truth: `packages/db/prisma/schema.prisma`
 *   - `Order.counterpartyId String?` (WI-723a NOT VALID FK)
 *   - `Order.counterpartyName String` (snapshot, retained for history)
 *   - `ErpCounterparty (orgId, normalizedName)` index
 *   - `CounterpartyBackfillBatch.lastOrderId` checkpoint
 */

import { Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "@axle/db";
import type { PrismaClient } from "@prisma/client";
import { normalizeCounterpartyName } from "@/lib/erp/counterparty-utils";

const DEFAULT_CHUNK_SIZE = 1000;
const MAX_CHUNK_SIZE = 5000;

export interface BackfillChunkOptions {
  orgId: string;
  batchId: string;
  /** Number of Orders processed per call. Default 1000, clamped to MAX_CHUNK_SIZE. */
  chunkSize?: number;
  /** When true, no UPDATEs run (Orders + batch counters untouched). */
  dryRun?: boolean;
}

export interface BackfillChunkResult {
  /** Orders considered in this chunk. */
  processed: number;
  /** Orders auto-linked to ErpCounterparty (unique normalized match with bizRegNo). */
  matched: number;
  /** Orders left null and surfaced in the staging UI (ambiguous / unknown). */
  pendingReview: number;
  /** True when there are no more Orders to process for this org. */
  finished: boolean;
  /** Last Order.id scanned. The next chunk starts at `id > lastOrderId`. */
  lastOrderId: string | null;
  /** True when another writer holds the advisory lock for this org. */
  lockBusy: boolean;
}

export type BackfillStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface BatchSummary {
  id: string;
  orgId: string;
  status: BackfillStatus;
  totalOrders: number;
  processedOrders: number;
  matchedCount: number;
  pendingReview: number;
  lastOrderId: string | null;
  startedAt: string;
  completedAt: string | null;
  notes: string | null;
}

/** Minimal prisma surface this module needs. Tests can inject a stub. */
type PrismaLike = Pick<PrismaClient, "$transaction" | "counterpartyBackfillBatch" | "order">;

/**
 * Create a new batch or resume the most recent RUNNING/PENDING one for the org.
 * Returns `{ resumed: true }` when an unfinished batch already exists — the
 * caller should keep calling `runBackfillChunk` until `finished=true`.
 */
export async function startOrResumeBatch(
  client: PrismaLike,
  opts: { orgId: string; notes?: string | null },
): Promise<{ batchId: string; resumed: boolean }> {
  const existing = await client.counterpartyBackfillBatch.findFirst({
    where: { orgId: opts.orgId, status: { in: ["PENDING", "RUNNING"] } },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
  if (existing) {
    return { batchId: existing.id, resumed: true };
  }

  const totalOrders = await client.order.count({
    where: { orgId: opts.orgId, counterpartyId: null },
  });

  const created = await client.counterpartyBackfillBatch.create({
    data: {
      orgId: opts.orgId,
      status: "RUNNING",
      totalOrders,
      processedOrders: 0,
      matchedCount: 0,
      pendingReview: 0,
      lastOrderId: null,
      notes: opts.notes ?? null,
    },
    select: { id: true },
  });
  return { batchId: created.id, resumed: false };
}

/**
 * Process one chunk. Idempotent: callers can keep invoking until `finished=true`.
 * Concurrency-safe via `pg_try_advisory_xact_lock` keyed on (orgId, 'counterparty-backfill').
 */
export async function runBackfillChunk(
  opts: BackfillChunkOptions,
  client: PrismaLike = defaultPrisma,
): Promise<BackfillChunkResult> {
  const chunkSize = Math.max(1, Math.min(opts.chunkSize ?? DEFAULT_CHUNK_SIZE, MAX_CHUNK_SIZE));
  const dryRun = opts.dryRun === true;

  return client.$transaction(async (tx) => {
    // Per-org advisory lock — released automatically at transaction end.
    // Two int4 keys: hashtext(orgId), hashtext('counterparty-backfill').
    const lockRows = await tx.$queryRaw<Array<{ acquired: boolean }>>(Prisma.sql`
      SELECT pg_try_advisory_xact_lock(
        hashtext(${opts.orgId}),
        hashtext('counterparty-backfill')
      ) AS acquired
    `);
    const acquired = lockRows[0]?.acquired === true;
    if (!acquired) {
      return {
        processed: 0,
        matched: 0,
        pendingReview: 0,
        finished: false,
        lastOrderId: null,
        lockBusy: true,
      };
    }

    const batch = await tx.counterpartyBackfillBatch.findFirst({
      where: { id: opts.batchId, orgId: opts.orgId },
      select: {
        id: true,
        status: true,
        lastOrderId: true,
        totalOrders: true,
        processedOrders: true,
        matchedCount: true,
        pendingReview: true,
      },
    });
    if (!batch) {
      throw new Error(`backfill batch not found: ${opts.batchId}`);
    }
    if (batch.status !== "PENDING" && batch.status !== "RUNNING") {
      // Already COMPLETED/FAILED — surface as finished with no work.
      return {
        processed: 0,
        matched: 0,
        pendingReview: 0,
        finished: true,
        lastOrderId: batch.lastOrderId,
        lockBusy: false,
      };
    }

    // Pick up where the last chunk left off (lastOrderId checkpoint).
    const orders = await tx.order.findMany({
      where: {
        orgId: opts.orgId,
        counterpartyId: null,
        ...(batch.lastOrderId ? { id: { gt: batch.lastOrderId } } : {}),
      },
      orderBy: { id: "asc" },
      take: chunkSize,
      select: { id: true, counterpartyName: true },
    });

    if (orders.length === 0) {
      if (!dryRun) {
        await tx.counterpartyBackfillBatch.update({
          where: { id: batch.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
      }
      return {
        processed: 0,
        matched: 0,
        pendingReview: 0,
        finished: true,
        lastOrderId: batch.lastOrderId,
        lockBusy: false,
      };
    }

    // Build the lookup set of normalized names in one query.
    const normalizedByOrderId = new Map<string, string>();
    const distinctNames = new Set<string>();
    for (const o of orders) {
      const n = normalizeCounterpartyName(o.counterpartyName ?? "");
      normalizedByOrderId.set(o.id, n);
      if (n.length > 0) distinctNames.add(n);
    }

    // Candidate counterparties — only the ones whose normalizedName appears in
    // this chunk. Soft-deleted/merged rows are excluded.
    const candidates =
      distinctNames.size === 0
        ? []
        : await tx.erpCounterparty.findMany({
            where: {
              orgId: opts.orgId,
              normalizedName: { in: [...distinctNames] },
              deletedAt: null,
            },
            select: { id: true, normalizedName: true, bizRegNo: true },
          });

    // Group by normalizedName so we can apply the auto-match invariant:
    // exactly 1 candidate AND that candidate has bizRegNo.
    const candidatesByName = new Map<string, { id: string; bizRegNo: string | null }[]>();
    for (const c of candidates) {
      const list = candidatesByName.get(c.normalizedName);
      if (list) list.push({ id: c.id, bizRegNo: c.bizRegNo });
      else candidatesByName.set(c.normalizedName, [{ id: c.id, bizRegNo: c.bizRegNo }]);
    }

    let matched = 0;
    let pendingReview = 0;
    const updates: Array<{ orderId: string; counterpartyId: string }> = [];

    for (const o of orders) {
      const n = normalizedByOrderId.get(o.id) ?? "";
      const list = n ? candidatesByName.get(n) : undefined;
      if (list && list.length === 1 && list[0].bizRegNo) {
        matched += 1;
        updates.push({ orderId: o.id, counterpartyId: list[0].id });
      } else {
        pendingReview += 1;
      }
    }

    const lastOrderId = orders[orders.length - 1].id;
    const processed = orders.length;

    if (!dryRun) {
      if (updates.length > 0) {
        // Single bulk UPDATE per target counterparty for write efficiency.
        const byTarget = new Map<string, string[]>();
        for (const u of updates) {
          const arr = byTarget.get(u.counterpartyId);
          if (arr) arr.push(u.orderId);
          else byTarget.set(u.counterpartyId, [u.orderId]);
        }
        for (const [counterpartyId, orderIds] of byTarget) {
          await tx.order.updateMany({
            where: {
              orgId: opts.orgId,
              id: { in: orderIds },
              counterpartyId: null,
            },
            data: { counterpartyId },
          });
        }
      }

      await tx.counterpartyBackfillBatch.update({
        where: { id: batch.id },
        data: {
          status: "RUNNING",
          lastOrderId,
          processedOrders: batch.processedOrders + processed,
          matchedCount: batch.matchedCount + matched,
          pendingReview: batch.pendingReview + pendingReview,
        },
      });
    }

    // Whether this chunk was "the last one" — only knowable if we fetched
    // fewer than chunkSize rows. Otherwise more remain.
    const finished = orders.length < chunkSize;
    if (finished && !dryRun) {
      await tx.counterpartyBackfillBatch.update({
        where: { id: batch.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    }

    return {
      processed,
      matched,
      pendingReview,
      finished,
      lastOrderId,
      lockBusy: false,
    };
  });
}

/**
 * Resolve one staging group: link every Order with `normalizedName === group`
 * to the chosen ErpCounterparty. Used by the admin UI after a human review.
 *
 * Returns the number of Orders re-pointed. Does not mutate the batch counters
 * (the original `pendingReview` count remains as an audit trail; the staging
 * list re-queries Orders directly so resolved groups disappear naturally).
 */
export async function resolvePendingGroup(
  opts: {
    orgId: string;
    normalizedName: string;
    counterpartyId: string;
  },
  client: PrismaLike = defaultPrisma,
): Promise<{ linked: number }> {
  return client.$transaction(async (tx) => {
    // Confirm the target counterparty belongs to this org and is not deleted.
    const cp = await tx.erpCounterparty.findFirst({
      where: { id: opts.counterpartyId, orgId: opts.orgId, deletedAt: null },
      select: { id: true },
    });
    if (!cp) {
      throw new Error("counterparty not found in tenant");
    }

    // Re-point every still-null Order whose snapshot normalizes to this group.
    // We can't filter by normalizedName in SQL (it's not stored on Order), so
    // we hydrate ids in JS and updateMany by id list. Caller should keep the
    // group size bounded by paging the staging API.
    const candidates = await tx.order.findMany({
      where: { orgId: opts.orgId, counterpartyId: null },
      select: { id: true, counterpartyName: true },
    });
    const ids = candidates
      .filter((o) => normalizeCounterpartyName(o.counterpartyName ?? "") === opts.normalizedName)
      .map((o) => o.id);
    if (ids.length === 0) {
      return { linked: 0 };
    }
    const updated = await tx.order.updateMany({
      where: { orgId: opts.orgId, id: { in: ids }, counterpartyId: null },
      data: { counterpartyId: opts.counterpartyId },
    });
    return { linked: updated.count };
  });
}

/**
 * List pending-review groups for the staging UI: distinct counterpartyName
 * snapshots that still have `counterpartyId IS NULL` in this org, with the
 * number of Orders behind each group. Sorted by frequency desc so the most
 * impactful unknowns float to the top.
 */
export async function listPendingGroups(
  opts: { orgId: string; limit?: number },
  client: PrismaLike = defaultPrisma,
): Promise<Array<{ normalizedName: string; sampleName: string; orderCount: number }>> {
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 500));
  const rows = await client.order.findMany({
    where: { orgId: opts.orgId, counterpartyId: null },
    select: { counterpartyName: true },
  });
  const groups = new Map<string, { sampleName: string; orderCount: number }>();
  for (const r of rows) {
    const raw = r.counterpartyName ?? "";
    const n = normalizeCounterpartyName(raw);
    if (n.length === 0) continue;
    const g = groups.get(n);
    if (g) g.orderCount += 1;
    else groups.set(n, { sampleName: raw, orderCount: 1 });
  }
  return [...groups.entries()]
    .map(([normalizedName, v]) => ({ normalizedName, ...v }))
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, limit);
}

export function serializeBatch(b: {
  id: string;
  orgId: string;
  status: BackfillStatus;
  totalOrders: number;
  processedOrders: number;
  matchedCount: number;
  pendingReview: number;
  lastOrderId: string | null;
  startedAt: Date;
  completedAt: Date | null;
  notes: string | null;
}): BatchSummary {
  return {
    id: b.id,
    orgId: b.orgId,
    status: b.status,
    totalOrders: b.totalOrders,
    processedOrders: b.processedOrders,
    matchedCount: b.matchedCount,
    pendingReview: b.pendingReview,
    lastOrderId: b.lastOrderId,
    startedAt: b.startedAt.toISOString(),
    completedAt: b.completedAt ? b.completedAt.toISOString() : null,
    notes: b.notes,
  };
}

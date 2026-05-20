/**
 * /api/erp/counterparties/[counterpartyId]/merge (Phase 21 WI-724c)
 *
 *  POST — Merge `counterpartyId` (source) into `body.targetId`.
 *         Re-points every Order to the target, soft-deletes the source,
 *         and writes a CounterpartyMergeLog audit row — all inside a
 *         single transaction guarded by a per-tenant advisory lock so
 *         concurrent merges of the same pair can't collide.
 *
 *  Body: { targetId: string, reason: string (1..500 chars) }
 *
 *  Auth: `erp:merge` — explicitly stronger than `erp:write` (see
 *  packages/auth/src/rebac/scopes.ts). Owners only.
 *
 *  Transaction outline:
 *    1. `pg_try_advisory_xact_lock(hashtext(orgId), hashtext('counterparty-merge'))`
 *       — single in-flight merge per tenant. Returns 409 on lock-busy
 *       rather than queueing (the operator can retry from the UI).
 *    2. SELECT both rows FOR UPDATE — ensures no concurrent SELECT can
 *       grab them after we've decided to mutate, AND surfaces source-
 *       already-deleted / target-deleted cases as 404 before any write.
 *    3. UPDATE "Order" SET counterpartyId = target WHERE counterpartyId = source.
 *       counterpartyName snapshot is intentionally NOT rewritten — design
 *       §4.5 keeps it as the historical pre-merge display value.
 *    4. UPDATE source: deletedAt = now(), mergedIntoId = target.
 *    5. INSERT CounterpartyMergeLog row with the re-pointed orderCount.
 *
 *  Idempotency: re-running with the same (source, target) after a
 *  successful merge → 409 because source.deletedAt is now non-null
 *  (step 2 returns the source as "not eligible").
 *
 *  RED cases the route MUST surface:
 *    - missing `erp:merge` scope → 403
 *    - sourceId == targetId → 400 VALIDATION_ERROR (cycle)
 *    - source/target not in tenant → 404
 *    - source already deleted → 404
 *    - another merge holds the lock → 409 CONFLICT (lockBusy)
 */

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@axle/db";
import {
  requireErpScope,
  toResponse,
  erpBadRequest,
  ErpConflictError,
  ErpNotFoundError,
} from "@/lib/erp/auth";

const Body = z.object({
  targetId: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(1).max(500),
});

interface RouteContext {
  params: Promise<{ counterpartyId: string }>;
}

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  try {
    const auth = await requireErpScope("erp:merge");
    const { counterpartyId: sourceId } = await ctx.params;
    if (!sourceId) return erpBadRequest("counterpartyId is required");

    const raw = (await req.json().catch(() => ({}))) as unknown;
    const body = Body.parse(raw);
    if (body.targetId === sourceId) {
      return erpBadRequest("targetId must differ from source counterpartyId");
    }

    const result = await prisma.$transaction(async (tx) => {
      // (1) Per-tenant advisory lock. pg_try variant fails fast so a busy
      // tenant returns 409 instead of holding the request hostage.
      const lockRows = await tx.$queryRaw<Array<{ acquired: boolean }>>(Prisma.sql`
        SELECT pg_try_advisory_xact_lock(
          hashtext(${auth.orgId}),
          hashtext('counterparty-merge')
        ) AS acquired
      `);
      if (!lockRows[0]?.acquired) {
        throw new ErpConflictError(
          "another counterparty merge is in flight for this tenant",
        );
      }

      // (2) Pin both rows. FOR UPDATE blocks concurrent writers; we filter
      // on (orgId, deletedAt IS NULL) so cross-tenant / already-merged
      // requests surface as 404 before any write happens.
      const pinned = await tx.$queryRaw<
        Array<{ id: string; name: string; deleted_at: Date | null }>
      >(Prisma.sql`
        SELECT id, name, "deletedAt" AS deleted_at
        FROM "ErpCounterparty"
        WHERE "orgId" = ${auth.orgId}
          AND id IN (${sourceId}, ${body.targetId})
        FOR UPDATE
      `);

      const source = pinned.find((r) => r.id === sourceId);
      const target = pinned.find((r) => r.id === body.targetId);

      if (!source || source.deleted_at) {
        throw new ErpNotFoundError(`source counterparty not found: ${sourceId}`);
      }
      if (!target || target.deleted_at) {
        throw new ErpNotFoundError(`target counterparty not found: ${body.targetId}`);
      }

      // (3) Re-point Orders. counterpartyName snapshot kept intact.
      const orderUpdate = await tx.order.updateMany({
        where: { orgId: auth.orgId, counterpartyId: sourceId },
        data: { counterpartyId: body.targetId },
      });

      // (4) Soft-delete source + record mergedIntoId pointer.
      const now = new Date();
      await tx.erpCounterparty.update({
        where: { id: sourceId },
        data: { deletedAt: now, mergedIntoId: body.targetId },
      });

      // (5) Audit row. orderCount = rows re-pointed in step 3.
      const log = await tx.counterpartyMergeLog.create({
        data: {
          orgId: auth.orgId,
          mergedFromId: sourceId,
          mergedIntoId: body.targetId,
          orderCount: orderUpdate.count,
          performedBy: auth.userId,
          reason: body.reason,
        },
        select: { id: true, performedAt: true },
      });

      return {
        mergeLogId: log.id,
        performedAt: log.performedAt,
        sourceId,
        targetId: body.targetId,
        sourceName: source.name,
        targetName: target.name,
        ordersRepointed: orderUpdate.count,
      };
    });

    return Response.json(
      {
        mergeLogId: result.mergeLogId,
        performedAt: result.performedAt.toISOString(),
        sourceId: result.sourceId,
        targetId: result.targetId,
        sourceName: result.sourceName,
        targetName: result.targetName,
        ordersRepointed: result.ordersRepointed,
      },
      { status: 200 },
    );
  } catch (err) {
    // ErpAuthError / ErpConflictError / ErpNotFoundError / ZodError all
    // flow through toResponse with the right HTTP shape. P2003 (FK)
    // shouldn't fire here because we operate on rows we just SELECT FOR
    // UPDATE'd; if it does, toResponse maps it to 500 with logs.
    return toResponse(err);
  }
}

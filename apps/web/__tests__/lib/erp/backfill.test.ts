/**
 * Phase 21 WI-723b — backfill engine unit tests.
 *
 * These exercise the matching invariants and checkpoint behavior of
 * `runBackfillChunk` and `resolvePendingGroup` with a hand-rolled prisma
 * stub. We do not touch a real database — `$transaction` is wired to the
 * same stub so transactional code paths execute end-to-end in the test.
 *
 * Coverage map:
 *   - Auto-match invariant (unique candidate with bizRegNo → linked)
 *   - Pending-review invariant (bizRegNo NULL → no auto-link, count++)
 *   - Pending-review invariant (multiple candidates → ambiguous)
 *   - Dry-run: no UPDATE, counters unchanged, result still observable
 *   - Restart SKIP: lastOrderId checkpoint advances, no double-processing
 *   - Advisory lock busy: zero-work result, no batch mutation
 *   - resolvePendingGroup: re-points only Orders matching normalizedName
 *   - listPendingGroups: groups by normalizedName, sorts by frequency
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {},
}));

import {
  runBackfillChunk,
  resolvePendingGroup,
  listPendingGroups,
  startOrResumeBatch,
} from "../../../lib/erp/backfill";

// ─────────────────────────────────────────────────────────────
// Prisma stub
// ─────────────────────────────────────────────────────────────

interface OrderRow {
  id: string;
  orgId: string;
  counterpartyId: string | null;
  counterpartyName: string;
}

interface BatchRow {
  id: string;
  orgId: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  totalOrders: number;
  processedOrders: number;
  matchedCount: number;
  pendingReview: number;
  lastOrderId: string | null;
  startedAt: Date;
  completedAt: Date | null;
  notes: string | null;
}

interface CpRow {
  id: string;
  orgId: string;
  normalizedName: string;
  bizRegNo: string | null;
  deletedAt: Date | null;
}

function makeStub({
  orders = [] as OrderRow[],
  batches = [] as BatchRow[],
  counterparties = [] as CpRow[],
  lockAcquired = true,
}: {
  orders?: OrderRow[];
  batches?: BatchRow[];
  counterparties?: CpRow[];
  lockAcquired?: boolean;
} = {}) {
  const state = {
    orders: [...orders],
    batches: [...batches],
    counterparties: [...counterparties],
    lockAcquired,
  };

  const tx = {
    $queryRaw: vi.fn(async (..._args: unknown[]) => {
      // Only call this for the advisory lock probe in this module.
      return [{ acquired: state.lockAcquired }];
    }),
    counterpartyBackfillBatch: {
      findFirst: vi.fn(async (args: { where: { id?: string; orgId: string } }) => {
        return (
          state.batches.find(
            (b) =>
              b.orgId === args.where.orgId &&
              (args.where.id ? b.id === args.where.id : true),
          ) ?? null
        );
      }),
      update: vi.fn(
        async (args: {
          where: { id: string };
          data: Partial<BatchRow>;
        }) => {
          const b = state.batches.find((x) => x.id === args.where.id);
          if (!b) throw new Error("batch not found");
          Object.assign(b, args.data);
          return b;
        },
      ),
      create: vi.fn(
        async (args: { data: Omit<BatchRow, "id" | "startedAt" | "completedAt"> & Partial<BatchRow> }) => {
          const created: BatchRow = {
            id: `b_${state.batches.length + 1}`,
            startedAt: new Date("2026-05-17T00:00:00Z"),
            completedAt: null,
            ...args.data,
          } as BatchRow;
          state.batches.push(created);
          return { id: created.id };
        },
      ),
      findFirstOrThrow: vi.fn(async (args: { where: { id: string; orgId: string } }) => {
        const b = state.batches.find(
          (x) => x.id === args.where.id && x.orgId === args.where.orgId,
        );
        if (!b) throw new Error("not found");
        return b;
      }),
      findMany: vi.fn(async (args: { where: { orgId: string } }) =>
        state.batches.filter((b) => b.orgId === args.where.orgId),
      ),
    },
    order: {
      findMany: vi.fn(
        async (args: {
          where: {
            orgId: string;
            counterpartyId: null;
            id?: { gt?: string };
          };
          take: number;
        }) => {
          const list = state.orders.filter(
            (o) =>
              o.orgId === args.where.orgId &&
              o.counterpartyId === null &&
              (!args.where.id?.gt || o.id > args.where.id.gt),
          );
          list.sort((a, b) => (a.id < b.id ? -1 : 1));
          return list.slice(0, args.take ?? 1000);
        },
      ),
      updateMany: vi.fn(
        async (args: {
          where: { orgId: string; id: { in: string[] }; counterpartyId: null };
          data: { counterpartyId: string };
        }) => {
          let count = 0;
          for (const o of state.orders) {
            if (
              o.orgId === args.where.orgId &&
              o.counterpartyId === null &&
              args.where.id.in.includes(o.id)
            ) {
              o.counterpartyId = args.data.counterpartyId;
              count += 1;
            }
          }
          return { count };
        },
      ),
      count: vi.fn(
        async (args: { where: { orgId: string; counterpartyId: null } }) =>
          state.orders.filter(
            (o) => o.orgId === args.where.orgId && o.counterpartyId === null,
          ).length,
      ),
    },
    erpCounterparty: {
      findMany: vi.fn(
        async (args: {
          where: {
            orgId: string;
            normalizedName: { in: string[] };
            deletedAt: null;
          };
        }) => {
          return state.counterparties.filter(
            (c) =>
              c.orgId === args.where.orgId &&
              c.deletedAt === null &&
              args.where.normalizedName.in.includes(c.normalizedName),
          );
        },
      ),
      findFirst: vi.fn(
        async (args: {
          where: { id: string; orgId: string; deletedAt: null };
        }) =>
          state.counterparties.find(
            (c) =>
              c.id === args.where.id &&
              c.orgId === args.where.orgId &&
              c.deletedAt === null,
          ) ?? null,
      ),
    },
  };

  // `$transaction(fn)` invokes fn(tx) and returns the result; mirrors prisma's
  // interactive transaction shape.
  const client = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    counterpartyBackfillBatch: tx.counterpartyBackfillBatch,
    order: tx.order,
    erpCounterparty: tx.erpCounterparty,
  };

  return { client: client as unknown as Parameters<typeof runBackfillChunk>[1], state, tx };
}

const ORG = "org_test";

// ─────────────────────────────────────────────────────────────
// runBackfillChunk
// ─────────────────────────────────────────────────────────────

describe("runBackfillChunk — matching invariants", () => {
  it("auto-matches when there is exactly one candidate with bizRegNo", async () => {
    const { client, state } = makeStub({
      orders: [
        { id: "o1", orgId: ORG, counterpartyId: null, counterpartyName: "(주)에이비씨" },
      ],
      batches: [batch({ id: "b1" })],
      counterparties: [
        {
          id: "cp1",
          orgId: ORG,
          normalizedName: "에이비씨",
          bizRegNo: "1234567890",
          deletedAt: null,
        },
      ],
    });

    const result = await runBackfillChunk(
      { orgId: ORG, batchId: "b1", chunkSize: 10 },
      client,
    );

    expect(result.matched).toBe(1);
    expect(result.pendingReview).toBe(0);
    expect(result.processed).toBe(1);
    expect(result.finished).toBe(true);
    expect(state.orders[0].counterpartyId).toBe("cp1");
    // batch counters updated + status COMPLETED on the same chunk (fewer than chunkSize)
    expect(state.batches[0].matchedCount).toBe(1);
    expect(state.batches[0].lastOrderId).toBe("o1");
    expect(state.batches[0].status).toBe("COMPLETED");
  });

  it("RED — refuses auto-match when candidate has NULL bizRegNo (pendingReview only)", async () => {
    const { client, state } = makeStub({
      orders: [
        { id: "o1", orgId: ORG, counterpartyId: null, counterpartyName: "한솔물류" },
      ],
      batches: [batch({ id: "b1" })],
      counterparties: [
        {
          id: "cp_nobizreg",
          orgId: ORG,
          normalizedName: "한솔물류",
          bizRegNo: null, // intentional — design says auto-match forbidden
          deletedAt: null,
        },
      ],
    });

    const result = await runBackfillChunk(
      { orgId: ORG, batchId: "b1", chunkSize: 10 },
      client,
    );

    expect(result.matched).toBe(0);
    expect(result.pendingReview).toBe(1);
    expect(state.orders[0].counterpartyId).toBeNull(); // untouched
    expect(state.batches[0].pendingReview).toBe(1);
  });

  it("refuses auto-match when two candidates share the normalized name (ambiguous)", async () => {
    const { client, state } = makeStub({
      orders: [
        { id: "o1", orgId: ORG, counterpartyId: null, counterpartyName: "에이비씨" },
      ],
      batches: [batch({ id: "b1" })],
      counterparties: [
        {
          id: "cp1",
          orgId: ORG,
          normalizedName: "에이비씨",
          bizRegNo: "1111111111",
          deletedAt: null,
        },
        {
          id: "cp2",
          orgId: ORG,
          normalizedName: "에이비씨",
          bizRegNo: "2222222222",
          deletedAt: null,
        },
      ],
    });

    const result = await runBackfillChunk(
      { orgId: ORG, batchId: "b1", chunkSize: 10 },
      client,
    );
    expect(result.matched).toBe(0);
    expect(result.pendingReview).toBe(1);
    expect(state.orders[0].counterpartyId).toBeNull();
  });

  it("dry-run: returns matching counts but performs NO UPDATEs (RED — DB unchanged)", async () => {
    const { client, state, tx } = makeStub({
      orders: [
        { id: "o1", orgId: ORG, counterpartyId: null, counterpartyName: "(주)에이비씨" },
      ],
      batches: [batch({ id: "b1" })],
      counterparties: [
        {
          id: "cp1",
          orgId: ORG,
          normalizedName: "에이비씨",
          bizRegNo: "1234567890",
          deletedAt: null,
        },
      ],
    });

    const result = await runBackfillChunk(
      { orgId: ORG, batchId: "b1", chunkSize: 10, dryRun: true },
      client,
    );

    expect(result.matched).toBe(1);
    expect(result.pendingReview).toBe(0);
    // Critical: no UPDATE called.
    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.counterpartyBackfillBatch.update).not.toHaveBeenCalled();
    expect(state.orders[0].counterpartyId).toBeNull();
    expect(state.batches[0].matchedCount).toBe(0);
    expect(state.batches[0].status).toBe("RUNNING"); // untouched
  });

  it("RED — restart SKIP: second call honors lastOrderId checkpoint", async () => {
    // Simulate 3 orders, but the batch already processed o1 (lastOrderId=o1).
    const { client, tx } = makeStub({
      orders: [
        { id: "o1", orgId: ORG, counterpartyId: "cp1", counterpartyName: "abc" }, // already linked
        { id: "o2", orgId: ORG, counterpartyId: null, counterpartyName: "(주)에이비씨" },
        { id: "o3", orgId: ORG, counterpartyId: null, counterpartyName: "(주)에이비씨" },
      ],
      batches: [
        batch({
          id: "b1",
          status: "RUNNING",
          processedOrders: 1,
          matchedCount: 1,
          lastOrderId: "o1",
        }),
      ],
      counterparties: [
        {
          id: "cp1",
          orgId: ORG,
          normalizedName: "에이비씨",
          bizRegNo: "1234567890",
          deletedAt: null,
        },
      ],
    });

    const result = await runBackfillChunk(
      { orgId: ORG, batchId: "b1", chunkSize: 10 },
      client,
    );

    // Only o2/o3 should be considered — o1 already had counterpartyId AND id <= lastOrderId
    expect(result.processed).toBe(2);
    expect(result.matched).toBe(2);
    expect(result.lastOrderId).toBe("o3");
    // findMany should have been called with id.gt=o1
    const call = tx.order.findMany.mock.calls[0]?.[0] as {
      where: { id?: { gt?: string } };
    };
    expect(call.where.id?.gt).toBe("o1");
  });

  it("advisory lock busy → returns lockBusy with zero counters and no work", async () => {
    const { client, state, tx } = makeStub({
      orders: [{ id: "o1", orgId: ORG, counterpartyId: null, counterpartyName: "abc" }],
      batches: [batch({ id: "b1" })],
      lockAcquired: false,
    });

    const result = await runBackfillChunk(
      { orgId: ORG, batchId: "b1", chunkSize: 10 },
      client,
    );
    expect(result.lockBusy).toBe(true);
    expect(result.processed).toBe(0);
    expect(tx.order.findMany).not.toHaveBeenCalled();
    expect(state.orders[0].counterpartyId).toBeNull();
  });

  it("uses Prisma.sql for the advisory lock probe (hashtext keys)", async () => {
    const { client, tx } = makeStub({
      orders: [],
      batches: [batch({ id: "b1" })],
    });
    await runBackfillChunk({ orgId: ORG, batchId: "b1" }, client);
    expect(tx.$queryRaw).toHaveBeenCalled();
    const sql = tx.$queryRaw.mock.calls[0]?.[0] as Prisma.Sql;
    // Prisma.Sql exposes the parameter values used in interpolation.
    expect(sql.values).toContain(ORG);
  });
});

// ─────────────────────────────────────────────────────────────
// startOrResumeBatch
// ─────────────────────────────────────────────────────────────

describe("startOrResumeBatch", () => {
  it("creates a new batch when none is in PENDING/RUNNING", async () => {
    const { client, state } = makeStub({
      orders: [{ id: "o1", orgId: ORG, counterpartyId: null, counterpartyName: "x" }],
    });
    const { batchId, resumed } = await startOrResumeBatch(client as never, {
      orgId: ORG,
      notes: "first run",
    });
    expect(resumed).toBe(false);
    expect(batchId).toBe("b_1");
    expect(state.batches[0].notes).toBe("first run");
    expect(state.batches[0].totalOrders).toBe(1);
  });

  it("resumes the most recent unfinished batch instead of creating a new one", async () => {
    const { client } = makeStub({
      batches: [batch({ id: "b_existing", status: "RUNNING" })],
    });
    const { batchId, resumed } = await startOrResumeBatch(client as never, {
      orgId: ORG,
    });
    expect(resumed).toBe(true);
    expect(batchId).toBe("b_existing");
  });
});

// ─────────────────────────────────────────────────────────────
// resolvePendingGroup
// ─────────────────────────────────────────────────────────────

describe("resolvePendingGroup", () => {
  it("re-points only Orders whose normalizedName matches the group", async () => {
    const { client, state } = makeStub({
      orders: [
        { id: "o1", orgId: ORG, counterpartyId: null, counterpartyName: "(주)에이비씨" }, // → 에이비씨
        { id: "o2", orgId: ORG, counterpartyId: null, counterpartyName: "에이비씨" },     // → 에이비씨
        { id: "o3", orgId: ORG, counterpartyId: null, counterpartyName: "한솔물류" },     // → 한솔물류 (skip)
      ],
      counterparties: [
        {
          id: "cp_abc",
          orgId: ORG,
          normalizedName: "에이비씨",
          bizRegNo: "1234567890",
          deletedAt: null,
        },
      ],
    });

    const result = await resolvePendingGroup(
      { orgId: ORG, normalizedName: "에이비씨", counterpartyId: "cp_abc" },
      client,
    );
    expect(result.linked).toBe(2);
    expect(state.orders.find((o) => o.id === "o1")?.counterpartyId).toBe("cp_abc");
    expect(state.orders.find((o) => o.id === "o2")?.counterpartyId).toBe("cp_abc");
    expect(state.orders.find((o) => o.id === "o3")?.counterpartyId).toBeNull();
  });

  it("throws when counterparty is not in the tenant", async () => {
    const { client } = makeStub({ orders: [] });
    await expect(
      resolvePendingGroup(
        { orgId: ORG, normalizedName: "x", counterpartyId: "missing" },
        client,
      ),
    ).rejects.toThrow(/counterparty not found/);
  });
});

// ─────────────────────────────────────────────────────────────
// listPendingGroups
// ─────────────────────────────────────────────────────────────

describe("listPendingGroups", () => {
  it("groups Orders by normalizedName and sorts by frequency desc", async () => {
    const { client } = makeStub({
      orders: [
        { id: "o1", orgId: ORG, counterpartyId: null, counterpartyName: "에이비씨" },
        { id: "o2", orgId: ORG, counterpartyId: null, counterpartyName: "(주)에이비씨" },
        { id: "o3", orgId: ORG, counterpartyId: null, counterpartyName: "에이비씨 컴퍼니" },
        { id: "o4", orgId: ORG, counterpartyId: null, counterpartyName: "한솔물류" },
      ],
    });
    const groups = await listPendingGroups({ orgId: ORG }, client);
    expect(groups[0].normalizedName).toBe("에이비씨"); // 2 orders
    expect(groups[0].orderCount).toBe(2);
    const names = groups.map((g) => g.normalizedName);
    expect(names).toContain("에이비씨 컴퍼니");
    expect(names).toContain("한솔물류");
  });

  it("ignores rows whose normalized name is empty", async () => {
    const { client } = makeStub({
      orders: [
        { id: "o1", orgId: ORG, counterpartyId: null, counterpartyName: "" },
        { id: "o2", orgId: ORG, counterpartyId: null, counterpartyName: "한솔물류" },
      ],
    });
    const groups = await listPendingGroups({ orgId: ORG }, client);
    expect(groups).toHaveLength(1);
    expect(groups[0].normalizedName).toBe("한솔물류");
  });
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function batch(overrides: Partial<BatchRow> = {}): BatchRow {
  return {
    id: "b1",
    orgId: ORG,
    status: "RUNNING",
    totalOrders: 0,
    processedOrders: 0,
    matchedCount: 0,
    pendingReview: 0,
    lastOrderId: null,
    startedAt: new Date("2026-05-17T00:00:00Z"),
    completedAt: null,
    notes: null,
    ...overrides,
  };
}

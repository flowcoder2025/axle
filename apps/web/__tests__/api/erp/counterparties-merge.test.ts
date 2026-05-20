/**
 * Phase 21 WI-724c — merge route tests.
 *
 * Contract under test (one per AC):
 *
 *   1. Advisory lock is acquired BEFORE any SELECT/UPDATE. Busy lock → 409.
 *   2. Both rows are pinned with FOR UPDATE; cross-tenant or already-
 *      deleted rows surface as 404 without writes.
 *   3. Order.counterpartyId is bulk-updated from source → target.
 *      counterpartyName snapshot is NOT touched (design §4.5).
 *   4. Source row gets deletedAt + mergedIntoId in the same transaction.
 *   5. CounterpartyMergeLog row is written with the re-pointed order count.
 *   6. RED: erp:merge missing → 403 (even when erp:write is present).
 *   7. RED: sourceId == targetId → 400.
 *   8. RED: source already deleted → 404 (no MergeLog written).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
  checkModulePermission: vi.fn(),
}));

vi.mock("@/src/lib/tenant-context", () => ({
  getActiveTenant: vi.fn(),
}));

vi.mock("@axle/db", () => {
  const $queryRaw = vi.fn();
  const erpCounterparty = { update: vi.fn() };
  const order = { updateMany: vi.fn() };
  const counterpartyMergeLog = { create: vi.fn() };
  const $transaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({ $queryRaw, erpCounterparty, order, counterpartyMergeLog }),
  );
  return {
    DB_PACKAGE: "@axle/db",
    prisma: {
      $transaction,
      $queryRaw,
      erpCounterparty,
      order,
      counterpartyMergeLog,
      organization: { findUnique: vi.fn() },
    },
  };
});

import { prisma } from "@axle/db";
import { getCurrentUser, checkModulePermission } from "@axle/auth";
import { getActiveTenant } from "@/src/lib/tenant-context";

import { POST } from "../../../app/api/erp/counterparties/[counterpartyId]/merge/route";

const queryRawMock = (prisma as unknown as { $queryRaw: ReturnType<typeof vi.fn> }).$queryRaw;
const erpCpMock = (prisma as unknown as {
  erpCounterparty: Record<string, ReturnType<typeof vi.fn>>;
}).erpCounterparty;
const orderMock = (prisma as unknown as {
  order: Record<string, ReturnType<typeof vi.fn>>;
}).order;
const logMock = (prisma as unknown as {
  counterpartyMergeLog: Record<string, ReturnType<typeof vi.fn>>;
}).counterpartyMergeLog;
const orgMock = (prisma as unknown as {
  organization: Record<string, ReturnType<typeof vi.fn>>;
}).organization;

const authedUser = { id: "u1", orgId: "org_test", email: "u1@x", name: "u" };

function mergeReq(body: unknown): Request {
  return new Request("http://x/api/erp/counterparties/cp_source/merge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function ctx(counterpartyId = "cp_source") {
  return { params: Promise.resolve({ counterpartyId }) };
}

const VALID_BODY = { targetId: "cp_target", reason: "동일 거래처 통합" };

beforeEach(() => {
  vi.clearAllMocks();
  (getCurrentUser as unknown as { mockResolvedValue: Function }).mockResolvedValue(authedUser);
  (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(true);
  (getActiveTenant as unknown as { mockResolvedValue: Function }).mockResolvedValue({
    id: "org_test",
    isManaged: false,
    name: "test-org",
  });
  orgMock.findUnique.mockResolvedValue({ name: "test-org" });

  // Default mock sequence:
  //   call 1 → advisory lock acquired
  //   call 2 → SELECT FOR UPDATE returns both rows alive
  queryRawMock.mockReset();
  queryRawMock
    .mockResolvedValueOnce([{ acquired: true }])
    .mockResolvedValueOnce([
      { id: "cp_source", name: "에이비씨 A", deleted_at: null },
      { id: "cp_target", name: "에이비씨", deleted_at: null },
    ]);

  orderMock.updateMany.mockResolvedValue({ count: 7 });
  erpCpMock.update.mockResolvedValue({ id: "cp_source" });
  logMock.create.mockResolvedValue({
    id: "log_1",
    performedAt: new Date("2026-05-20T10:00:00Z"),
  });
});

// ─────────────────────────────────────────────────────────────
// Happy path
// ─────────────────────────────────────────────────────────────

describe("POST merge — happy path", () => {
  it("returns 200 with mergeLogId, orders count, and snapshot names", async () => {
    const res = await POST(mergeReq(VALID_BODY), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      mergeLogId: "log_1",
      performedAt: "2026-05-20T10:00:00.000Z",
      sourceId: "cp_source",
      targetId: "cp_target",
      sourceName: "에이비씨 A",
      targetName: "에이비씨",
      ordersRepointed: 7,
    });
  });

  it("acquires the advisory lock BEFORE any SELECT/UPDATE", async () => {
    await POST(mergeReq(VALID_BODY), ctx());
    // call 0 = advisory lock probe
    const lockSql = queryRawMock.mock.calls[0]?.[0] as { sql: string; values: unknown[] };
    expect(lockSql.sql).toMatch(/pg_try_advisory_xact_lock/);
    expect(lockSql.sql).toMatch(/hashtext\(\s*\?\s*\)/);
    expect(lockSql.sql).toMatch(/hashtext\(\s*'counterparty-merge'\s*\)/);
    expect(lockSql.values).toContain("org_test");
  });

  it("SELECT FOR UPDATE pins both rows in the active tenant", async () => {
    await POST(mergeReq(VALID_BODY), ctx());
    const selectSql = queryRawMock.mock.calls[1]?.[0] as { sql: string; values: unknown[] };
    expect(selectSql.sql).toMatch(/FOR UPDATE/);
    expect(selectSql.sql).toMatch(/"orgId"\s*=\s*\?/);
    expect(selectSql.values).toContain("cp_source");
    expect(selectSql.values).toContain("cp_target");
    expect(selectSql.values).toContain("org_test");
  });

  it("re-points every Order via updateMany (counterpartyName snapshot untouched)", async () => {
    await POST(mergeReq(VALID_BODY), ctx());
    expect(orderMock.updateMany).toHaveBeenCalledWith({
      where: { orgId: "org_test", counterpartyId: "cp_source" },
      data: { counterpartyId: "cp_target" },
    });
    // We must NOT touch counterpartyName — that's the historical snapshot.
    const args = orderMock.updateMany.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(args.data).not.toHaveProperty("counterpartyName");
  });

  it("soft-deletes the source row (deletedAt + mergedIntoId)", async () => {
    await POST(mergeReq(VALID_BODY), ctx());
    expect(erpCpMock.update).toHaveBeenCalledTimes(1);
    const args = erpCpMock.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { deletedAt: unknown; mergedIntoId: string };
    };
    expect(args.where.id).toBe("cp_source");
    expect(args.data.mergedIntoId).toBe("cp_target");
    expect(args.data.deletedAt).toBeInstanceOf(Date);
  });

  it("writes a CounterpartyMergeLog with the re-pointed orderCount and performer", async () => {
    await POST(mergeReq(VALID_BODY), ctx());
    expect(logMock.create).toHaveBeenCalledTimes(1);
    const args = logMock.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(args.data).toMatchObject({
      orgId: "org_test",
      mergedFromId: "cp_source",
      mergedIntoId: "cp_target",
      orderCount: 7,
      performedBy: "u1",
      reason: "동일 거래처 통합",
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Conflict + lock
// ─────────────────────────────────────────────────────────────

describe("POST merge — conflict and lock", () => {
  it("advisory lock busy → 409 (no writes)", async () => {
    queryRawMock.mockReset();
    queryRawMock.mockResolvedValueOnce([{ acquired: false }]);

    const res = await POST(mergeReq(VALID_BODY), ctx());
    expect(res.status).toBe(409);
    expect(orderMock.updateMany).not.toHaveBeenCalled();
    expect(erpCpMock.update).not.toHaveBeenCalled();
    expect(logMock.create).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// Validation + RBAC + not-found RED cases
// ─────────────────────────────────────────────────────────────

describe("POST merge — RED cases", () => {
  it("RED — sourceId == targetId → 400 (no SQL runs)", async () => {
    const res = await POST(
      mergeReq({ targetId: "cp_source", reason: "self" }),
      ctx("cp_source"),
    );
    expect(res.status).toBe(400);
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  it("RED — missing erp:merge scope → 403 (even with erp:write)", async () => {
    (checkModulePermission as unknown as { mockImplementation: Function }).mockImplementation(
      async (_u: string, _o: string, scope: string) => scope !== "erp:merge",
    );
    const res = await POST(mergeReq(VALID_BODY), ctx());
    expect(res.status).toBe(403);
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  it("RED — unauthenticated → 401", async () => {
    (getCurrentUser as unknown as { mockResolvedValue: Function }).mockResolvedValue(null);
    const res = await POST(mergeReq(VALID_BODY), ctx());
    expect(res.status).toBe(401);
  });

  it("RED — source not in tenant → 404 (no order/log writes)", async () => {
    queryRawMock.mockReset();
    queryRawMock
      .mockResolvedValueOnce([{ acquired: true }])
      .mockResolvedValueOnce([
        // Only target present; source missing entirely
        { id: "cp_target", name: "B", deleted_at: null },
      ]);
    const res = await POST(mergeReq(VALID_BODY), ctx());
    expect(res.status).toBe(404);
    expect(orderMock.updateMany).not.toHaveBeenCalled();
    expect(logMock.create).not.toHaveBeenCalled();
  });

  it("RED — source already soft-deleted → 404 (idempotency check)", async () => {
    queryRawMock.mockReset();
    queryRawMock
      .mockResolvedValueOnce([{ acquired: true }])
      .mockResolvedValueOnce([
        { id: "cp_source", name: "A", deleted_at: new Date("2026-05-19") },
        { id: "cp_target", name: "B", deleted_at: null },
      ]);
    const res = await POST(mergeReq(VALID_BODY), ctx());
    expect(res.status).toBe(404);
    expect(orderMock.updateMany).not.toHaveBeenCalled();
  });

  it("RED — target soft-deleted → 404", async () => {
    queryRawMock.mockReset();
    queryRawMock
      .mockResolvedValueOnce([{ acquired: true }])
      .mockResolvedValueOnce([
        { id: "cp_source", name: "A", deleted_at: null },
        { id: "cp_target", name: "B", deleted_at: new Date("2026-05-19") },
      ]);
    const res = await POST(mergeReq(VALID_BODY), ctx());
    expect(res.status).toBe(404);
    expect(orderMock.updateMany).not.toHaveBeenCalled();
  });

  it("RED — missing reason in body → 400 (Zod min(1))", async () => {
    const res = await POST(mergeReq({ targetId: "cp_target" }), ctx());
    expect(res.status).toBe(400);
  });
});

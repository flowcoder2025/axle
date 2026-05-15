import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks (declared before route imports) ---

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
  checkModulePermission: vi.fn(),
}));

vi.mock("@/src/lib/tenant-context", () => ({
  getActiveTenant: vi.fn(),
}));

vi.mock("@axle/db", () => {
  const order = {
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  const inventoryMovement = {
    findMany: vi.fn(),
    create: vi.fn(),
  };
  const organization = { findUnique: vi.fn() };
  // $transaction is mocked to immediately invoke the callback with a tx
  // object that mirrors the real prisma client methods. Each test inspects
  // the mock calls to verify atomic mutations.
  const $transaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
    return cb({ order, inventoryMovement });
  });
  return {
    DB_PACKAGE: "@axle/db",
    prisma: { order, inventoryMovement, organization, $transaction },
  };
});

import { prisma } from "@axle/db";
const orderMock = (prisma as unknown as {
  order: Record<string, ReturnType<typeof vi.fn>>;
}).order;
const movementMock = (prisma as unknown as {
  inventoryMovement: Record<string, ReturnType<typeof vi.fn>>;
}).inventoryMovement;
const organizationMock = (prisma as unknown as {
  organization: Record<string, ReturnType<typeof vi.fn>>;
}).organization;
const txMock = (prisma as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
}).$transaction;

import { POST } from "../../../app/api/erp/orders/[orderId]/cancel/route";
import { getCurrentUser, checkModulePermission } from "@axle/auth";
import { getActiveTenant } from "@/src/lib/tenant-context";

const authedUser = { id: "u1", orgId: "org_test", email: "u1@x", name: "u" };

function postReq(): Request {
  return new Request("http://x/api/erp/orders/o1/cancel", { method: "POST" });
}

function ctx(orderId = "o1") {
  return { params: Promise.resolve({ orderId }) };
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "o1",
    orgId: "org_test",
    type: "SALE",
    counterpartyId: null,
    counterpartyName: "ACME",
    status: "CANCELLED",
    total: 15000,
    tax: 1500,
    occurredAt: new Date("2026-05-10"),
    source: null,
    sourceId: null,
    note: null,
    createdAt: new Date("2026-05-10"),
    updatedAt: new Date("2026-05-10"),
    items: [],
    ...overrides,
  };
}

function makeMovement(overrides: Record<string, unknown> = {}) {
  return {
    id: "m1",
    orgId: "org_test",
    productId: "p1",
    type: "OUT",
    qty: 10,
    source: "ORDER",
    sourceId: "o1",
    unitCost: 1500,
    note: null,
    occurredAt: new Date("2026-05-10"),
    createdAt: new Date("2026-05-10"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (getCurrentUser as unknown as { mockResolvedValue: Function }).mockResolvedValue(
    authedUser,
  );
  (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(
    true,
  );
  (getActiveTenant as unknown as { mockResolvedValue: Function }).mockResolvedValue({
    id: "org_test",
    isManaged: false,
    name: "test-org",
  });
  organizationMock.findUnique.mockResolvedValue({ name: "test-org" });
  // Re-wire $transaction after clearAllMocks (it was set in the factory).
  txMock.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
    return cb({ order: orderMock, inventoryMovement: movementMock });
  });
  // Default to "happy path" base: conditional flip succeeds, post-update
  // re-fetch returns the cancelled order, no movements to reverse.
  orderMock.updateMany.mockResolvedValue({ count: 1 });
  orderMock.findFirst.mockResolvedValue(makeOrder({ status: "CANCELLED" }));
  movementMock.findMany.mockResolvedValue([]);
  movementMock.create.mockResolvedValue({});
});

describe("POST /api/erp/orders/[orderId]/cancel — happy path", () => {
  it("CONFIRMED → CANCELLED + creates exactly one reverse movement per original", async () => {
    movementMock.findMany.mockResolvedValueOnce([
      makeMovement({ id: "m_orig", type: "OUT", qty: 10, productId: "p1", unitCost: 1500 }),
    ]);

    const res = await POST(postReq(), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("CANCELLED");

    // The atomic flip ran exactly once with the status predicate baked into
    // the WHERE clause so it cannot race.
    expect(orderMock.updateMany).toHaveBeenCalledTimes(1);
    expect(orderMock.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "o1", orgId: "org_test", status: "CONFIRMED" },
      data: { status: "CANCELLED" },
    });
    // No legacy `update` call.
    expect(orderMock.update).not.toHaveBeenCalled();

    // Exactly one reverse movement created
    expect(movementMock.create).toHaveBeenCalledTimes(1);
    const createArgs = movementMock.create.mock.calls[0]?.[0];
    expect(createArgs.data).toMatchObject({
      orgId: "org_test",
      productId: "p1",
      type: "IN", // reversed from OUT
      qty: 10, // same magnitude
      source: "ORDER",
      sourceId: "o1",
      unitCost: 1500,
    });
    expect(createArgs.data.note).toContain("[취소]");
    expect(createArgs.data.note).toContain("m_orig");
  });

  it("reverses each original movement (IN→OUT, OUT→IN, ADJUST→ADJUST)", async () => {
    movementMock.findMany.mockResolvedValueOnce([
      makeMovement({ id: "m_in", type: "IN", qty: 5 }),
      makeMovement({ id: "m_out", type: "OUT", qty: 7 }),
      makeMovement({ id: "m_adj", type: "ADJUST", qty: 1 }),
    ]);

    const res = await POST(postReq(), ctx());
    expect(res.status).toBe(200);

    expect(movementMock.create).toHaveBeenCalledTimes(3);
    const types = movementMock.create.mock.calls.map(
      (call) => (call[0] as { data: { type: string } }).data.type,
    );
    expect(types).toEqual(["OUT", "IN", "ADJUST"]);
  });

  it("excludes already-reversed movements from the originals query", async () => {
    await POST(postReq(), ctx());
    const findArgs = movementMock.findMany.mock.calls[0]?.[0];
    expect(findArgs.where.source).toBe("ORDER");
    expect(findArgs.where.sourceId).toBe("o1");
    expect(findArgs.where.orgId).toBe("org_test");
    // Filter excludes prior reversals
    expect(findArgs.where.NOT).toEqual({ note: { startsWith: "[취소]" } });
  });

  it("creates no movements when the order had none (ad-hoc items only)", async () => {
    movementMock.findMany.mockResolvedValueOnce([]); // no originals
    const res = await POST(postReq(), ctx());
    expect(res.status).toBe(200);
    expect(orderMock.updateMany).toHaveBeenCalledTimes(1);
    expect(movementMock.create).not.toHaveBeenCalled();
  });
});

describe("POST cancel — idempotency / invalid state", () => {
  it("double-cancel returns 409 and writes NO new movement", async () => {
    // Conditional flip misses (status no longer CONFIRMED), then disambig
    // re-fetch finds the row already in CANCELLED.
    orderMock.updateMany.mockResolvedValueOnce({ count: 0 });
    orderMock.findFirst.mockResolvedValueOnce({ status: "CANCELLED" });

    const res = await POST(postReq(), ctx());
    expect(res.status).toBe(409);
    // The atomic flip was attempted but didn't match; no further mutations.
    expect(orderMock.updateMany).toHaveBeenCalledTimes(1);
    expect(orderMock.update).not.toHaveBeenCalled();
    expect(movementMock.create).not.toHaveBeenCalled();
    // findMany for originals is never reached when the flip misses.
    expect(movementMock.findMany).not.toHaveBeenCalled();
  });

  it("cannot cancel a DRAFT order (409)", async () => {
    orderMock.updateMany.mockResolvedValueOnce({ count: 0 });
    orderMock.findFirst.mockResolvedValueOnce({ status: "DRAFT" });
    const res = await POST(postReq(), ctx());
    expect(res.status).toBe(409);
    expect(orderMock.update).not.toHaveBeenCalled();
    expect(movementMock.create).not.toHaveBeenCalled();
  });

  it("returns 404 when the order is not in the active tenant", async () => {
    orderMock.updateMany.mockResolvedValueOnce({ count: 0 });
    orderMock.findFirst.mockResolvedValueOnce(null);
    const res = await POST(postReq(), ctx("missing"));
    expect(res.status).toBe(404);
    expect(orderMock.update).not.toHaveBeenCalled();
    expect(movementMock.create).not.toHaveBeenCalled();
  });

  it("returns 401 when no user is authenticated", async () => {
    (getCurrentUser as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      null,
    );
    const res = await POST(postReq(), ctx());
    expect(res.status).toBe(401);
    expect(txMock).not.toHaveBeenCalled();
  });

  it("returns 403 when erp:write scope is missing", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      false,
    );
    const res = await POST(postReq(), ctx());
    expect(res.status).toBe(403);
    expect(txMock).not.toHaveBeenCalled();
  });

  it("invariant: after cancel + attempted double-cancel, only one reversal set per movement was written", async () => {
    // First call: flip succeeds (count=1) with 1 movement → 1 reversal
    orderMock.updateMany.mockResolvedValueOnce({ count: 1 });
    movementMock.findMany.mockResolvedValueOnce([makeMovement({ id: "m_orig" })]);
    const res1 = await POST(postReq(), ctx());
    expect(res1.status).toBe(200);
    expect(movementMock.create).toHaveBeenCalledTimes(1);

    // Second call: flip misses (already CANCELLED) → 409, no extra reversal
    orderMock.updateMany.mockResolvedValueOnce({ count: 0 });
    orderMock.findFirst.mockResolvedValueOnce({ status: "CANCELLED" });
    const res2 = await POST(postReq(), ctx());
    expect(res2.status).toBe(409);
    // Still exactly one create across both attempts
    expect(movementMock.create).toHaveBeenCalledTimes(1);
  });

  it("race-safe: parallel cancels — only one succeeds, second sees count=0", async () => {
    // Simulate the SQL-level guarantee: even if both POSTs enter the tx
    // concurrently, only one updateMany returns count=1. The other returns
    // count=0 and the disambiguation re-fetch sees CANCELLED.
    orderMock.updateMany
      .mockResolvedValueOnce({ count: 1 }) // winner
      .mockResolvedValueOnce({ count: 0 }); // loser
    movementMock.findMany.mockResolvedValueOnce([makeMovement({ id: "m_orig" })]);
    // Two `findFirst` callers in the route:
    //  - winner: post-flip re-fetch needs the full order (with items) for serialization
    //  - loser: disambiguation needs just `{ status }`
    // We seed both — order of resolution depends on which tx wins the race.
    orderMock.findFirst
      .mockResolvedValueOnce(makeOrder({ status: "CANCELLED" })) // winner re-fetch
      .mockResolvedValueOnce({ status: "CANCELLED" }); // loser disambig

    const [res1, res2] = await Promise.all([
      POST(postReq(), ctx()),
      POST(postReq(), ctx()),
    ]);
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);
    // Exactly one reversal was written despite the parallel attempts.
    expect(movementMock.create).toHaveBeenCalledTimes(1);
  });
});

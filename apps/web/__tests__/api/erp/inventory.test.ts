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
  const product = { findFirst: vi.fn() };
  const inventoryMovement = {
    findMany: vi.fn(),
    groupBy: vi.fn(),
  };
  const organization = { findUnique: vi.fn() };
  return {
    DB_PACKAGE: "@axle/db",
    prisma: { product, inventoryMovement, organization },
  };
});

import { prisma } from "@axle/db";
const productMock = (prisma as unknown as {
  product: Record<string, ReturnType<typeof vi.fn>>;
}).product;
const movementMock = (prisma as unknown as {
  inventoryMovement: Record<string, ReturnType<typeof vi.fn>>;
}).inventoryMovement;
const organizationMock = (prisma as unknown as {
  organization: Record<string, ReturnType<typeof vi.fn>>;
}).organization;

import { GET } from "../../../app/api/erp/inventory/route";
import { getCurrentUser, checkModulePermission } from "@axle/auth";
import { getActiveTenant } from "@/src/lib/tenant-context";

const authedUser = { id: "u1", orgId: "org_test", email: "u1@x", name: "u" };

function req(url: string): Request {
  return new Request(url, { method: "GET" });
}

function makeMovement(overrides: Record<string, unknown> = {}) {
  return {
    id: "m1",
    orgId: "org_test",
    productId: "p1",
    type: "IN",
    qty: 10,
    source: "RECEIPT_INTAKE",
    sourceId: "intake1",
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
  productMock.findFirst.mockResolvedValue({ id: "p1" });
  movementMock.findMany.mockResolvedValue([]);
  movementMock.groupBy.mockResolvedValue([]);
});

describe("GET /api/erp/inventory", () => {
  it("returns serialized movements + stock object on happy path", async () => {
    movementMock.findMany.mockResolvedValueOnce([makeMovement()]);
    movementMock.groupBy.mockResolvedValueOnce([
      { type: "IN", _sum: { qty: 30 } },
      { type: "OUT", _sum: { qty: 10 } },
      { type: "ADJUST", _sum: { qty: 2 } },
    ]);

    const res = await GET(req("http://x/api/erp/inventory?productId=p1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.movements).toHaveLength(1);
    expect(body.movements[0].id).toBe("m1");
    // Decimal -> string serialization at API boundary
    expect(typeof body.movements[0].unitCost).toBe("string");
    // ISO date string
    expect(typeof body.movements[0].occurredAt).toBe("string");
    expect(body.stock).toEqual({ in: 30, out: 10, adjust: 2, balance: 20 });
  });

  it("returns 400 if productId is missing", async () => {
    const res = await GET(req("http://x/api/erp/inventory"));
    expect(res.status).toBe(400);
    expect(productMock.findFirst).not.toHaveBeenCalled();
    expect(movementMock.findMany).not.toHaveBeenCalled();
  });

  it("returns 403 when erp:read scope is missing", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      false,
    );
    const res = await GET(req("http://x/api/erp/inventory?productId=p1"));
    expect(res.status).toBe(403);
  });

  it("returns 401 when no user is authenticated", async () => {
    (getCurrentUser as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      null,
    );
    const res = await GET(req("http://x/api/erp/inventory?productId=p1"));
    expect(res.status).toBe(401);
  });

  it("scopes queries to the active tenant orgId (no cross-tenant leak)", async () => {
    await GET(req("http://x/api/erp/inventory?productId=p1"));
    // Product ownership check uses active tenant orgId
    const productArgs = productMock.findFirst.mock.calls[0]?.[0];
    expect(productArgs.where).toEqual({ id: "p1", orgId: "org_test" });
    // Both inventory queries use the same orgId
    const findManyArgs = movementMock.findMany.mock.calls[0]?.[0];
    expect(findManyArgs.where.orgId).toBe("org_test");
    expect(findManyArgs.where.productId).toBe("p1");
    const groupByArgs = movementMock.groupBy.mock.calls[0]?.[0];
    expect(groupByArgs.where.orgId).toBe("org_test");
    expect(groupByArgs.where.productId).toBe("p1");
  });

  it("returns 404 when product does not belong to active tenant", async () => {
    productMock.findFirst.mockResolvedValueOnce(null);
    const res = await GET(req("http://x/api/erp/inventory?productId=p1"));
    expect(res.status).toBe(404);
    expect(movementMock.findMany).not.toHaveBeenCalled();
    expect(movementMock.groupBy).not.toHaveBeenCalled();
  });

  it("applies type filter to movements query but not to stock totals", async () => {
    await GET(req("http://x/api/erp/inventory?productId=p1&type=OUT"));
    const findManyArgs = movementMock.findMany.mock.calls[0]?.[0];
    expect(findManyArgs.where.type).toBe("OUT");
    const groupByArgs = movementMock.groupBy.mock.calls[0]?.[0];
    // Stock totals deliberately ignore the type filter so the summary is global
    expect(groupByArgs.where.type).toBeUndefined();
  });

  it("ignores an invalid type value", async () => {
    await GET(req("http://x/api/erp/inventory?productId=p1&type=BOGUS"));
    const findManyArgs = movementMock.findMany.mock.calls[0]?.[0];
    expect(findManyArgs.where.type).toBeUndefined();
  });

  it("applies from/to date filters as a range on occurredAt", async () => {
    await GET(
      req(
        "http://x/api/erp/inventory?productId=p1&from=2026-04-01&to=2026-04-30",
      ),
    );
    const findManyArgs = movementMock.findMany.mock.calls[0]?.[0];
    expect(findManyArgs.where.occurredAt).toBeDefined();
    expect(findManyArgs.where.occurredAt.gte).toBeInstanceOf(Date);
    expect(findManyArgs.where.occurredAt.lte).toBeInstanceOf(Date);
    expect((findManyArgs.where.occurredAt.gte as Date).toISOString()).toBe(
      "2026-04-01T00:00:00.000Z",
    );
  });

  it("bare-date `to` is end-of-day inclusive (covers 23:59 records)", async () => {
    // Regression: previously a `to=2026-04-30` filter excluded a 14:00 record
    // because the bare date parsed to 00:00 of April 30. The shared
    // `parseInventoryDateParam` now expands bare dates to end-of-day for
    // the `to` edge so range filters match what the user expects.
    await GET(
      req(
        "http://x/api/erp/inventory?productId=p1&from=2026-04-01&to=2026-04-30",
      ),
    );
    const findManyArgs = movementMock.findMany.mock.calls[0]?.[0];
    const lte = findManyArgs.where.occurredAt.lte as Date;
    expect(lte.toISOString()).toBe("2026-04-30T23:59:59.999Z");
    // A movement at 14:00 on April 30 must fall within the range.
    const sample = new Date("2026-04-30T14:00:00.000Z");
    expect(sample.getTime()).toBeLessThanOrEqual(lte.getTime());
  });

  it("surfaces `truncated: true` when movements hit the 500-row cap", async () => {
    const many = Array.from({ length: 500 }, (_, i) =>
      makeMovement({ id: `m${i}` }),
    );
    movementMock.findMany.mockResolvedValueOnce(many);
    const res = await GET(req("http://x/api/erp/inventory?productId=p1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.truncated).toBe(true);
    expect(body.movements).toHaveLength(500);
  });

  it("surfaces `truncated: false` when movements are under the cap", async () => {
    movementMock.findMany.mockResolvedValueOnce([makeMovement()]);
    const res = await GET(req("http://x/api/erp/inventory?productId=p1"));
    const body = await res.json();
    expect(body.truncated).toBe(false);
  });

  it("computes balance as inSum - outSum (ADJUST not folded in)", async () => {
    movementMock.groupBy.mockResolvedValueOnce([
      { type: "IN", _sum: { qty: 100 } },
      { type: "OUT", _sum: { qty: 40 } },
      { type: "ADJUST", _sum: { qty: 5 } },
    ]);
    const res = await GET(req("http://x/api/erp/inventory?productId=p1"));
    const body = await res.json();
    expect(body.stock.balance).toBe(60);
    expect(body.stock.adjust).toBe(5);
  });

  it("caps movements at 500 rows", async () => {
    await GET(req("http://x/api/erp/inventory?productId=p1"));
    const findManyArgs = movementMock.findMany.mock.calls[0]?.[0];
    expect(findManyArgs.take).toBe(500);
    expect(findManyArgs.orderBy).toEqual({ occurredAt: "desc" });
  });
});

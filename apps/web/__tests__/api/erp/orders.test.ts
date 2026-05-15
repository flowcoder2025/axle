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
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
  };
  const organization = { findUnique: vi.fn() };
  return {
    DB_PACKAGE: "@axle/db",
    prisma: { order, organization },
  };
});

import { prisma } from "@axle/db";
const orderMock = (prisma as unknown as {
  order: Record<string, ReturnType<typeof vi.fn>>;
}).order;
const organizationMock = (prisma as unknown as {
  organization: Record<string, ReturnType<typeof vi.fn>>;
}).organization;

import { GET as GET_LIST } from "../../../app/api/erp/orders/route";
import { GET as GET_DETAIL } from "../../../app/api/erp/orders/[orderId]/route";
import { getCurrentUser, checkModulePermission } from "@axle/auth";
import { getActiveTenant } from "@/src/lib/tenant-context";

const authedUser = { id: "u1", orgId: "org_test", email: "u1@x", name: "u" };

function req(url: string): Request {
  return new Request(url, { method: "GET" });
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "o1",
    orgId: "org_test",
    type: "SALE",
    counterpartyId: null,
    counterpartyName: "ACME",
    status: "CONFIRMED",
    total: 15000,
    tax: 1500,
    occurredAt: new Date("2026-05-10"),
    source: null,
    sourceId: null,
    note: null,
    createdAt: new Date("2026-05-10"),
    updatedAt: new Date("2026-05-10"),
    ...overrides,
  };
}

function makeOrderItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "oi1",
    orderId: "o1",
    productId: "p1",
    productName: "콜라",
    qty: 10,
    unitPrice: 1500,
    lineTotal: 15000,
    product: { id: "p1", name: "콜라", sku: null },
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
  orderMock.findMany.mockResolvedValue([]);
  orderMock.count.mockResolvedValue(0);
  orderMock.findFirst.mockResolvedValue(null);
});

describe("GET /api/erp/orders (list)", () => {
  it("returns 200 with empty list + total=0 when no orders", async () => {
    const res = await GET_LIST(req("http://x/api/erp/orders"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.page).toBe(0);
    expect(body.pageSize).toBe(50);
    expect(body.truncated).toBe(false);
  });

  it("serializes orders (Decimal → string, Date → ISO)", async () => {
    orderMock.findMany.mockResolvedValueOnce([makeOrder()]);
    orderMock.count.mockResolvedValueOnce(1);
    const res = await GET_LIST(req("http://x/api/erp/orders"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders).toHaveLength(1);
    expect(typeof body.orders[0].total).toBe("string");
    expect(typeof body.orders[0].tax).toBe("string");
    expect(typeof body.orders[0].occurredAt).toBe("string");
  });

  it("scopes the prisma query to the active tenant orgId", async () => {
    await GET_LIST(req("http://x/api/erp/orders"));
    const findArgs = orderMock.findMany.mock.calls[0]?.[0];
    expect(findArgs.where.orgId).toBe("org_test");
    const countArgs = orderMock.count.mock.calls[0]?.[0];
    expect(countArgs.where.orgId).toBe("org_test");
  });

  it("applies type filter when SALE/PURCHASE provided", async () => {
    await GET_LIST(req("http://x/api/erp/orders?type=PURCHASE"));
    const findArgs = orderMock.findMany.mock.calls[0]?.[0];
    expect(findArgs.where.type).toBe("PURCHASE");
  });

  it("ignores invalid type values", async () => {
    await GET_LIST(req("http://x/api/erp/orders?type=BOGUS"));
    const findArgs = orderMock.findMany.mock.calls[0]?.[0];
    expect(findArgs.where.type).toBeUndefined();
  });

  it("applies status filter when DRAFT/CONFIRMED/CANCELLED provided", async () => {
    await GET_LIST(req("http://x/api/erp/orders?status=CANCELLED"));
    const findArgs = orderMock.findMany.mock.calls[0]?.[0];
    expect(findArgs.where.status).toBe("CANCELLED");
  });

  it("applies counterpartyName substring filter (case-insensitive)", async () => {
    await GET_LIST(req("http://x/api/erp/orders?q=acme"));
    const findArgs = orderMock.findMany.mock.calls[0]?.[0];
    expect(findArgs.where.counterpartyName).toEqual({
      contains: "acme",
      mode: "insensitive",
    });
  });

  it("applies from/to occurredAt range filter", async () => {
    await GET_LIST(
      req("http://x/api/erp/orders?from=2026-04-01&to=2026-04-30"),
    );
    const findArgs = orderMock.findMany.mock.calls[0]?.[0];
    expect(findArgs.where.occurredAt.gte).toBeInstanceOf(Date);
    expect(findArgs.where.occurredAt.lte).toBeInstanceOf(Date);
  });

  it("paginates with skip = page * 50, take = 50", async () => {
    await GET_LIST(req("http://x/api/erp/orders?page=2"));
    const findArgs = orderMock.findMany.mock.calls[0]?.[0];
    expect(findArgs.skip).toBe(100);
    expect(findArgs.take).toBe(50);
  });

  it("computes truncated flag from total vs (page+1)*pageSize", async () => {
    orderMock.count.mockResolvedValueOnce(120);
    orderMock.findMany.mockResolvedValueOnce(new Array(50).fill(0).map(() => makeOrder()));
    const res = await GET_LIST(req("http://x/api/erp/orders?page=0"));
    const body = await res.json();
    expect(body.truncated).toBe(true); // 120 > 50

    orderMock.count.mockResolvedValueOnce(120);
    orderMock.findMany.mockResolvedValueOnce(new Array(20).fill(0).map(() => makeOrder()));
    const res2 = await GET_LIST(req("http://x/api/erp/orders?page=2"));
    const body2 = await res2.json();
    expect(body2.truncated).toBe(false); // 120 not > 150
  });

  it("returns 401 when no user is authenticated", async () => {
    (getCurrentUser as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      null,
    );
    const res = await GET_LIST(req("http://x/api/erp/orders"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when erp:read scope is missing", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      false,
    );
    const res = await GET_LIST(req("http://x/api/erp/orders"));
    expect(res.status).toBe(403);
  });
});

describe("GET /api/erp/orders/[orderId] (detail)", () => {
  it("returns 200 with items hydrated when order belongs to tenant", async () => {
    orderMock.findFirst.mockResolvedValueOnce({
      ...makeOrder(),
      items: [makeOrderItem()],
    });
    const res = await GET_DETAIL(req("http://x/api/erp/orders/o1"), {
      params: Promise.resolve({ orderId: "o1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("o1");
    expect(body.items).toHaveLength(1);
    expect(body.items[0].productName).toBe("콜라");
    expect(typeof body.items[0].unitPrice).toBe("string");
    expect(typeof body.items[0].lineTotal).toBe("string");
  });

  it("scopes findFirst to active tenant orgId (no cross-tenant leak)", async () => {
    await GET_DETAIL(req("http://x/api/erp/orders/o1"), {
      params: Promise.resolve({ orderId: "o1" }),
    });
    const args = orderMock.findFirst.mock.calls[0]?.[0];
    expect(args.where).toEqual({ id: "o1", orgId: "org_test" });
    // Items must be fully hydrated with product snapshot
    expect(args.include.items.include.product.select).toEqual({
      id: true,
      name: true,
      sku: true,
    });
  });

  it("returns 404 when the order is not in the active tenant", async () => {
    orderMock.findFirst.mockResolvedValueOnce(null);
    const res = await GET_DETAIL(req("http://x/api/erp/orders/other"), {
      params: Promise.resolve({ orderId: "other" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 401 when no user is authenticated", async () => {
    (getCurrentUser as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      null,
    );
    const res = await GET_DETAIL(req("http://x/api/erp/orders/o1"), {
      params: Promise.resolve({ orderId: "o1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when erp:read scope is missing", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      false,
    );
    const res = await GET_DETAIL(req("http://x/api/erp/orders/o1"), {
      params: Promise.resolve({ orderId: "o1" }),
    });
    expect(res.status).toBe(403);
  });
});

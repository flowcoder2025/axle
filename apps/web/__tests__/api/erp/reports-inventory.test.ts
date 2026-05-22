/**
 * Phase 21 WI-730-feat — inventory-turnover + dead-stock report tests.
 *
 * Covers both endpoints. The two routes share the same mock infrastructure
 * because both read InventoryMovement + Product.
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
  const $queryRawUnsafe = vi.fn();
  const product = { findMany: vi.fn() };
  const organization = { findUnique: vi.fn() };
  return {
    DB_PACKAGE: "@axle/db",
    prisma: { $queryRawUnsafe, product, organization },
  };
});

import { prisma } from "@axle/db";
import { getCurrentUser, checkModulePermission } from "@axle/auth";
import { getActiveTenant } from "@/src/lib/tenant-context";
import { GET as turnoverGET } from "../../../app/api/erp/reports/inventory-turnover/route";
import { GET as deadStockGET } from "../../../app/api/erp/reports/dead-stock/route";

const queryMock = (prisma as unknown as {
  $queryRawUnsafe: ReturnType<typeof vi.fn>;
}).$queryRawUnsafe;
const productMock = (prisma as unknown as {
  product: Record<string, ReturnType<typeof vi.fn>>;
}).product;
const organizationMock = (prisma as unknown as {
  organization: Record<string, ReturnType<typeof vi.fn>>;
}).organization;

const authedUser = { id: "u1", orgId: "org_test", email: "u1@x", name: "u" };

function turnoverReq(query: string): Request {
  return new Request(`http://x/api/erp/reports/inventory-turnover?${query}`);
}
function deadStockReq(query: string): Request {
  return new Request(`http://x/api/erp/reports/dead-stock?${query}`);
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

  queryMock.mockResolvedValue([]);
  productMock.findMany.mockResolvedValue([]);
});

// ---------------- inventory-turnover ----------------

describe("GET /api/erp/reports/inventory-turnover — auth + validation", () => {
  it("401 without user", async () => {
    (getCurrentUser as unknown as { mockResolvedValue: Function }).mockResolvedValue(null);
    const res = await turnoverGET(turnoverReq(""));
    expect(res.status).toBe(401);
  });

  it("403 without erp:read", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      false,
    );
    const res = await turnoverGET(turnoverReq(""));
    expect(res.status).toBe(403);
  });

  it("400 when from/to format invalid", async () => {
    const res = await turnoverGET(turnoverReq("from=2026/05/01"));
    expect(res.status).toBe(400);
  });

  it("400 when to < from", async () => {
    const res = await turnoverGET(
      turnoverReq("from=2026-05-15&to=2026-05-01"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.message).toContain("REPORT_BAD_RANGE");
  });
});

describe("GET /api/erp/reports/inventory-turnover — aggregation", () => {
  it("returns empty rows when no movements + accepts defaults (90-day trailing window)", async () => {
    queryMock.mockResolvedValueOnce([]);
    const res = await turnoverGET(turnoverReq(""));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toEqual([]);
    expect(body.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("sorts by turnoverPerDay desc + hydrates product info", async () => {
    queryMock.mockResolvedValueOnce([
      {
        productId: "p_fast",
        total_in: 0,
        total_out: 100, // 100 / 10 days = 10/day
        last_at: new Date("2026-05-20T10:00:00.000Z"),
        movement_count: 8,
      },
      {
        productId: "p_slow",
        total_in: 5,
        total_out: 2, // 2 / 10 days = 0.2/day
        last_at: new Date("2026-05-10T10:00:00.000Z"),
        movement_count: 3,
      },
    ]);
    productMock.findMany.mockResolvedValue([
      { id: "p_fast", name: "콜라", sku: "SKU-A", unit: "병" },
      { id: "p_slow", name: "사이다", sku: null, unit: "병" },
    ]);
    const res = await turnoverGET(
      turnoverReq("from=2026-05-10&to=2026-05-19&limit=10"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows[0].productId).toBe("p_fast");
    expect(body.rows[0].productName).toBe("콜라");
    expect(body.rows[0].totalOut).toBe(100);
    // periodDays = 10, turnover = 10.0000
    expect(body.rows[0].turnoverPerDay).toBe("10.0000");
    expect(body.rows[1].productId).toBe("p_slow");
    expect(body.rows[1].turnoverPerDay).toBe("0.2000");
  });

  it("drops rows whose product no longer exists (archived/deleted)", async () => {
    queryMock.mockResolvedValueOnce([
      {
        productId: "p_ghost",
        total_in: 0,
        total_out: 50,
        last_at: new Date("2026-05-15T10:00:00.000Z"),
        movement_count: 2,
      },
    ]);
    productMock.findMany.mockResolvedValue([]); // no matching product
    const res = await turnoverGET(turnoverReq("from=2026-05-01&to=2026-05-19"));
    const body = await res.json();
    expect(body.rows).toEqual([]);
  });
});

// ---------------- dead-stock ----------------

describe("GET /api/erp/reports/dead-stock — auth + validation", () => {
  it("401 without user", async () => {
    (getCurrentUser as unknown as { mockResolvedValue: Function }).mockResolvedValue(null);
    const res = await deadStockGET(deadStockReq(""));
    expect(res.status).toBe(401);
  });

  it("400 when days out of range", async () => {
    const res = await deadStockGET(deadStockReq("days=0"));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/erp/reports/dead-stock — aggregation", () => {
  it("RED — Product with no OUT movement at all surfaces as dead-stock candidate", async () => {
    queryMock.mockResolvedValueOnce([]); // no OUT records at all
    productMock.findMany.mockResolvedValue([
      {
        id: "p_never",
        name: "재고만 있는 상품",
        sku: "SKU-N",
        unit: "개",
        unitPrice: 1000,
      },
    ]);
    const res = await deadStockGET(deadStockReq("days=60"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.thresholdDays).toBe(60);
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toMatchObject({
      productId: "p_never",
      productName: "재고만 있는 상품",
      lastOutAt: null,
      daysSinceLastOut: null,
    });
  });

  it("excludes products with a recent OUT inside the threshold", async () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const old = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    queryMock.mockResolvedValueOnce([
      { productId: "p_recent", last_out: recent },
      { productId: "p_old", last_out: old },
    ]);
    productMock.findMany.mockResolvedValue([
      {
        id: "p_recent",
        name: "Recently Sold",
        sku: null,
        unit: "개",
        unitPrice: 100,
      },
      { id: "p_old", name: "Dusty", sku: "DUST", unit: "개", unitPrice: 500 },
      { id: "p_never", name: "Never", sku: null, unit: "개", unitPrice: 999 },
    ]);
    const res = await deadStockGET(deadStockReq("days=60"));
    const body = await res.json();
    // p_recent should NOT appear (last_out within threshold).
    const ids = body.rows.map((r: { productId: string }) => r.productId);
    expect(ids).not.toContain("p_recent");
    expect(ids).toContain("p_old");
    expect(ids).toContain("p_never");
  });

  it("sorts never-moved products first, then by daysSinceLastOut desc", async () => {
    const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
    const olderDate = new Date(Date.now() - 300 * 24 * 60 * 60 * 1000);
    queryMock.mockResolvedValueOnce([
      { productId: "p_200d", last_out: oldDate },
      { productId: "p_300d", last_out: olderDate },
    ]);
    productMock.findMany.mockResolvedValue([
      {
        id: "p_never",
        name: "Never",
        sku: null,
        unit: "개",
        unitPrice: 100,
      },
      {
        id: "p_200d",
        name: "200d dead",
        sku: null,
        unit: "개",
        unitPrice: 200,
      },
      {
        id: "p_300d",
        name: "300d dead",
        sku: null,
        unit: "개",
        unitPrice: 300,
      },
    ]);
    const res = await deadStockGET(deadStockReq("days=60"));
    const body = await res.json();
    // Never first, then 300d, then 200d.
    expect(body.rows.map((r: { productId: string }) => r.productId)).toEqual([
      "p_never",
      "p_300d",
      "p_200d",
    ]);
  });

  it("uses default threshold = 60 days when 'days' omitted", async () => {
    queryMock.mockResolvedValueOnce([]);
    productMock.findMany.mockResolvedValue([]);
    const res = await deadStockGET(deadStockReq(""));
    const body = await res.json();
    expect(body.thresholdDays).toBe(60);
  });

  it("Decimal unitPrice serialized as string", async () => {
    queryMock.mockResolvedValueOnce([]);
    productMock.findMany.mockResolvedValue([
      {
        id: "p_x",
        name: "X",
        sku: null,
        unit: "개",
        unitPrice: { toString: () => "1234.50" } as never,
      },
    ]);
    const res = await deadStockGET(deadStockReq(""));
    const body = await res.json();
    expect(body.rows[0].unitPrice).toBe("1234.50");
  });
});

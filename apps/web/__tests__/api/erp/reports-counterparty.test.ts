/**
 * Phase 21 WI-728-feat — GET /api/erp/reports/counterparty tests.
 *
 * Covers:
 *   - auth (erp:read scope required)
 *   - query validation (from/to/type/limit)
 *   - mv aggregation pipeline (rows + monthly breakdown + totals)
 *   - Decimal/Date string serialization (feedback_decimal_serialization)
 *   - dataAsOf surfaces the latest MvRefreshLog.refreshedAt
 *   - RED: type=OTHER → 400; from > to → 400
 *
 * The mv query is mocked via `prisma.$queryRawUnsafe` — we return a
 * deterministic row set the report function then groups + sorts.
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
  const erpCounterparty = { findMany: vi.fn() };
  const mvRefreshLog = { findFirst: vi.fn() };
  const organization = { findUnique: vi.fn() };
  return {
    DB_PACKAGE: "@axle/db",
    prisma: { $queryRawUnsafe, erpCounterparty, mvRefreshLog, organization },
  };
});

import { prisma } from "@axle/db";
import { getCurrentUser, checkModulePermission } from "@axle/auth";
import { getActiveTenant } from "@/src/lib/tenant-context";
import { GET } from "../../../app/api/erp/reports/counterparty/route";

const queryMock = (prisma as unknown as {
  $queryRawUnsafe: ReturnType<typeof vi.fn>;
}).$queryRawUnsafe;
const cpMock = (prisma as unknown as {
  erpCounterparty: Record<string, ReturnType<typeof vi.fn>>;
}).erpCounterparty;
const refreshMock = (prisma as unknown as {
  mvRefreshLog: Record<string, ReturnType<typeof vi.fn>>;
}).mvRefreshLog;
const organizationMock = (prisma as unknown as {
  organization: Record<string, ReturnType<typeof vi.fn>>;
}).organization;

const authedUser = { id: "u1", orgId: "org_test", email: "u1@x", name: "u" };

function reportReq(query: string): Request {
  return new Request(`http://x/api/erp/reports/counterparty?${query}`, {
    method: "GET",
  });
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

  // Default: empty mv, no refresh yet
  queryMock.mockResolvedValue([]);
  cpMock.findMany.mockResolvedValue([]);
  refreshMock.findFirst.mockResolvedValue(null);
});

describe("GET /api/erp/reports/counterparty — auth", () => {
  it("401 when no user", async () => {
    (getCurrentUser as unknown as { mockResolvedValue: Function }).mockResolvedValue(null);
    const res = await GET(reportReq("from=2026-01&to=2026-05&type=SALE"));
    expect(res.status).toBe(401);
  });

  it("403 when erp:read scope is missing", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      false,
    );
    const res = await GET(reportReq("from=2026-01&to=2026-05&type=SALE"));
    expect(res.status).toBe(403);
  });
});

describe("GET /api/erp/reports/counterparty — query validation", () => {
  it("400 when 'from' missing", async () => {
    const res = await GET(reportReq("to=2026-05&type=SALE"));
    expect(res.status).toBe(400);
  });

  it("400 when 'type' is not SALE/PURCHASE", async () => {
    const res = await GET(reportReq("from=2026-01&to=2026-05&type=OTHER"));
    expect(res.status).toBe(400);
  });

  it("400 when 'from' is not YYYY-MM", async () => {
    const res = await GET(reportReq("from=2026/01&to=2026-05&type=SALE"));
    expect(res.status).toBe(400);
  });

  it("400 when to < from (REPORT_BAD_RANGE)", async () => {
    const res = await GET(reportReq("from=2026-05&to=2026-01&type=SALE"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.message).toContain("REPORT_BAD_RANGE");
  });

  it("400 when limit out of range", async () => {
    const res = await GET(reportReq("from=2026-01&to=2026-05&type=SALE&limit=500"));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/erp/reports/counterparty — aggregation", () => {
  it("groups mv rows by counterparty, sums totals, returns leaderboard sorted desc", async () => {
    queryMock.mockResolvedValueOnce([
      // cp_A: 2026-01 1000.00, 2026-02 500.50
      { counterpartyId: "cp_A", year: 2026, month: 1, total_amount: "1000.00", total_qty: 10, line_count: 2 },
      { counterpartyId: "cp_A", year: 2026, month: 2, total_amount: "500.50", total_qty: 5, line_count: 1 },
      // cp_B: 2026-02 750.25
      { counterpartyId: "cp_B", year: 2026, month: 2, total_amount: "750.25", total_qty: 3, line_count: 1 },
      // ad-hoc (no counterparty): 2026-03 100.00
      { counterpartyId: null, year: 2026, month: 3, total_amount: "100.00", total_qty: 1, line_count: 1 },
    ]);
    cpMock.findMany.mockResolvedValue([
      { id: "cp_A", name: "에이비씨" },
      { id: "cp_B", name: "다른거래처" },
    ]);
    refreshMock.findFirst.mockResolvedValue({
      refreshedAt: new Date("2026-05-22T02:00:00.000Z"),
    });

    const res = await GET(reportReq("from=2026-01&to=2026-05&type=PURCHASE&limit=10"));
    expect(res.status).toBe(200);
    const body = await res.json();

    // Top of leaderboard is cp_A (1500.50).
    expect(body.rows[0]).toMatchObject({
      counterpartyId: "cp_A",
      counterpartyName: "에이비씨",
      totalAmount: "1500.50",
      totalQty: 15,
      lineCount: 3,
    });
    expect(body.rows[0].monthlyBreakdown).toEqual([
      { month: "2026-01", totalAmount: "1000.00" },
      { month: "2026-02", totalAmount: "500.50" },
    ]);
    expect(body.rows[1].counterpartyId).toBe("cp_B");
    expect(body.rows[1].totalAmount).toBe("750.25");
    // ad-hoc null bucket present
    const adhoc = body.rows.find((r: { counterpartyId: string | null }) => r.counterpartyId === null);
    expect(adhoc?.counterpartyName).toBeNull();
    expect(adhoc?.totalAmount).toBe("100.00");

    // Aggregate totals + freshness
    expect(body.totalAmount).toBe("2350.75");
    expect(body.dataAsOf).toBe("2026-05-22T02:00:00.000Z");
    expect(body.filters).toEqual({
      from: "2026-01",
      to: "2026-05",
      type: "PURCHASE",
      limit: 10,
    });
    expect(typeof body.generatedAt).toBe("string");
  });

  it("returns dataAsOf: null when the mv has never refreshed", async () => {
    queryMock.mockResolvedValueOnce([]);
    refreshMock.findFirst.mockResolvedValue(null);
    const res = await GET(reportReq("from=2026-01&to=2026-05&type=SALE"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dataAsOf).toBeNull();
    expect(body.rows).toEqual([]);
    expect(body.totalAmount).toBe("0.00");
  });

  it("uses SQL parameters (no string interpolation of caller input)", async () => {
    queryMock.mockResolvedValueOnce([]);
    await GET(reportReq("from=2026-03&to=2026-05&type=SALE"));
    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, ...params] = queryMock.mock.calls[0]!;
    // mv name + sentinel comparisons are in the static SQL.
    expect(sql).toContain("mv_erp_monthly_summary");
    expect(sql).toContain("BETWEEN $3 AND $4");
    // Parameter ordering: orgId, type, fromInt, toInt
    expect(params).toEqual(["org_test", "SALE", 202603, 202605]);
  });

  it("respects limit query param (caps to 100)", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      counterpartyId: `cp_${i}`,
      year: 2026,
      month: 1,
      total_amount: `${(30 - i) * 100}.00`,
      total_qty: 1,
      line_count: 1,
    }));
    queryMock.mockResolvedValueOnce(rows);
    cpMock.findMany.mockResolvedValue(
      rows.map((r) => ({ id: r.counterpartyId, name: `name_${r.counterpartyId}` })),
    );
    const res = await GET(reportReq("from=2026-01&to=2026-05&type=SALE&limit=5"));
    const body = await res.json();
    expect(body.rows).toHaveLength(5);
    // Descending sort: top entry is the largest
    expect(body.rows[0].counterpartyId).toBe("cp_0");
  });
});

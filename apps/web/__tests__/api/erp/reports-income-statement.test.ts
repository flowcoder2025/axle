/**
 * Phase 21 WI-729-feat — GET /api/erp/reports/income-statement.
 *
 * Covers:
 *   - auth (erp:read scope)
 *   - query validation (year required, month optional 1-12)
 *   - hierarchical tree assembly (children → parent rollup)
 *   - operating + net income formulas
 *   - empty case (RED AC #4): 200 + zeros + empty rows
 *   - dataAsOf surfaces MvRefreshLog
 *   - orphan coaCode (no matching ChartOfAccounts row) is skipped
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
  const chartOfAccounts = { findMany: vi.fn() };
  const mvRefreshLog = { findFirst: vi.fn() };
  const organization = { findUnique: vi.fn() };
  return {
    DB_PACKAGE: "@axle/db",
    prisma: { $queryRawUnsafe, chartOfAccounts, mvRefreshLog, organization },
  };
});

import { prisma } from "@axle/db";
import { getCurrentUser, checkModulePermission } from "@axle/auth";
import { getActiveTenant } from "@/src/lib/tenant-context";
import { GET } from "../../../app/api/erp/reports/income-statement/route";

const queryMock = (prisma as unknown as {
  $queryRawUnsafe: ReturnType<typeof vi.fn>;
}).$queryRawUnsafe;
const coaMock = (prisma as unknown as {
  chartOfAccounts: Record<string, ReturnType<typeof vi.fn>>;
}).chartOfAccounts;
const refreshMock = (prisma as unknown as {
  mvRefreshLog: Record<string, ReturnType<typeof vi.fn>>;
}).mvRefreshLog;
const organizationMock = (prisma as unknown as {
  organization: Record<string, ReturnType<typeof vi.fn>>;
}).organization;

const authedUser = { id: "u1", orgId: "org_test", email: "u1@x", name: "u" };

function reportReq(query: string): Request {
  return new Request(`http://x/api/erp/reports/income-statement?${query}`);
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
  coaMock.findMany.mockResolvedValue([]);
  refreshMock.findFirst.mockResolvedValue(null);
});

describe("GET /api/erp/reports/income-statement — auth + validation", () => {
  it("401 when no user", async () => {
    (getCurrentUser as unknown as { mockResolvedValue: Function }).mockResolvedValue(null);
    const res = await GET(reportReq("year=2026"));
    expect(res.status).toBe(401);
  });

  it("403 when erp:read missing", async () => {
    (checkModulePermission as unknown as { mockResolvedValue: Function }).mockResolvedValue(
      false,
    );
    const res = await GET(reportReq("year=2026"));
    expect(res.status).toBe(403);
  });

  it("400 when year is missing", async () => {
    const res = await GET(reportReq(""));
    expect(res.status).toBe(400);
  });

  it("400 when month is out of range", async () => {
    const res = await GET(reportReq("year=2026&month=13"));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/erp/reports/income-statement — empty (RED AC #4)", () => {
  it("returns 200 + zeros when no orders in the period", async () => {
    queryMock.mockResolvedValueOnce([]);
    const res = await GET(reportReq("year=2026&month=5"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.year).toBe(2026);
    expect(body.month).toBe(5);
    expect(body.operatingIncome).toBe("0.00");
    expect(body.netIncome).toBe("0.00");
    for (const cat of ["REVENUE", "COGS", "OPEX", "NON_OPERATING", "OTHER"]) {
      expect(body.categories[cat].total).toBe("0.00");
      expect(body.categories[cat].rows).toEqual([]);
    }
    expect(body.dataAsOf).toBeNull();
  });
});

describe("GET /api/erp/reports/income-statement — hierarchical aggregation", () => {
  it("rolls leaf rows into parents + computes operating/net income", async () => {
    // mv rows: 401 (상품매출, +500), 404 (용역매출, +1500),
    //          451 (상품매입, +300), 514 (통신비, +50)
    queryMock.mockResolvedValueOnce([
      { coaCode: "401", total_amount: "500.00" },
      { coaCode: "404", total_amount: "1500.00" },
      { coaCode: "451", total_amount: "300.00" },
      { coaCode: "514", total_amount: "50.00" },
    ]);
    // Tenant COA includes the 4 used codes + parents.
    coaMock.findMany
      .mockResolvedValueOnce([
        { code: "401", name: "상품매출", category: "REVENUE", parentCode: "400" },
        { code: "404", name: "용역매출", category: "REVENUE", parentCode: "400" },
        { code: "451", name: "상품매입", category: "COGS", parentCode: "450" },
        { code: "514", name: "통신비", category: "OPEX", parentCode: "500" },
      ])
      // Second call for missing parents
      .mockResolvedValueOnce([
        { code: "400", name: "매출", category: "REVENUE", parentCode: null },
        { code: "450", name: "매출원가", category: "COGS", parentCode: null },
        { code: "500", name: "판매비와관리비", category: "OPEX", parentCode: null },
      ]);
    refreshMock.findFirst.mockResolvedValue({
      refreshedAt: new Date("2026-05-22T02:00:00.000Z"),
    });

    const res = await GET(reportReq("year=2026"));
    expect(res.status).toBe(200);
    const body = await res.json();

    // REVENUE: 400 root with 2 children (401, 404)
    expect(body.categories.REVENUE.total).toBe("2000.00");
    expect(body.categories.REVENUE.rows).toHaveLength(1);
    const revRoot = body.categories.REVENUE.rows[0];
    expect(revRoot.code).toBe("400");
    expect(revRoot.total).toBe("2000.00");
    expect(revRoot.children).toHaveLength(2);
    expect(revRoot.children.map((c: { code: string }) => c.code).sort()).toEqual([
      "401",
      "404",
    ]);

    // COGS: 450 → 451
    expect(body.categories.COGS.total).toBe("300.00");
    expect(body.categories.COGS.rows[0].code).toBe("450");

    // OPEX: 500 → 514
    expect(body.categories.OPEX.total).toBe("50.00");
    expect(body.categories.OPEX.rows[0].code).toBe("500");
    expect(body.categories.OPEX.rows[0].children[0].code).toBe("514");

    // Operating income = 2000 - 300 - 50 = 1650
    expect(body.operatingIncome).toBe("1650.00");
    // No non-operating rows → netIncome === operatingIncome
    expect(body.netIncome).toBe("1650.00");

    expect(body.dataAsOf).toBe("2026-05-22T02:00:00.000Z");
  });

  it("non-operating: revenue(900) and expense(950) net into operatingIncome", async () => {
    queryMock.mockResolvedValueOnce([
      { coaCode: "401", total_amount: "1000.00" }, // REVENUE
      { coaCode: "901", total_amount: "200.00" }, // 이자수익 (NON_OPERATING +)
      { coaCode: "951", total_amount: "80.00" }, //  이자비용 (NON_OPERATING -)
    ]);
    coaMock.findMany
      .mockResolvedValueOnce([
        { code: "401", name: "상품매출", category: "REVENUE", parentCode: "400" },
        { code: "901", name: "이자수익", category: "NON_OPERATING", parentCode: "900" },
        { code: "951", name: "이자비용", category: "NON_OPERATING", parentCode: "950" },
      ])
      .mockResolvedValueOnce([
        { code: "400", name: "매출", category: "REVENUE", parentCode: null },
        { code: "900", name: "영업외수익", category: "NON_OPERATING", parentCode: null },
        { code: "950", name: "영업외비용", category: "NON_OPERATING", parentCode: null },
      ]);
    const res = await GET(reportReq("year=2026"));
    const body = await res.json();
    // REVENUE 1000, COGS 0, OPEX 0 → operatingIncome 1000
    expect(body.operatingIncome).toBe("1000.00");
    // Non-op net: +200 (901) - 80 (951) = +120
    // netIncome = 1000 + 120 = 1120
    expect(body.netIncome).toBe("1120.00");
    expect(body.categories.NON_OPERATING.total).toBe("280.00"); // sum of absolute values per category convention
  });

  it("orphan coaCode (no ChartOfAccounts row) is skipped", async () => {
    queryMock.mockResolvedValueOnce([
      { coaCode: "401", total_amount: "100.00" },
      { coaCode: "ZZZ", total_amount: "9999.00" }, // orphan
    ]);
    coaMock.findMany
      .mockResolvedValueOnce([
        { code: "401", name: "상품매출", category: "REVENUE", parentCode: "400" },
      ])
      .mockResolvedValueOnce([
        { code: "400", name: "매출", category: "REVENUE", parentCode: null },
      ]);
    const res = await GET(reportReq("year=2026"));
    const body = await res.json();
    expect(body.categories.REVENUE.total).toBe("100.00");
    expect(body.operatingIncome).toBe("100.00");
  });

  it("month filter only included when present (full year by default)", async () => {
    queryMock.mockResolvedValueOnce([]);
    await GET(reportReq("year=2026"));
    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, ...params] = queryMock.mock.calls[0]!;
    expect(sql).not.toContain("AND month =");
    expect(params).toEqual(["org_test", 2026]);
  });

  it("month filter included when month query param is present", async () => {
    queryMock.mockResolvedValueOnce([]);
    await GET(reportReq("year=2026&month=5"));
    const [sql, ...params] = queryMock.mock.calls[0]!;
    expect(sql).toContain("AND month = 5");
    expect(params).toEqual(["org_test", 2026]);
  });

  it("rejects coaCode null mv rows (UNCLASSIFIED is excluded from IS)", async () => {
    queryMock.mockResolvedValueOnce([
      { coaCode: null, total_amount: "999.99" },
      { coaCode: "401", total_amount: "10.00" },
    ]);
    coaMock.findMany
      .mockResolvedValueOnce([
        { code: "401", name: "상품매출", category: "REVENUE", parentCode: "400" },
      ])
      .mockResolvedValueOnce([
        { code: "400", name: "매출", category: "REVENUE", parentCode: null },
      ]);
    const res = await GET(reportReq("year=2026"));
    const body = await res.json();
    expect(body.categories.REVENUE.total).toBe("10.00");
  });
});

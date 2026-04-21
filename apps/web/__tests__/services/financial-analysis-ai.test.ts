/**
 * Unit tests for buildFinancialAnalysis (WI-228).
 *
 * Covers:
 *   - Ratio + growth metric calculation from mocked ClientFinancial rows
 *   - AI narrative/recommendation parsing from dispatcher output
 *   - Graceful fallback when dispatch throws or returns empty text
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ------------------------------------------------------------------

const mockClientOps = { findUnique: vi.fn() };
const mockClientFinancialOps = { findMany: vi.fn() };

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    client: mockClientOps,
    clientFinancial: mockClientFinancialOps,
  },
}));

const mockDispatch = vi.fn();
const mockHasHandler = vi.fn().mockReturnValue(true);
const mockRegisterBuiltin = vi.fn();

vi.mock("@axle/ai", () => ({
  dispatch: mockDispatch,
  hasHandler: mockHasHandler,
  registerBuiltinHandlers: mockRegisterBuiltin,
}));

// --- Fixtures ---------------------------------------------------------------

const CLIENT = { id: "client-1", name: "테크Corp" };

const FIN_2025 = {
  id: "fin-2025",
  clientId: "client-1",
  year: 2025,
  revenue: "1200000000",
  operatingProfit: "150000000",
  netProfit: "120000000",
  totalAssets: "2000000000",
  totalLiabilities: "800000000",
  totalEquity: "1200000000",
  creditRating: "A",
  source: "DART",
};

const FIN_2024 = {
  id: "fin-2024",
  clientId: "client-1",
  year: 2024,
  revenue: "1000000000",
  operatingProfit: "100000000",
  netProfit: "80000000",
  totalAssets: "1800000000",
  totalLiabilities: "900000000",
  totalEquity: "900000000",
  creditRating: "BBB",
  source: "DART",
};

const FIN_2023 = {
  id: "fin-2023",
  clientId: "client-1",
  year: 2023,
  revenue: "900000000",
  operatingProfit: "70000000",
  netProfit: "50000000",
  totalAssets: "1600000000",
  totalLiabilities: "900000000",
  totalEquity: "700000000",
  creditRating: "BBB",
  source: "DART",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockClientOps.findUnique.mockResolvedValue(CLIENT);
  mockClientFinancialOps.findMany.mockResolvedValue([FIN_2025, FIN_2024, FIN_2023]);
  mockHasHandler.mockReturnValue(true);
});

// --- Tests ------------------------------------------------------------------

describe("buildFinancialAnalysis", () => {
  it("computes metrics (ratios + YoY growth) and AI narrative/recommendations", async () => {
    mockDispatch.mockResolvedValue({
      text: [
        "테크Corp의 2025년 매출은 전년 대비 크게 성장했습니다.",
        "",
        "영업이익률과 ROE 모두 안정적입니다.",
        "",
        "개선 컨설팅:",
        "- 매출 채널 다각화를 추진하세요.",
        "- 부채 구조를 최적화하세요.",
        "- R&D 투자를 확대하세요.",
      ].join("\n"),
      model: "claude-haiku-4-5-20251001",
    });

    const { buildFinancialAnalysis } = await import(
      "../../lib/services/financial-analysis"
    );
    const result = await buildFinancialAnalysis("client-1", 2025);

    // DB queries
    expect(mockClientOps.findUnique).toHaveBeenCalledWith({
      where: { id: "client-1" },
      select: { id: true, name: true },
    });
    expect(mockClientFinancialOps.findMany).toHaveBeenCalledWith({
      where: { clientId: "client-1", year: { in: [2025, 2024, 2023] } },
      orderBy: { year: "desc" },
    });

    // Metrics: ratios
    expect(result.metrics.operatingMargin).toBe(12.5); // 150M / 1.2B
    expect(result.metrics.netMargin).toBe(10); // 120M / 1.2B
    expect(result.metrics.roe).toBe(10); // 120M / 1.2B
    expect(result.metrics.debtRatio).toBeCloseTo(66.67, 1); // 800M / 1.2B

    // Metrics: YoY growth
    expect(result.metrics.revenueGrowth).toBe(20); // 1.2B / 1.0B − 1
    expect(result.metrics.operatingProfitGrowth).toBe(50);
    expect(result.metrics.netProfitGrowth).toBe(50);

    // Historical — 3 years ordered desc
    expect(result.historical).toHaveLength(3);
    expect(result.historical[0]!.year).toBe(2025);
    expect(result.historical[1]!.year).toBe(2024);
    expect(result.historical[2]!.year).toBe(2023);

    // Narrative + recommendations
    expect(result.narrative).toContain("2025년 매출은 전년 대비 크게 성장");
    expect(result.recommendations).toEqual([
      "매출 채널 다각화를 추진하세요.",
      "부채 구조를 최적화하세요.",
      "R&D 투자를 확대하세요.",
    ]);
    expect(result.aiModel).toBe("claude-haiku-4-5-20251001");
    expect(result.fallbackUsed).toBe(false);

    // Dispatcher was called with FINANCIAL_ANALYSIS + serialized payload
    expect(mockDispatch).toHaveBeenCalledWith(
      "FINANCIAL_ANALYSIS",
      expect.objectContaining({
        clientName: "테크Corp",
        financials: expect.stringContaining("테크Corp"),
      }),
    );
  });

  it("falls back to template narrative when dispatch throws", async () => {
    mockDispatch.mockRejectedValue(new Error("AI provider unavailable"));

    const { buildFinancialAnalysis } = await import(
      "../../lib/services/financial-analysis"
    );
    const result = await buildFinancialAnalysis("client-1", 2025);

    expect(result.fallbackUsed).toBe(true);
    expect(result.aiModel).toBeNull();
    expect(result.narrative).toContain("테크Corp");
    expect(result.narrative).toContain("2025년");
    expect(result.recommendations.length).toBeGreaterThan(0);
    // Metrics still computed
    expect(result.metrics.operatingMargin).toBe(12.5);
    expect(result.metrics.revenueGrowth).toBe(20);
  });

  it("falls back when AI returns empty text", async () => {
    mockDispatch.mockResolvedValue({ text: "   ", model: "test-model" });

    const { buildFinancialAnalysis } = await import(
      "../../lib/services/financial-analysis"
    );
    const result = await buildFinancialAnalysis("client-1", 2025);

    expect(result.fallbackUsed).toBe(true);
    expect(result.narrative.length).toBeGreaterThan(0);
  });

  it("throws when the target year has no ClientFinancial row", async () => {
    mockClientFinancialOps.findMany.mockResolvedValue([FIN_2024]);

    const { buildFinancialAnalysis } = await import(
      "../../lib/services/financial-analysis"
    );

    await expect(buildFinancialAnalysis("client-1", 2025)).rejects.toThrow(
      "No financial data for client client-1 year 2025",
    );
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("throws when client is not found", async () => {
    mockClientOps.findUnique.mockResolvedValue(null);

    const { buildFinancialAnalysis } = await import(
      "../../lib/services/financial-analysis"
    );

    await expect(buildFinancialAnalysis("missing", 2025)).rejects.toThrow(
      "Client not found: missing",
    );
  });

  it("omits growth metrics when prior year is missing", async () => {
    mockClientFinancialOps.findMany.mockResolvedValue([FIN_2025]);

    mockDispatch.mockResolvedValue({
      text: "간단 분석.\n\n개선:\n- 제언 1",
      model: "m",
    });

    const { buildFinancialAnalysis } = await import(
      "../../lib/services/financial-analysis"
    );
    const result = await buildFinancialAnalysis("client-1", 2025);

    expect(result.metrics.revenueGrowth).toBeUndefined();
    expect(result.metrics.operatingProfitGrowth).toBeUndefined();
    expect(result.metrics.netProfitGrowth).toBeUndefined();
    // Ratios still computed
    expect(result.metrics.operatingMargin).toBe(12.5);
  });
});

describe("parseNarrativeResponse", () => {
  it("splits narrative and recommendations on header", async () => {
    const { parseNarrativeResponse } = await import(
      "../../lib/services/financial-analysis"
    );
    const parsed = parseNarrativeResponse(
      [
        "본문 문단 1.",
        "",
        "본문 문단 2.",
        "",
        "개선 컨설팅:",
        "- 제언 A",
        "- 제언 B",
      ].join("\n"),
    );
    expect(parsed.narrative).toBe("본문 문단 1.\n\n본문 문단 2.");
    expect(parsed.recommendations).toEqual(["제언 A", "제언 B"]);
  });

  it("mines bullets from anywhere when no explicit header", async () => {
    const { parseNarrativeResponse } = await import(
      "../../lib/services/financial-analysis"
    );
    const parsed = parseNarrativeResponse(
      ["요약.", "- 포인트 1", "- 포인트 2"].join("\n"),
    );
    expect(parsed.recommendations).toEqual(["포인트 1", "포인트 2"]);
  });

  it("returns empty structure for empty input", async () => {
    const { parseNarrativeResponse } = await import(
      "../../lib/services/financial-analysis"
    );
    expect(parseNarrativeResponse("")).toEqual({ narrative: "", recommendations: [] });
  });
});

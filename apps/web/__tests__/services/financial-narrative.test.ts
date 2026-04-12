/**
 * Unit tests for generateFinancialNarrative service
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockClientFinancialOps = {
  findFirst: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    clientFinancial: mockClientFinancialOps,
  },
}));

const mockCompleteWithFallback = vi.fn();

vi.mock("@axle/ai", () => ({
  completeWithFallback: (...args: unknown[]) => mockCompleteWithFallback(...args),
}));

// --- Tests ---

describe("generateFinancialNarrative", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompleteWithFallback.mockResolvedValue({
      text: "AI 분석 내러티브",
      usage: { inputTokens: 100, outputTokens: 200 },
      model: "test",
    });
  });

  it("generates narrative from financial data", async () => {
    const fakeFinancial = {
      id: "fin-1",
      clientId: "client-1",
      year: 2025,
      revenue: "1000000000",
      operatingProfit: "150000000",
      netProfit: "120000000",
      totalAssets: "2000000000",
      totalLiabilities: "800000000",
      totalEquity: "1200000000",
      creditRating: "A",
      source: "manual",
    };
    mockClientFinancialOps.findFirst.mockResolvedValue(fakeFinancial);

    mockCompleteWithFallback.mockResolvedValue({
      text: "해당 기업의 2025년 재무상태는 양호합니다.",
      usage: { inputTokens: 500, outputTokens: 200 },
      model: "claude-haiku-4-5-20251001",
    });

    const { generateFinancialNarrative } = await import(
      "../../lib/services/financial-narrative"
    );
    const result = await generateFinancialNarrative("client-1", 2025);

    expect(result).toBe("해당 기업의 2025년 재무상태는 양호합니다.");

    // Verify DB query
    expect(mockClientFinancialOps.findFirst).toHaveBeenCalledWith({
      where: { clientId: "client-1", year: 2025 },
    });

    // Verify completeWithFallback was called with correct job type
    expect(mockCompleteWithFallback).toHaveBeenCalledWith("FINANCIAL_ANALYSIS",
      expect.objectContaining({
        system: expect.stringContaining("Korean business financial analyst"),
        prompt: expect.stringContaining("2025"),
      })
    );
  });

  it("throws when no financial data found", async () => {
    mockClientFinancialOps.findFirst.mockResolvedValue(null);

    const { generateFinancialNarrative } = await import(
      "../../lib/services/financial-narrative"
    );

    await expect(
      generateFinancialNarrative("nonexistent", 2025)
    ).rejects.toThrow("No financial data for client nonexistent year 2025");

    expect(mockCompleteWithFallback).not.toHaveBeenCalled();
  });

  it("handles zero equity gracefully (ratios as N/A)", async () => {
    const fakeFinancial = {
      id: "fin-2",
      clientId: "client-2",
      year: 2024,
      revenue: "500000000",
      operatingProfit: "50000000",
      netProfit: "30000000",
      totalAssets: "1000000000",
      totalLiabilities: "1000000000",
      totalEquity: "0",
      creditRating: null,
      source: null,
    };
    mockClientFinancialOps.findFirst.mockResolvedValue(fakeFinancial);

    mockCompleteWithFallback.mockResolvedValue({
      text: "자본 잠식 상태의 기업입니다.",
      usage: { inputTokens: 400, outputTokens: 150 },
      model: "claude-haiku-4-5-20251001",
    });

    const { generateFinancialNarrative } = await import(
      "../../lib/services/financial-narrative"
    );
    const result = await generateFinancialNarrative("client-2", 2024);

    expect(result).toBe("자본 잠식 상태의 기업입니다.");

    // Verify the prompt contains N/A for equity-dependent ratios
    const callArgs = mockCompleteWithFallback.mock.calls[0];
    const promptArg = callArgs[1].prompt;
    const parsed = JSON.parse(promptArg);
    expect(parsed.ratios.debtRatio).toBe("N/A");
    expect(parsed.ratios.roe).toBe("N/A");
    // Revenue-based ratios should still be calculated
    expect(parsed.ratios.operatingMargin).toBe("10.0");
    expect(parsed.ratios.netMargin).toBe("6.0");
  });
});

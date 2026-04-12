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

const mockComplete = vi.fn();
const mockResolveProvider = vi.fn();

vi.mock("@axle/ai", () => ({
  resolveProvider: (...args: unknown[]) => mockResolveProvider(...args),
}));

// --- Tests ---

describe("generateFinancialNarrative", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveProvider.mockResolvedValue({
      complete: mockComplete,
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

    mockComplete.mockResolvedValue({
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

    // Verify AI provider was resolved with correct job type
    expect(mockResolveProvider).toHaveBeenCalledWith("FINANCIAL_ANALYSIS");

    // Verify complete was called with system prompt and financial data
    expect(mockComplete).toHaveBeenCalledWith(
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

    expect(mockResolveProvider).not.toHaveBeenCalled();
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

    mockComplete.mockResolvedValue({
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
    const promptArg = mockComplete.mock.calls[0][0].prompt;
    const parsed = JSON.parse(promptArg);
    expect(parsed.ratios.debtRatio).toBe("N/A");
    expect(parsed.ratios.roe).toBe("N/A");
    // Revenue-based ratios should still be calculated
    expect(parsed.ratios.operatingMargin).toBe("10.0");
    expect(parsed.ratios.netMargin).toBe("6.0");
  });
});

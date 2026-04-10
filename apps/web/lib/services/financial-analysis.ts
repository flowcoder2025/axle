/**
 * Financial Analysis Service
 *
 * Calculates standard financial ratios from ClientFinancial data.
 * AI narrative analysis is a stub for Phase 14.
 */

export interface FinancialRatios {
  currentRatio?: number;       // 유동비율 (currentAssets / currentLiabilities × 100)
  debtRatio?: number;          // 부채비율 (totalLiabilities / totalEquity × 100)
  roe?: number;                // ROE (netProfit / totalEquity × 100)
  roa?: number;                // ROA (netProfit / totalAssets × 100)
  operatingMargin?: number;    // 영업이익률 (operatingProfit / revenue × 100)
  netMargin?: number;          // 순이익률 (netProfit / revenue × 100)
  debtToAsset?: number;        // 부채/자산 비율 (totalLiabilities / totalAssets × 100)
}

export interface FinancialInput {
  revenue?: number | null;
  operatingProfit?: number | null;
  netProfit?: number | null;
  totalAssets?: number | null;
  totalLiabilities?: number | null;
  totalEquity?: number | null;
  // Note: currentAssets/currentLiabilities are not in schema — omitted
}

/**
 * Safely divides two numbers and returns the result × multiplier.
 * Returns undefined if either operand is nullish, zero denominator, or NaN.
 */
function safeDivide(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  multiplier = 100
): number | undefined {
  if (numerator == null || denominator == null || denominator === 0) return undefined;
  const result = (numerator / denominator) * multiplier;
  return isFinite(result) ? Math.round(result * 100) / 100 : undefined;
}

/**
 * Calculates standard financial ratios from raw financial data.
 */
export function calculateFinancialRatios(data: FinancialInput): FinancialRatios {
  return {
    debtRatio: safeDivide(data.totalLiabilities, data.totalEquity),
    roe: safeDivide(data.netProfit, data.totalEquity),
    roa: safeDivide(data.netProfit, data.totalAssets),
    operatingMargin: safeDivide(data.operatingProfit, data.revenue),
    netMargin: safeDivide(data.netProfit, data.revenue),
    debtToAsset: safeDivide(data.totalLiabilities, data.totalAssets),
    // currentRatio requires currentAssets/currentLiabilities — not in schema yet
    currentRatio: undefined,
  };
}

/**
 * Stub for Phase 14 AI narrative analysis.
 * Returns a structured placeholder that will be replaced with real AI output.
 */
export function buildAnalysisStub(
  ratios: FinancialRatios,
  year: number
): Record<string, unknown> {
  return {
    year,
    ratios,
    aiNarrative: null, // Phase 14: will be filled by Claude API call
    generatedAt: new Date().toISOString(),
    version: "stub-1.0",
  };
}

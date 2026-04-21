/**
 * Financial Analysis Service
 *
 * Calculates standard financial ratios from ClientFinancial data
 * and composes an AI-generated narrative + improvement recommendations
 * via the AiJob dispatcher (`FINANCIAL_ANALYSIS` handler).
 */

import { prisma } from "@axle/db";
import { dispatch, hasHandler, registerBuiltinHandlers } from "@axle/ai";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FinancialRatios {
  currentRatio?: number; // 유동비율 (currentAssets / currentLiabilities × 100)
  debtRatio?: number; // 부채비율 (totalLiabilities / totalEquity × 100)
  roe?: number; // ROE (netProfit / totalEquity × 100)
  roa?: number; // ROA (netProfit / totalAssets × 100)
  operatingMargin?: number; // 영업이익률 (operatingProfit / revenue × 100)
  netMargin?: number; // 순이익률 (netProfit / revenue × 100)
  debtToAsset?: number; // 부채/자산 비율 (totalLiabilities / totalAssets × 100)
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

export interface HistoricalYear {
  year: number;
  revenue?: number | null;
  operatingProfit?: number | null;
  netProfit?: number | null;
  totalAssets?: number | null;
  totalLiabilities?: number | null;
  totalEquity?: number | null;
  ratios: FinancialRatios;
}

export interface FinancialMetrics extends FinancialRatios {
  revenueGrowth?: number; // 매출성장률 (YoY % vs previous year)
  operatingProfitGrowth?: number;
  netProfitGrowth?: number;
}

export interface FinancialAnalysisResult {
  year: number;
  metrics: FinancialMetrics;
  historical: HistoricalYear[];
  narrative: string;
  recommendations: string[];
  aiModel: string | null;
  fallbackUsed: boolean;
  generatedAt: string;
}

// ── Ratio math ─────────────────────────────────────────────────────────────────

/**
 * Safely divides two numbers and returns the result × multiplier.
 * Returns undefined if either operand is nullish, zero denominator, or NaN.
 */
function safeDivide(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  multiplier = 100,
): number | undefined {
  if (numerator == null || denominator == null || denominator === 0) return undefined;
  const result = (numerator / denominator) * multiplier;
  return isFinite(result) ? Math.round(result * 100) / 100 : undefined;
}

function safeGrowth(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | undefined {
  if (current == null || previous == null || previous === 0) return undefined;
  const result = ((current - previous) / Math.abs(previous)) * 100;
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
    currentRatio: undefined,
  };
}

/**
 * Legacy stub, kept for backward compatibility with the old
 * `/api/clients/[clientId]/financial-analysis` route.
 */
export function buildAnalysisStub(
  ratios: FinancialRatios,
  year: number,
): Record<string, unknown> {
  return {
    year,
    ratios,
    aiNarrative: null,
    generatedAt: new Date().toISOString(),
    version: "stub-1.0",
  };
}

// ── Narrative parsing ──────────────────────────────────────────────────────────

const BULLET_PREFIX = /^\s*(?:[-*•·]|\d+[.)])\s+/;

/**
 * Parses an AI-generated response into narrative + recommendation bullets.
 *
 * The financial-analysis handler returns free-form Korean text. We split on
 * the first "추천" / "개선" / "컨설팅" / "권장" header and treat bullet lines
 * that follow as recommendations.
 */
export function parseNarrativeResponse(text: string): {
  narrative: string;
  recommendations: string[];
} {
  const trimmed = text.trim();
  if (!trimmed) return { narrative: "", recommendations: [] };

  const headerPattern =
    /(?:^|\n)\s*(?:#+\s*)?(?:\d+[.)]\s*)?(?:추천|개선|컨설팅|권장|Recommendations?|제언|조언)(?:\s*(?:사항|의견|포인트|액션|컨설팅|제언))?\s*[:：]?\s*\n/i;
  const match = headerPattern.exec(trimmed);

  let narrativePart = trimmed;
  let recPart = "";
  if (match && match.index >= 0) {
    narrativePart = trimmed.slice(0, match.index).trim();
    recPart = trimmed.slice(match.index + match[0].length).trim();
  }

  const recommendations: string[] = [];
  if (recPart) {
    for (const raw of recPart.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (BULLET_PREFIX.test(line)) {
        recommendations.push(line.replace(BULLET_PREFIX, "").trim());
      } else if (recommendations.length > 0) {
        // continuation line — append to previous bullet
        recommendations[recommendations.length - 1] =
          `${recommendations[recommendations.length - 1]} ${line}`.trim();
      }
    }
  }

  if (recommendations.length === 0) {
    // Try mining bullets from anywhere in the response as a last resort
    for (const raw of trimmed.split(/\r?\n/)) {
      const line = raw.trim();
      if (BULLET_PREFIX.test(line)) {
        recommendations.push(line.replace(BULLET_PREFIX, "").trim());
      }
    }
  }

  return {
    narrative: narrativePart,
    recommendations: recommendations.slice(0, 10),
  };
}

// ── Fallback narrative ─────────────────────────────────────────────────────────

function pctString(value?: number): string {
  return value == null ? "N/A" : `${value.toFixed(2)}%`;
}

function buildFallbackNarrative(
  clientName: string,
  year: number,
  metrics: FinancialMetrics,
): { narrative: string; recommendations: string[] } {
  const revenueLine =
    metrics.revenueGrowth == null
      ? `${year}년 기준 매출 성장률 데이터가 충분하지 않습니다.`
      : `${year}년 매출 성장률은 ${pctString(metrics.revenueGrowth)}로 집계되었습니다.`;

  const profitabilityLine = `영업이익률 ${pctString(
    metrics.operatingMargin,
  )}, 순이익률 ${pctString(metrics.netMargin)}, ROE ${pctString(metrics.roe)} 수준입니다.`;

  const stabilityLine = `부채비율은 ${pctString(metrics.debtRatio)}로, 자본 안정성을 함께 고려할 필요가 있습니다.`;

  const narrative = [
    `${clientName}의 ${year}년 재무 상태에 대한 자동 요약입니다 (AI 분석 미적용).`,
    revenueLine,
    profitabilityLine,
    stabilityLine,
  ].join("\n\n");

  const recommendations: string[] = [];
  if ((metrics.debtRatio ?? 0) > 200) {
    recommendations.push("부채비율이 200%를 초과하므로 차입 구조 재조정을 검토하세요.");
  }
  if ((metrics.operatingMargin ?? Infinity) < 5) {
    recommendations.push("영업이익률이 낮으므로 원가 구조와 고정비 개선이 필요합니다.");
  }
  if ((metrics.roe ?? Infinity) < 5) {
    recommendations.push("ROE가 낮으므로 자본 활용 효율화 전략을 점검하세요.");
  }
  if ((metrics.revenueGrowth ?? Infinity) < 0) {
    recommendations.push("매출이 역성장하고 있어 신규 매출원 확보가 시급합니다.");
  }
  if (recommendations.length === 0) {
    recommendations.push("현재 재무 지표는 양호하므로 현재 운영 기조를 유지하세요.");
    recommendations.push("자금 유동성과 외부 리스크 모니터링을 정기적으로 수행하세요.");
  }

  return { narrative, recommendations };
}

// ── Core: buildFinancialAnalysis ───────────────────────────────────────────────

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return isFinite(value) ? value : null;
  const n = Number(value);
  return isFinite(n) ? n : null;
}

interface BuildOptions {
  /** Override the dispatcher (for tests). Defaults to the real `dispatch`. */
  dispatchFn?: typeof dispatch;
}

/**
 * Fetches the target year + two prior years of ClientFinancial rows,
 * computes ratios + YoY growth, calls the FINANCIAL_ANALYSIS AI handler,
 * and returns a structured narrative + recommendations.
 *
 * Gracefully falls back to a template narrative on AI failure.
 */
export async function buildFinancialAnalysis(
  clientId: string,
  year: number,
  options: BuildOptions = {},
): Promise<FinancialAnalysisResult> {
  const dispatchFn = options.dispatchFn ?? dispatch;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true },
  });
  if (!client) {
    throw new Error(`Client not found: ${clientId}`);
  }

  const rows = await prisma.clientFinancial.findMany({
    where: { clientId, year: { in: [year, year - 1, year - 2] } },
    orderBy: { year: "desc" },
  });

  const current = rows.find((r) => r.year === year);
  if (!current) {
    throw new Error(`No financial data for client ${clientId} year ${year}`);
  }

  const historical: HistoricalYear[] = rows.map((r) => {
    const input: FinancialInput = {
      revenue: toNumber(r.revenue),
      operatingProfit: toNumber(r.operatingProfit),
      netProfit: toNumber(r.netProfit),
      totalAssets: toNumber(r.totalAssets),
      totalLiabilities: toNumber(r.totalLiabilities),
      totalEquity: toNumber(r.totalEquity),
    };
    return {
      year: r.year,
      ...input,
      ratios: calculateFinancialRatios(input),
    };
  });

  const currentInput: FinancialInput = {
    revenue: toNumber(current.revenue),
    operatingProfit: toNumber(current.operatingProfit),
    netProfit: toNumber(current.netProfit),
    totalAssets: toNumber(current.totalAssets),
    totalLiabilities: toNumber(current.totalLiabilities),
    totalEquity: toNumber(current.totalEquity),
  };
  const ratios = calculateFinancialRatios(currentInput);

  const previous = rows.find((r) => r.year === year - 1);
  const metrics: FinancialMetrics = {
    ...ratios,
    revenueGrowth: previous
      ? safeGrowth(toNumber(current.revenue), toNumber(previous.revenue))
      : undefined,
    operatingProfitGrowth: previous
      ? safeGrowth(toNumber(current.operatingProfit), toNumber(previous.operatingProfit))
      : undefined,
    netProfitGrowth: previous
      ? safeGrowth(toNumber(current.netProfit), toNumber(previous.netProfit))
      : undefined,
  };

  // Ensure the FINANCIAL_ANALYSIS handler is registered for the default dispatch.
  if (dispatchFn === dispatch && !hasHandler("FINANCIAL_ANALYSIS")) {
    registerBuiltinHandlers();
  }

  const payload = {
    financials: JSON.stringify(
      {
        clientName: client.name,
        targetYear: year,
        metrics,
        historical,
      },
      null,
      2,
    ),
    clientName: client.name,
  };

  let narrative = "";
  let recommendations: string[] = [];
  let aiModel: string | null = null;
  let fallbackUsed = false;

  try {
    const raw = (await dispatchFn("FINANCIAL_ANALYSIS", payload)) as {
      text?: string;
      model?: string;
    };
    const text = typeof raw?.text === "string" ? raw.text : "";
    aiModel = typeof raw?.model === "string" ? raw.model : null;

    const parsed = parseNarrativeResponse(text);
    narrative = parsed.narrative;
    recommendations = parsed.recommendations;

    if (!narrative) {
      // Empty AI response — fall back
      throw new Error("Empty AI response");
    }
  } catch (err) {
    console.warn("[financial-analysis] AI narrative failed; using fallback:", err);
    fallbackUsed = true;
    const fallback = buildFallbackNarrative(client.name, year, metrics);
    narrative = fallback.narrative;
    recommendations = fallback.recommendations;
    aiModel = null;
  }

  return {
    year,
    metrics,
    historical,
    narrative,
    recommendations,
    aiModel,
    fallbackUsed,
    generatedAt: new Date().toISOString(),
  };
}

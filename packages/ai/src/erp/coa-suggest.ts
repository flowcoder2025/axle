/**
 * COA suggestion engine (Phase 21 WI-727).
 *
 * Given an OrderItem-shaped line (productName + sale/purchase direction),
 * return the most likely ChartOfAccounts code from the seed list. The
 * engine is intentionally deterministic + offline:
 *
 *   - The fixture-driven accuracy test (`coa-suggest-engine.test.ts`) must
 *     pass top-1 ≥ 75% on 100 hand-curated cases; a flaky LLM round-trip
 *     in CI would defeat the SLO. When AXLE earns access to a fine-tuned
 *     local model the engine swaps to a fallback that runs after the
 *     keyword pass returns "low confidence".
 *
 *   - Intake confirm runs this on the request hot path. Network calls
 *     here would tax the 60s Vercel budget and make the AI-promotion
 *     path observably slower than manual review — kill switch behavior
 *     we explicitly do NOT want.
 *
 * Confidence is a coarse [0, 1] heuristic: exact keyword anchor → 0.95,
 * substring match on a single keyword → 0.75, weakest "category-only"
 * fallback → 0.55. Anything below MIN_CONFIDENCE is dropped (the engine
 * returns no suggestion for that line — confirm falls back to UNCLASSIFIED
 * for the audit trail).
 *
 * Spec: docs/specs/2026-05-17-phase21-erp-amplification-design.md §5 WI-727.
 */

/**
 * The fallback codes 401 (상품매출) and 451 (상품매입) are part of the
 * 국세청 표준재무제표 v2024 anchor set the seed ships in apps/web (see
 * `apps/web/lib/erp/coa-seed.ts`). They are duplicated here as a
 * defensive sanity set so the engine can refuse to emit a code that
 * isn't in the canonical chart; the engine never reads the per-tenant
 * ChartOfAccounts table (rules are deterministic, not seed-aware).
 */
const KNOWN_CODES = new Set<string>([
  "400", "401", "402", "404",
  "450", "451", "452", "455",
  "500", "501", "511", "512", "513", "514", "515",
  "517", "518", "519", "520", "521", "522", "523",
  "524", "525", "529", "530", "531", "532",
  "900", "901", "905", "950", "951", "955",
  "999",
]);

/** Minimum confidence at which the engine returns a suggestion. */
export const MIN_CONFIDENCE = 0.55;

/** Accuracy SLO (top-1 over the validation fixture). Below this the
 *  confirm path skips AI auto-promotion and falls back to manual entry
 *  (line stays UNCLASSIFIED in OrderItem.coaSource). */
export const ACCURACY_SLO_TOP1 = 0.75;

export type OrderDirection = "SALE" | "PURCHASE";

export interface CoaSuggestLineInput {
  /** Stable index back into the IntakeDraft item array. */
  lineIndex: number;
  productName: string;
  /** SALE → revenue codes win; PURCHASE → COGS/OPEX win. */
  orderType: OrderDirection;
}

export interface CoaSuggestion {
  lineIndex: number;
  productName: string;
  coaCode: string;
  confidence: number;
  /** Up to 2 runner-up codes for UI dropdown hints. */
  alternatives: { coaCode: string; confidence: number }[];
}

/**
 * Keyword anchors that map a Korean product/service token to a specific
 * ChartOfAccounts code. The list is intentionally narrow — the goal is
 * "if the operator typed 휴대폰요금 we know it's 통신비" rather than
 * machine-learned coverage.
 *
 * Direction-sensitive entries split SALE vs PURCHASE. The default for an
 * unmatched product on a SALE order is 401 (상품매출); on a PURCHASE order
 * it is 451 (상품매입). That category-only fallback is what keeps the SLO
 * achievable on diverse inputs.
 */
interface KeywordRule {
  keywords: string[];
  saleCode?: string;
  purchaseCode?: string;
}

const KEYWORD_RULES: KeywordRule[] = [
  // OPEX — 통신
  { keywords: ["통신", "휴대폰요금", "휴대폰 요금", "인터넷", "전화요금", "kt", "skt", "lg유플", "통신비"], purchaseCode: "514" },
  // OPEX — 수도광열
  { keywords: ["전기", "수도", "가스", "도시가스", "전기료", "한전", "광열"], purchaseCode: "515" },
  // OPEX — 임차료
  { keywords: ["임차", "월세", "사무실 임대", "임대료", "렌트"], purchaseCode: "519" },
  // OPEX — 차량유지비
  { keywords: ["주유", "휘발유", "경유", "자동차세", "차량", "주유소", "톨게이트", "하이패스"], purchaseCode: "521" },
  // OPEX — 운반비/택배
  { keywords: ["택배", "운송", "배송비", "퀵", "퀵서비스", "물류"], purchaseCode: "522" },
  // OPEX — 광고선전
  { keywords: ["광고", "마케팅", "구글ads", "페이스북", "메타 광고", "네이버 광고", "유튜브 광고"], purchaseCode: "523" },
  // OPEX — 도서인쇄
  { keywords: ["도서", "책", "인쇄", "복사", "프린트", "토너", "잉크"], purchaseCode: "524" },
  // OPEX — 접대비
  { keywords: ["접대", "회식", "법인카드 식대", "거래처 식사", "골프"], purchaseCode: "513" },
  // OPEX — 회의비
  { keywords: ["회의", "회의비", "다과", "미팅 카페", "미팅 음료"], purchaseCode: "525" },
  // OPEX — 여비교통비
  { keywords: ["출장", "택시", "지하철", "ktx", "고속버스", "항공권", "주차"], purchaseCode: "512" },
  // OPEX — 사무용품
  { keywords: ["사무용품", "볼펜", "노트", "사무실 비품", "a4", "용지"], purchaseCode: "529" },
  // OPEX — 소모품
  { keywords: ["소모품", "청소용품", "휴지", "쓰레기봉투"], purchaseCode: "530" },
  // OPEX — 지급수수료
  { keywords: ["수수료", "은행 수수료", "서비스 수수료", "결제 수수료", "pg수수료", "saas", "구독", "라이선스"], purchaseCode: "531" },
  // OPEX — 수선비
  { keywords: ["수리", "수선", "정비", "as", "a/s", "유지보수"], purchaseCode: "532" },
  // OPEX — 보험료
  { keywords: ["보험", "보험료", "산재보험", "고용보험", "건강보험"], purchaseCode: "520" },
  // OPEX — 급여 / 복리후생
  { keywords: ["급여", "월급", "임금", "상여"], purchaseCode: "501" },
  { keywords: ["복리후생", "직원 식대", "간식", "회식대", "건강검진"], purchaseCode: "511" },
  // OPEX — 세금과공과
  { keywords: ["세금", "재산세", "주민세", "면허세", "지방세", "공과금", "사업소세"], purchaseCode: "517" },

  // COGS — 외주
  { keywords: ["외주", "외주가공", "용역 외주", "ux 외주", "디자인 외주", "개발 외주"], purchaseCode: "455" },
  // COGS — 원재료
  { keywords: ["원재료", "원자재", "자재 입고", "부품"], purchaseCode: "452" },
  // COGS — 상품매입 (SALE 면에서는 상품매출)
  { keywords: ["상품", "도매", "재고 입고"], saleCode: "401", purchaseCode: "451" },

  // 영업외
  { keywords: ["이자수익", "이자 수입", "예금 이자"], saleCode: "901" },
  { keywords: ["이자비용", "대출 이자", "차입 이자"], purchaseCode: "951" },

  // REVENUE — 용역 매출
  { keywords: ["용역", "컨설팅", "자문", "서비스 매출", "프로젝트", "구축 매출"], saleCode: "404" },
  // REVENUE — 제품 매출
  { keywords: ["제품", "자체 제작", "제조 매출"], saleCode: "402" },
];

const COA_CODES = KNOWN_CODES;

/** Default code used when no rule matches but we still want a category. */
function categoryFallback(orderType: OrderDirection): string {
  return orderType === "SALE" ? "401" : "451"; // 상품매출 / 상품매입
}

function normalize(input: string): string {
  // Lowercase + collapse whitespace + NFC for Korean compatibility chars.
  return input.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}

function ruleConfidence(
  productNorm: string,
  keyword: string,
): number {
  const k = keyword.toLowerCase();
  if (productNorm === k) return 0.95;
  // word-boundary-ish: keyword is the leading or trailing run of chars.
  if (productNorm.startsWith(k) || productNorm.endsWith(k)) return 0.85;
  if (productNorm.includes(k)) return 0.75;
  return 0;
}

/**
 * Score a single product against every rule. Returns the matches sorted
 * by descending confidence; alternatives are everything except the winner.
 */
function scoreRules(
  productName: string,
  orderType: OrderDirection,
): { coaCode: string; confidence: number }[] {
  const norm = normalize(productName);
  if (!norm) return [];

  const hits = new Map<string, number>();

  for (const rule of KEYWORD_RULES) {
    const code = orderType === "SALE" ? rule.saleCode : rule.purchaseCode;
    if (!code) continue;
    let best = 0;
    for (const kw of rule.keywords) {
      const c = ruleConfidence(norm, kw);
      if (c > best) best = c;
    }
    if (best > 0) {
      // Same code from multiple rules → keep the strongest.
      const prev = hits.get(code) ?? 0;
      if (best > prev) hits.set(code, best);
    }
  }

  return Array.from(hits.entries())
    .map(([coaCode, confidence]) => ({ coaCode, confidence }))
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Suggest a coaCode for one line. Returns null when:
 *   - the product name is empty / whitespace, OR
 *   - no rule matched and the category fallback is unavailable (should
 *     never happen since the seed always contains 401/451).
 *
 * The category fallback is rated 0.55 so the caller can tell apart a
 * confident keyword match from a "we just defaulted to 상품매출/매입".
 */
export function suggestForLine(
  input: CoaSuggestLineInput,
): CoaSuggestion | null {
  if (!input.productName || !input.productName.trim()) return null;

  const ranked = scoreRules(input.productName, input.orderType);
  const fallbackCode = categoryFallback(input.orderType);
  if (!COA_CODES.has(fallbackCode)) {
    // Seed corruption — refuse to return a code that isn't in the catalog.
    return ranked.length > 0
      ? {
          lineIndex: input.lineIndex,
          productName: input.productName,
          coaCode: ranked[0].coaCode,
          confidence: ranked[0].confidence,
          alternatives: ranked.slice(1, 3),
        }
      : null;
  }

  if (ranked.length === 0) {
    return {
      lineIndex: input.lineIndex,
      productName: input.productName,
      coaCode: fallbackCode,
      confidence: MIN_CONFIDENCE,
      alternatives: [],
    };
  }

  const winner = ranked[0];
  // If even the best rule scored below the floor, fall back to the
  // category default but keep the rule hit as an alternative so a UI
  // can show "did you mean 524?" hints.
  if (winner.confidence < MIN_CONFIDENCE) {
    return {
      lineIndex: input.lineIndex,
      productName: input.productName,
      coaCode: fallbackCode,
      confidence: MIN_CONFIDENCE,
      alternatives: ranked.slice(0, 2),
    };
  }

  return {
    lineIndex: input.lineIndex,
    productName: input.productName,
    coaCode: winner.coaCode,
    confidence: winner.confidence,
    alternatives: ranked.slice(1, 3),
  };
}

/**
 * Batch entry: returns a suggestion array aligned to the input order
 * (callers can index by lineIndex). Lines with empty productName are
 * skipped (the array filters them out).
 */
export function suggestForLines(
  lines: CoaSuggestLineInput[],
): CoaSuggestion[] {
  const out: CoaSuggestion[] = [];
  for (const line of lines) {
    const s = suggestForLine(line);
    if (s) out.push(s);
  }
  return out;
}

/**
 * Evaluate the engine against a fixture (top-1 accuracy). Used by the
 * Vitest SLO gate — see `coa-suggest-engine.test.ts`.
 */
export interface AccuracyCase {
  productName: string;
  orderType: OrderDirection;
  expectedCoaCode: string;
}

export interface AccuracyReport {
  total: number;
  correct: number;
  top1Accuracy: number;
  meetsSLO: boolean;
  misses: { productName: string; expected: string; got: string | null }[];
}

export function evaluateAccuracy(
  cases: AccuracyCase[],
  sloTop1 = ACCURACY_SLO_TOP1,
): AccuracyReport {
  let correct = 0;
  const misses: AccuracyReport["misses"] = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const s = suggestForLine({
      lineIndex: i,
      productName: c.productName,
      orderType: c.orderType,
    });
    const got = s?.coaCode ?? null;
    if (got === c.expectedCoaCode) {
      correct += 1;
    } else {
      misses.push({ productName: c.productName, expected: c.expectedCoaCode, got });
    }
  }
  const top1 = cases.length === 0 ? 0 : correct / cases.length;
  return {
    total: cases.length,
    correct,
    top1Accuracy: top1,
    meetsSLO: top1 >= sloTop1,
    misses,
  };
}

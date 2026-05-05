/**
 * Answer validation for the nomu (노무자문) consultation flow.
 *
 * The PBC owns the deterministic post-checks; the LLM's free-form text
 * is graded against three hard rules and one soft signal:
 *
 *   1. cited at least one Korean labor-law clause (regex over the
 *      recognised statute names).
 *   2. answer length ∈ [50, 5000] chars.
 *   3. no banned phrase (advice that suggests evading labor law).
 *   4. (warning, not failure) ≥5 strong-claim adverbs (반드시 / 절대로
 *      / 무조건 / 분명히 / 명백히 / 확실히) — flags an over-confident
 *      answer for human review.
 */

const RECOGNISED_STATUTES = [
  "근로기준법",
  "산업재해보상보험법",
  "남녀고용평등법",
  "최저임금법",
  "근로자퇴직급여보장법",
  "산업안전보건법",
  "국민연금법",
  "건강보험법",
  "고용보험법",
] as const;

const CITATION_REGEX = new RegExp(
  `(${RECOGNISED_STATUTES.join("|")})\\s*제\\s*\\d+\\s*조`,
  "g",
);

const BANNED_PHRASES = [
  "회피하는 방법",
  "신고를 피할 수 있",
  "가짜 근로계약서",
  "이중 계약",
  "허위 신고",
];

const STRONG_CLAIM_ADVERBS = [
  "반드시",
  "절대로",
  "무조건",
  "분명히",
  "명백히",
  "확실히",
  "예외 없이",
  "100%",
];

const MIN_ANSWER_LENGTH = 50;
const MAX_ANSWER_LENGTH = 5000;

export interface NomuValidationResult {
  valid: boolean;
  reason?: string;
  warnings?: string[];
}

export function extractKoreanLaborLawCitations(text: string): string[] {
  if (!text) return [];
  const matches = text.matchAll(CITATION_REGEX);
  const seen = new Set<string>();
  for (const m of matches) {
    // Normalise: collapse whitespace inside the citation.
    seen.add(m[0].replace(/\s+/g, " ").replace(/\s*제\s*/, " 제").replace(/\s*조$/, "조"));
  }
  return [...seen];
}

export function validateNomuAnswer(answer: string): NomuValidationResult {
  if (!answer || answer.length === 0) {
    return { valid: false, reason: "answer is empty" };
  }
  if (answer.length < MIN_ANSWER_LENGTH) {
    return {
      valid: false,
      reason: `answer is too short (${answer.length} < ${MIN_ANSWER_LENGTH})`,
    };
  }
  if (answer.length > MAX_ANSWER_LENGTH) {
    return {
      valid: false,
      reason: `answer is too long (${answer.length} > ${MAX_ANSWER_LENGTH})`,
    };
  }

  for (const phrase of BANNED_PHRASES) {
    if (answer.includes(phrase)) {
      return {
        valid: false,
        reason: `banned phrase detected (회피/우회 권유): ${phrase}`,
      };
    }
  }

  const citations = extractKoreanLaborLawCitations(answer);
  if (citations.length === 0) {
    return {
      valid: false,
      reason: "no recognised Korean labor-law citation (법령 인용 없음)",
    };
  }

  const warnings: string[] = [];
  const strongHits = STRONG_CLAIM_ADVERBS.reduce(
    (sum, adv) => sum + (answer.includes(adv) ? 1 : 0),
    0,
  );
  if (strongHits >= 5) {
    warnings.push(
      `over-confident wording detected (${strongHits} strong-claim adverbs / 단정적 표현)`,
    );
  }

  return { valid: true, warnings };
}

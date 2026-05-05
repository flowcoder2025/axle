/**
 * Question pre-processing for the nomu (노무자문) consultation flow.
 *
 *   - `classifyNomuTopic`: keyword heuristic → `NomuTopic`. Lets the
 *     consumer route follow-ups, surface "관련 자료" links, and gives
 *     evaluators a structured signal to score on.
 *   - `redactNomuPii`: masks 주민번호 / 휴대폰 / 이메일 before the
 *     redacted text is forwarded to the LLM (in `packages/ai`).
 *
 * Both are pure (no I/O). The keyword lists are deliberately small;
 * the production routing layer can replace `classifyNomuTopic` with an
 * LLM-driven classifier without changing the service surface.
 */

export type NomuTopicCategory =
  | "WAGE"
  | "ATTENDANCE"
  | "LEAVE"
  | "DISMISSAL"
  | "DISCIPLINE"
  | "INSURANCE"
  | "CONTRACT"
  | "OTHER";

export interface NomuTopic {
  category: NomuTopicCategory;
  /** Heuristic confidence in [0, 1]. */
  confidence: number;
}

const TOPIC_KEYWORDS: ReadonlyArray<{
  category: Exclude<NomuTopicCategory, "OTHER">;
  keywords: ReadonlyArray<string>;
}> = [
  {
    category: "WAGE",
    keywords: [
      "급여",
      "임금",
      "월급",
      "주휴수당",
      "주휴",
      "연장수당",
      "야근수당",
      "가산임금",
      "최저임금",
      "퇴직금",
    ],
  },
  {
    category: "ATTENDANCE",
    keywords: ["출근", "퇴근", "지각", "근태", "조퇴", "결근"],
  },
  {
    category: "LEAVE",
    keywords: ["연차", "휴가", "출산휴가", "병가", "경조사"],
  },
  {
    category: "DISMISSAL",
    keywords: ["해고", "권고사직", "정리해고", "부당해고"],
  },
  {
    category: "DISCIPLINE",
    keywords: ["징계", "시말서", "감봉", "정직", "견책"],
  },
  {
    category: "INSURANCE",
    keywords: [
      "4대보험",
      "사대보험",
      "국민연금",
      "건강보험",
      "고용보험",
      "산재",
      "산업재해",
    ],
  },
  {
    category: "CONTRACT",
    keywords: ["근로계약", "계약서", "수습", "정규직 전환"],
  },
];

const OTHER_GENERAL_KEYWORDS = [
  "회사",
  "직원",
  "사장",
  "대표",
  "사무실",
  "부서",
  "팀",
];

export function classifyNomuTopic(question: string): NomuTopic {
  if (!question || question.trim().length === 0) {
    return { category: "OTHER", confidence: 0 };
  }

  let bestCategory: NomuTopicCategory = "OTHER";
  let bestHits = 0;

  for (const { category, keywords } of TOPIC_KEYWORDS) {
    const hits = keywords.reduce(
      (sum, kw) => sum + (question.includes(kw) ? 1 : 0),
      0,
    );
    if (hits > bestHits) {
      bestHits = hits;
      bestCategory = category;
    }
  }

  if (bestHits > 0) {
    // 1 hit ≈ 0.6, 2 hits ≈ 0.8, 3+ hits ≈ 0.95 — caps at 0.99.
    const confidence = Math.min(0.99, 0.4 + bestHits * 0.2);
    return { category: bestCategory, confidence };
  }

  // Soft-OTHER: at least one general workplace keyword present means
  // we have something to route on (still strictly lower confidence
  // than any keyword hit so the test in preprocess.test.ts holds).
  const otherHits = OTHER_GENERAL_KEYWORDS.reduce(
    (sum, kw) => sum + (question.includes(kw) ? 1 : 0),
    0,
  );
  if (otherHits > 0) {
    return { category: "OTHER", confidence: 0.2 };
  }
  return { category: "OTHER", confidence: 0.1 };
}

const PII_PATTERNS: ReadonlyArray<{
  label: string;
  re: RegExp;
}> = [
  { label: "RRN", re: /\b\d{6}-\d{7}\b/g },
  { label: "PHONE", re: /\b01[016789]-\d{3,4}-\d{4}\b/g },
  { label: "PHONE", re: /\b01[016789]\d{7,8}\b/g },
  { label: "EMAIL", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
];

export function redactNomuPii(text: string): string {
  if (!text) return text;
  let out = text;
  for (const { label, re } of PII_PATTERNS) {
    out = out.replace(re, `[REDACTED:${label}]`);
  }
  return out;
}

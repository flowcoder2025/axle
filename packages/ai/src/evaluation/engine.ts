import { prisma } from "@axle/db";

export interface EvaluationInput {
  documentContent: string; // business plan markdown/text
  programId?: string; // optional: evaluate against specific program
}

export interface EvaluationCriteria {
  name: string; // e.g., '사업 목표 명확성', '시장 분석', '기술 차별성'
  weight: number; // 0-1
  score: number; // 0-10
  feedback: string;
}

export interface EvaluationResult {
  criteria: EvaluationCriteria[];
  totalScore: number; // weighted average (0-10)
  grade: "A" | "B" | "C" | "D" | "F";
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
}

interface CriterionDefinition {
  name: string;
  weight: number;
  /** Keywords that signal presence of this section */
  keywords: string[];
  /** Minimum word count for the section to score well */
  minWords: number;
}

// Default criteria for business plans
export const DEFAULT_CRITERIA: CriterionDefinition[] = [
  {
    name: "사업 목표 명확성",
    weight: 0.15,
    keywords: ["목표", "비전", "미션", "목적", "달성", "성과"],
    minWords: 50,
  },
  {
    name: "시장 분석 충실도",
    weight: 0.15,
    keywords: ["시장", "market", "경쟁", "고객", "수요", "규모", "트렌드"],
    minWords: 80,
  },
  {
    name: "기술 차별성",
    weight: 0.15,
    keywords: ["기술", "특허", "차별화", "혁신", "독자", "핵심기술", "R&D"],
    minWords: 60,
  },
  {
    name: "실현 가능성",
    weight: 0.15,
    keywords: ["계획", "일정", "로드맵", "단계", "추진", "실행", "milestone"],
    minWords: 60,
  },
  {
    name: "재무 계획 적정성",
    weight: 0.10,
    keywords: ["매출", "수익", "비용", "투자", "예산", "손익", "BEP", "ROI"],
    minWords: 40,
  },
  {
    name: "팀 역량",
    weight: 0.10,
    keywords: ["팀", "대표", "인력", "경력", "전문가", "조직", "역량"],
    minWords: 30,
  },
  {
    name: "사회적 기여",
    weight: 0.05,
    keywords: ["사회", "환경", "ESG", "일자리", "지역", "공헌", "임팩트"],
    minWords: 20,
  },
  {
    name: "문서 완성도",
    weight: 0.15,
    keywords: [],
    minWords: 500, // overall document length heuristic
  },
];

/**
 * Grade boundaries for totalScore (0-10 weighted average).
 */
function scoreToGrade(score: number): EvaluationResult["grade"] {
  if (score >= 9.0) return "A";
  if (score >= 7.5) return "B";
  if (score >= 6.0) return "C";
  if (score >= 4.0) return "D";
  return "F";
}

/**
 * Count how many of the given keywords appear in the content (case-insensitive).
 */
function countKeywordMatches(content: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const lower = content.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw.toLowerCase())).length;
}

/**
 * Count words in the content.
 */
function countWords(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Rule-based scoring for a single criterion.
 *
 * Scoring model (0-10):
 *  - Keyword coverage contributes up to 6 points.
 *  - Word count (relative to minWords) contributes up to 4 points.
 * Phase 14: AI-powered scoring via Claude will replace this.
 */
function scoreCriterion(
  content: string,
  criterion: CriterionDefinition,
  wordCount: number
): { score: number; feedback: string } {
  // Special case: "문서 완성도" is purely length-based
  if (criterion.keywords.length === 0) {
    const lengthScore = Math.min(10, (wordCount / criterion.minWords) * 10);
    const score = Math.round(lengthScore * 10) / 10;
    const feedback =
      wordCount >= criterion.minWords
        ? `문서 분량이 충분합니다 (${wordCount}자).`
        : `문서 분량이 부족합니다 (${wordCount}자 / 권장 ${criterion.minWords}자 이상).`;
    return { score, feedback };
  }

  const matched = countKeywordMatches(content, criterion.keywords);
  const keywordRatio = matched / criterion.keywords.length;
  const keywordScore = keywordRatio * 6;

  // Estimate word density around this criterion in the whole doc
  const wordScore = Math.min(4, (wordCount / (criterion.minWords * 5)) * 4);

  const score = Math.round((keywordScore + wordScore) * 10) / 10;

  let feedback: string;
  if (score >= 8) {
    feedback = `${criterion.name} 관련 내용이 충실하게 작성되었습니다.`;
  } else if (score >= 5) {
    const missing = criterion.keywords
      .filter((kw) => !content.toLowerCase().includes(kw.toLowerCase()))
      .slice(0, 3);
    feedback =
      `${criterion.name} 내용이 있으나 보완이 필요합니다.` +
      (missing.length > 0 ? ` (보완 키워드 예시: ${missing.join(", ")})` : "");
  } else {
    feedback = `${criterion.name} 관련 내용이 부족합니다. 해당 섹션을 추가하거나 보강하세요.`;
  }

  return { score: Math.min(10, score), feedback };
}

/**
 * Build program-specific additional criteria when programId is provided.
 */
async function buildProgramContext(programId: string): Promise<string> {
  const program = await prisma.programInfo.findUnique({
    where: { id: programId },
    select: { name: true, agency: true, requirements: true },
  });
  if (!program) return "";
  return `프로그램: ${program.name}` + (program.agency ? ` (${program.agency})` : "");
}

/**
 * Evaluate a business plan document with rule-based scoring.
 *
 * Phase 5: keyword + length heuristics.
 * Phase 14: Claude-powered deep analysis via agent-bridge.
 */
export async function evaluate(
  input: EvaluationInput
): Promise<EvaluationResult> {
  const { documentContent, programId } = input;

  // Fetch program context if provided (currently used for summary enrichment)
  let programContext = "";
  if (programId) {
    try {
      programContext = await buildProgramContext(programId);
    } catch {
      // Non-fatal: proceed without program context
    }
  }

  const wordCount = countWords(documentContent);

  const criteria: EvaluationCriteria[] = DEFAULT_CRITERIA.map((def) => {
    const { score, feedback } = scoreCriterion(documentContent, def, wordCount);
    return { name: def.name, weight: def.weight, score, feedback };
  });

  const totalScore =
    criteria.reduce((sum, c) => sum + c.score * c.weight, 0);
  const roundedTotal = Math.round(totalScore * 10) / 10;
  const grade = scoreToGrade(roundedTotal);

  const strengths = criteria
    .filter((c) => c.score >= 8)
    .map((c) => `${c.name}: ${c.feedback}`);

  const weaknesses = criteria
    .filter((c) => c.score < 5)
    .map((c) => c.name);

  const improvements = criteria
    .filter((c) => c.score < 7)
    .sort((a, b) => b.weight - a.weight) // highest weight first
    .map((c) => c.feedback);

  // Suppress unused variable warning (will be used in Phase 14 prompt)
  void programContext;

  return {
    criteria,
    totalScore: roundedTotal,
    grade,
    strengths,
    weaknesses,
    improvements,
  };
}

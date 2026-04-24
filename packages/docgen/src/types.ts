// ── Shared types for docgen engines ────────────────────────────────────────

export interface DocumentSection {
  title: string;
  content: string;
}

export interface RagDraftInput {
  clientId: string;
  programId: string;
  projectId: string;
}

export interface RagDraftOutput {
  sections: DocumentSection[];
  metadata: {
    sourceDocs: string[];
    tokensUsed?: number;
  };
}

export interface PrecisionInput {
  draftSections: DocumentSection[];
  programFormUrl?: string;
  programRequirements?: Record<string, unknown>;
}

export interface PrecisionOutput {
  docxBuffer: Buffer;
  fileName: string;
}

export interface VerificationInput {
  documentContent: string;
  programId?: string;
}

export interface MissingItem {
  section: string;
  description: string;
  severity: "critical" | "minor";
}

export interface FormatIssue {
  issue: string;
  location?: string;
}

export interface VerificationResult {
  isComplete: boolean;
  completenessScore: number; // 0-100
  missingItems: MissingItem[];
  formatIssues: FormatIssue[];
}

/**
 * Structured metadata for a single business-plan section. Used as the single
 * source of truth for:
 *   1. UI wizard section list + labels + required flag
 *   2. RAG draft generator — `instruction` + `tips` + char limits are injected
 *      into per-section AI prompts
 *   3. Verification engine — `minChars` enforces per-section length
 *
 * Sourced from the 2024 벤처기업(신규) 확인용 사업계획서 공식 양식
 * (docs/벤처(신규) 양식.txt). Each entry carries the agency's own 작성 요령
 * so the generator can replicate the evaluator's expectations verbatim.
 */
export interface SectionConfig {
  /** Stable id used by clients and persistence (do not translate). */
  id: string;
  /** Section heading as it will appear in the draft. */
  title: string;
  /** One-line purpose — injected as the main instruction to the AI. */
  instruction: string;
  /** 작성 요령 — bullet list, injected into the AI prompt as guidance. */
  tips: readonly string[];
  /** Minimum Korean characters expected. Verified by the verification engine. */
  minChars: number;
  /** Target maximum Korean characters. Passed to the AI as an upper bound. */
  maxChars: number;
  /** Required for the program to pass verification. */
  required: boolean;
}

/**
 * 2024 벤처기업(신규) 확인용 사업계획서 — 9개 섹션. 각 섹션의 지침과 팁은
 * 중기부 공식 양식(docs/벤처(신규) 양식.txt)에서 직접 인용.
 */
export const VENTURE_BUSINESS_PLAN_SECTIONS: readonly SectionConfig[] = [
  {
    id: "background",
    title: "개발 배경 및 필요성",
    instruction:
      "기술(제품/서비스) 개발 배경과 해결하고자 하는 문제를 구체적 근거와 함께 서술한다.",
    tips: [
      "소비자/사회가 겪고 있는 불편과 경쟁사 현황을 연결해 문제의 중요성을 강조",
      "시장·고객·사회 관점에서 왜 지금 해결이 필요한지 수요를 구체화",
      "체크리스트에서 고른 문제 유형(시급성/비용/빈도 등)과 본문 내용이 일치하도록 작성",
    ],
    minChars: 800,
    maxChars: 1000,
    required: true,
  },
  {
    id: "solution",
    title: "솔루션 소개 및 차별성",
    instruction:
      "앞서 제시한 문제를 기업의 기술(제품/서비스)이 어떻게 해결하는지 핵심 기능·BM·경쟁력 확보 방안을 제시한다.",
    tips: [
      "기존 제품 대비 차별점(성능/가격/편의성/디자인/통합성 등)을 객관적 근거와 함께 제시",
      "단순 '더 좋다' 대신 시장에서 구매 행태를 바꿀 이유를 명확히 기재",
      "산업재산권(특허/실용신안), 시험성적서, 인증 현황 또는 확보 계획을 함께 기술",
    ],
    minChars: 800,
    maxChars: 1000,
    required: true,
  },
  {
    id: "tech_progress",
    title: "현재까지의 기술개발 추진 경과",
    instruction:
      "아이디어 단계부터 현재까지의 기술 확보·R&D·상용화·인증·예산 확보 과정을 단계별로 기술한다.",
    tips: [
      "기술 확보(자체개발/외주/기술이전), 인력 구성, 예산 집행을 시점별로 구분",
      "시제품 제작, 베타 테스트, 초기 매출 등 마일스톤을 수치와 함께 제시",
      "이전 섹션의 솔루션과 직접 연결되는 근거를 유지",
    ],
    minChars: 800,
    maxChars: 1000,
    required: true,
  },
  {
    id: "tech_roadmap",
    title: "향후 3년간의 기술개발 추진 계획",
    instruction:
      "기술의 발전 목표와 이를 달성하기 위한 자원(기술/인력/예산) 확보 계획을 3년 단위로 제시한다.",
    tips: [
      "연차별 기술개발 마일스톤을 단계적으로 구분",
      "추가 기술 확보 방식(자체/외주/이전) + 인력 충원 + 예산 계획을 항목별로 기술",
      "솔루션 섹션의 차별점이 어떻게 강화되는지 연결",
    ],
    minChars: 800,
    maxChars: 1000,
    required: true,
  },
  {
    id: "team",
    title: "팀 구성 및 기업가 정신",
    instruction:
      "대표의 기업가 정신을 보여준 실질 경험과 핵심 팀의 구성·역할·역량을 기술한다.",
    tips: [
      "새로운 사업 기회 포착, 자원 조정·통제, 위기 돌파 경험을 구체 사례로 제시",
      "핵심 인력의 경력·학력·담당 역할을 조직도 형태로 정리",
      "팀이 기술개발 로드맵을 실행할 수 있는 역량임을 증명",
    ],
    minChars: 800,
    maxChars: 1000,
    required: true,
  },
  {
    id: "market",
    title: "목표시장 및 고객 정의 (TAM/SAM/SOM)",
    instruction:
      "진입하려는 시장을 TAM → SAM → SOM 순으로 세분화하고 3년 내 확보할 고객·규모·성장률을 제시한다.",
    tips: [
      "TAM(전체시장) → SAM(유효시장) → SOM(수확가능시장) 순으로 객관 근거·출처와 함께 산정",
      "과다하게 큰 시장 대신 현재 진입 가능한 국내 1~2천억원 규모 수준으로 정의",
      "예상 매출/사용자수와 시장 성장률을 3년 단위로 추정",
    ],
    minChars: 800,
    maxChars: 1000,
    required: true,
  },
  {
    id: "competitors",
    title: "경쟁사 분석",
    instruction:
      "목표시장 내 주요 경쟁기업(최대 3개사)의 특징·단점·점유율과 자사의 우위 전략을 제시한다.",
    tips: [
      "경쟁사의 시장점유/기능/성능을 객관 근거로 제시",
      "자사 제품의 특·장점 및 우위를 점할 전략을 구체화",
      "경쟁사가 없으면 잠재 고객의 기존 해결 방식과 비교",
    ],
    minChars: 800,
    maxChars: 1000,
    required: true,
  },
  {
    id: "go_to_market",
    title: "시장진입 및 확대 전략",
    instruction:
      "지금까지의 시장 진입 추진 경과와 향후 3년간의 시장 확대 계획을 단계별로 서술한다.",
    tips: [
      "현재까지의 마케팅 활동, 판로 개척, 가격·브랜드·물류 전략의 달성 수준 기재",
      "향후 3년간 주요 채널 입점·제품 라인업 확장·해외 진출 등 확대 로드맵 제시",
      "대형 거래처 확보, 신규 버전 출시 등 이정표를 연도별로 분해",
    ],
    minChars: 800,
    maxChars: 1000,
    required: true,
  },
  {
    id: "finance",
    title: "자금운용 계획",
    instruction:
      "사업 실현에 필요한 자금 규모와 조달 수단(영업이익/자본금/투자/정부지원/대출 등)을 구체적으로 제시한다.",
    tips: [
      "업력 3년 이상 기업은 최근 3년 자금 소요 대비 조달 현황 제시",
      "체크한 조달 수단별(엔젤/VC/정부지원/대출 등) 구체적 방법·시기를 기재",
      "안정 매출 발생 시점까지의 외부 조달 계획이 충분한 규모인지 검증",
    ],
    minChars: 800,
    maxChars: 1000,
    required: true,
  },
] as const;

/**
 * Standard Korean business plan section titles. Backward-compatible alias —
 * derived from `VENTURE_BUSINESS_PLAN_SECTIONS` so existing consumers see the
 * same shape (`readonly string[]`).
 */
export const REQUIRED_SECTIONS = VENTURE_BUSINESS_PLAN_SECTIONS.map(
  (s) => s.title,
) as readonly string[];

export type RequiredSection = string;

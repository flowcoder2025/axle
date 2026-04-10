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

/** Standard Korean business plan section titles */
export const REQUIRED_SECTIONS = [
  "사업 개요",
  "기술 설명",
  "시장 분석",
  "실행 계획",
  "기대 효과",
] as const;

export type RequiredSection = (typeof REQUIRED_SECTIONS)[number];

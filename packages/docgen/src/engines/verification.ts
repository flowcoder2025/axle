import type {
  VerificationInput,
  VerificationResult,
  MissingItem,
  FormatIssue,
} from "../types.js";
import { REQUIRED_SECTIONS } from "../types.js";

/**
 * Verification Engine (WI-065)
 *
 * Checks a business plan document for:
 *   1. Presence of all required sections
 *   2. Minimum content length per section
 *   3. Basic format requirements (headings, structure)
 *   4. Program-specific requirements (when programId is provided)
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum character count for a section to be considered non-trivial */
const MIN_SECTION_LENGTH = 100;

/** Minimum total document character count */
const MIN_DOCUMENT_LENGTH = 500;

/**
 * Program-specific additional requirements.
 * Keyed by programId prefix (e.g. "GOV-" matches "GOV-2024-01").
 *
 * Phase 14: this will be loaded from the DB via prisma.
 */
const PROGRAM_REQUIREMENTS: Record<
  string,
  { requiredSections: string[]; minLength: number }
> = {
  "GOV-": {
    requiredSections: ["예산 계획", "추진 일정"],
    minLength: 200,
  },
  "SMBA-": {
    requiredSections: ["수출 전략", "해외 시장 분석"],
    minLength: 150,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extracts section headings from the document text.
 * Recognizes lines that start with # (markdown-style) or
 * are a short standalone line followed by a blank line (plain text).
 */
function extractSectionHeadings(content: string): string[] {
  const headings: string[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    // Markdown heading: # 사업 개요
    if (/^#{1,3}\s+/.test(trimmed)) {
      headings.push(trimmed.replace(/^#{1,3}\s+/, "").trim());
      continue;
    }
    // Plain heading heuristic: short line (≤30 chars), no period at end
    // Exclude bullet list items, numbered list items, and table rows
    if (
      trimmed.length > 0 &&
      trimmed.length <= 30 &&
      !trimmed.endsWith(".") &&
      !/^[-*•]\s/.test(trimmed) &&
      !/^\d+\.\s/.test(trimmed) &&
      !trimmed.includes("|")
    ) {
      headings.push(trimmed);
    }
  }

  return headings;
}

/**
 * Returns the approximate character count for a section's content.
 * Finds the text between this heading and the next.
 */
function getSectionContentLength(content: string, sectionTitle: string): number {
  const lines = content.split("\n");
  let inSection = false;
  let charCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const isHeading =
      /^#{1,3}\s+/.test(trimmed) ||
      (trimmed.length > 0 &&
        trimmed.length <= 30 &&
        !trimmed.endsWith(".") &&
        !/^[-*•]\s/.test(trimmed) &&
        !/^\d+\.\s/.test(trimmed) &&
        !trimmed.includes("|"));

    if (isHeading) {
      const heading = trimmed.replace(/^#{1,3}\s+/, "").trim();
      if (heading === sectionTitle) {
        inSection = true;
        continue;
      } else if (inSection) {
        // We've hit the next section — stop counting
        break;
      }
    }

    if (inSection) {
      charCount += trimmed.length;
    }
  }

  return charCount;
}

function resolveProgramRequirements(
  programId?: string
): { requiredSections: string[]; minLength: number } | null {
  if (!programId) return null;
  for (const [prefix, reqs] of Object.entries(PROGRAM_REQUIREMENTS)) {
    if (programId.startsWith(prefix)) return reqs;
  }
  return null;
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function computeScore(
  missingItems: MissingItem[],
  formatIssues: FormatIssue[]
): number {
  const criticalCount = missingItems.filter(
    (m) => m.severity === "critical"
  ).length;
  const minorCount = missingItems.filter((m) => m.severity === "minor").length;
  const formatCount = formatIssues.length;

  const penalty = criticalCount * 20 + minorCount * 5 + formatCount * 3;
  return Math.max(0, 100 - penalty);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function verify(
  input: VerificationInput
): Promise<VerificationResult> {
  const { documentContent, programId } = input;
  const missingItems: MissingItem[] = [];
  const formatIssues: FormatIssue[] = [];

  const headings = extractSectionHeadings(documentContent);
  const headingSet = new Set(headings.map((h) => h.trim()));

  // 1. Check required sections exist
  for (const section of REQUIRED_SECTIONS) {
    const found = [...headingSet].some(
      (h) => h === section || h.includes(section)
    );
    if (!found) {
      missingItems.push({
        section,
        description: `필수 섹션 "${section}"이(가) 없습니다.`,
        severity: "critical",
      });
      continue;
    }

    // 2. Check minimum content length per section
    const length = getSectionContentLength(documentContent, section);
    if (length < MIN_SECTION_LENGTH) {
      missingItems.push({
        section,
        description: `"${section}" 섹션의 내용이 너무 짧습니다 (${length}자, 최소 ${MIN_SECTION_LENGTH}자 필요).`,
        severity: "minor",
      });
    }
  }

  // 3. Check format requirements
  if (documentContent.trim().length < MIN_DOCUMENT_LENGTH) {
    formatIssues.push({
      issue: `문서 총 길이가 너무 짧습니다 (${documentContent.trim().length}자, 최소 ${MIN_DOCUMENT_LENGTH}자 필요).`,
    });
  }

  if (headings.length === 0) {
    formatIssues.push({
      issue: "문서에 제목(Heading) 구조가 없습니다. 섹션 제목을 추가하세요.",
    });
  }

  // Check for consecutive duplicate headings
  for (let i = 0; i < headings.length - 1; i++) {
    if (headings[i] === headings[i + 1]) {
      formatIssues.push({
        issue: `중복 섹션 제목 발견: "${headings[i]}"`,
        location: `섹션 ${i + 1}`,
      });
    }
  }

  // 4. Program-specific requirements
  const programReqs = resolveProgramRequirements(programId);
  if (programReqs) {
    for (const requiredSection of programReqs.requiredSections) {
      const found = [...headingSet].some(
        (h) => h === requiredSection || h.includes(requiredSection)
      );
      if (!found) {
        missingItems.push({
          section: requiredSection,
          description: `프로그램 "${programId}"의 필수 섹션 "${requiredSection}"이(가) 없습니다.`,
          severity: "critical",
        });
        continue;
      }

      const length = getSectionContentLength(documentContent, requiredSection);
      if (length < programReqs.minLength) {
        missingItems.push({
          section: requiredSection,
          description: `"${requiredSection}" 섹션이 프로그램 최소 길이 기준 미달 (${length}자, 최소 ${programReqs.minLength}자 필요).`,
          severity: "minor",
        });
      }
    }
  }

  const completenessScore = computeScore(missingItems, formatIssues);
  const isComplete =
    completenessScore >= 80 &&
    missingItems.filter((m) => m.severity === "critical").length === 0;

  return {
    isComplete,
    completenessScore,
    missingItems,
    formatIssues,
  };
}

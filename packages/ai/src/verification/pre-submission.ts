import type {
  DocumentData,
  VerificationIssue,
  VerificationResult,
} from "./types.js";

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

const REQUIRED_SECTIONS = [
  "사업 개요",
  "시장 분석",
  "추진 전략",
  "재무 계획",
  "조직 및 인력",
] as const;

const MIN_SECTION_LENGTH = 100;

const RECOMMENDED_ATTACHMENTS = ["사업자등록증", "재무제표"] as const;

// ---------------------------------------------------------------------------
// verifyPreSubmission
// ---------------------------------------------------------------------------

export function verifyPreSubmission(doc: DocumentData): VerificationResult {
  const issues: VerificationIssue[] = [];
  const recommendations: string[] = [];

  const sectionNames = new Set(doc.sections.map((s) => s.name));

  // 1. Required sections check
  for (const required of REQUIRED_SECTIONS) {
    if (!sectionNames.has(required)) {
      issues.push({
        ruleId: "MISSING_SECTION",
        severity: "error",
        message: `필수 섹션 "${required}"이(가) 누락되었습니다.`,
        location: required,
      });
    }
  }

  // 2. Section length check
  for (const section of doc.sections) {
    if (section.content.length < MIN_SECTION_LENGTH) {
      issues.push({
        ruleId: "SHORT_CONTENT",
        severity: "warning",
        message: `"${section.name}" 섹션의 내용이 최소 길이(${MIN_SECTION_LENGTH}자) 미만입니다. (현재 ${section.content.length}자)`,
        location: section.name,
      });
    }
  }

  // 3. Recommended attachments check
  const attachmentSet = new Set(doc.attachments);
  for (const recommended of RECOMMENDED_ATTACHMENTS) {
    if (!attachmentSet.has(recommended)) {
      issues.push({
        ruleId: "MISSING_ATTACHMENT",
        severity: "warning",
        message: `권장 첨부서류 "${recommended}"이(가) 누락되었습니다.`,
      });
      recommendations.push(`"${recommended}" 첨부를 권장합니다.`);
    }
  }

  // 4. Score calculation
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const rawScore = 100 - errorCount * 20 - warningCount * 5;
  const score = Math.max(0, Math.min(100, rawScore));

  // 5. Passed determination
  const passed = errorCount === 0 && score >= 60;

  return { passed, score, issues, recommendations };
}

import { describe, it, expect } from "vitest";
import { verifyPreSubmission } from "../../src/verification/pre-submission.js";
import type { DocumentData } from "../../src/verification/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LONG_CONTENT = "이 섹션은 충분히 긴 내용을 포함합니다. ".repeat(10);

function makeCompleteDoc(overrides?: Partial<DocumentData>): DocumentData {
  return {
    title: "테스트 사업계획서",
    sections: [
      { name: "사업 개요", content: LONG_CONTENT },
      { name: "시장 분석", content: LONG_CONTENT },
      { name: "추진 전략", content: LONG_CONTENT },
      { name: "재무 계획", content: LONG_CONTENT },
      { name: "조직 및 인력", content: LONG_CONTENT },
    ],
    attachments: ["사업자등록증", "재무제표"],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("verifyPreSubmission", () => {
  describe("complete document", () => {
    it("passes with all required sections, sufficient length, and recommended attachments", () => {
      const result = verifyPreSubmission(makeCompleteDoc());
      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.issues).toHaveLength(0);
      expect(result.recommendations).toHaveLength(0);
    });
  });

  describe("missing sections", () => {
    it("fails when a required section is missing", () => {
      const doc = makeCompleteDoc({
        sections: [
          { name: "사업 개요", content: LONG_CONTENT },
          { name: "시장 분석", content: LONG_CONTENT },
          // "추진 전략" missing
          { name: "재무 계획", content: LONG_CONTENT },
          { name: "조직 및 인력", content: LONG_CONTENT },
        ],
      });

      const result = verifyPreSubmission(doc);
      expect(result.passed).toBe(false);

      const errors = result.issues.filter((i) => i.severity === "error");
      expect(errors).toHaveLength(1);
      expect(errors[0]!.ruleId).toBe("MISSING_SECTION");
      expect(errors[0]!.location).toBe("추진 전략");
    });

    it("fails when multiple required sections are missing", () => {
      const doc = makeCompleteDoc({
        sections: [{ name: "사업 개요", content: LONG_CONTENT }],
      });

      const result = verifyPreSubmission(doc);
      expect(result.passed).toBe(false);

      const errors = result.issues.filter((i) => i.severity === "error");
      expect(errors).toHaveLength(4); // 4 of 5 missing
    });

    it("fails even if score would be >= 60 when errors exist", () => {
      const doc = makeCompleteDoc({
        sections: [
          { name: "사업 개요", content: LONG_CONTENT },
          { name: "시장 분석", content: LONG_CONTENT },
          { name: "추진 전략", content: LONG_CONTENT },
          { name: "재무 계획", content: LONG_CONTENT },
          // "조직 및 인력" missing → 1 error → score = 80
        ],
      });

      const result = verifyPreSubmission(doc);
      expect(result.score).toBe(80);
      expect(result.passed).toBe(false); // error count > 0
    });
  });

  describe("short content warning", () => {
    it("warns when section content is below minimum length", () => {
      const doc = makeCompleteDoc({
        sections: [
          { name: "사업 개요", content: "짧은 내용" },
          { name: "시장 분석", content: LONG_CONTENT },
          { name: "추진 전략", content: LONG_CONTENT },
          { name: "재무 계획", content: LONG_CONTENT },
          { name: "조직 및 인력", content: LONG_CONTENT },
        ],
      });

      const result = verifyPreSubmission(doc);
      const warnings = result.issues.filter(
        (i) => i.severity === "warning" && i.ruleId === "SHORT_CONTENT"
      );
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.location).toBe("사업 개요");
    });

    it("still passes with only warnings (no errors)", () => {
      const doc = makeCompleteDoc({
        sections: [
          { name: "사업 개요", content: "짧은 내용" },
          { name: "시장 분석", content: LONG_CONTENT },
          { name: "추진 전략", content: LONG_CONTENT },
          { name: "재무 계획", content: LONG_CONTENT },
          { name: "조직 및 인력", content: LONG_CONTENT },
        ],
      });

      const result = verifyPreSubmission(doc);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(95); // 100 - 1 warning * 5
    });
  });

  describe("missing attachments warning", () => {
    it("warns when recommended attachments are missing", () => {
      const doc = makeCompleteDoc({ attachments: [] });
      const result = verifyPreSubmission(doc);

      const warnings = result.issues.filter(
        (i) => i.severity === "warning" && i.ruleId === "MISSING_ATTACHMENT"
      );
      expect(warnings).toHaveLength(2);
      expect(result.recommendations).toHaveLength(2);
    });

    it("still passes when only attachments are missing", () => {
      const doc = makeCompleteDoc({ attachments: [] });
      const result = verifyPreSubmission(doc);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(90); // 100 - 2 warnings * 5
    });
  });

  describe("score bounds", () => {
    it("score never exceeds 100", () => {
      const doc = makeCompleteDoc();
      const result = verifyPreSubmission(doc);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("score never goes below 0", () => {
      const doc: DocumentData = {
        title: "",
        sections: [],
        attachments: [],
      };
      const result = verifyPreSubmission(doc);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it("clamps score to 0 when too many errors", () => {
      // 5 missing sections = 5 errors * 20 = 100 deduction
      // + 2 missing attachments = 2 warnings * 5 = 10 deduction
      // raw = 100 - 100 - 10 = -10, clamped to 0
      const doc: DocumentData = {
        title: "",
        sections: [],
        attachments: [],
      };
      const result = verifyPreSubmission(doc);
      expect(result.score).toBe(0);
      expect(result.passed).toBe(false);
    });

    it("correct score with mixed errors and warnings", () => {
      // 1 missing section (error, -20) + 1 short content (warning, -5) + 2 missing attachments (warnings, -10)
      // raw = 100 - 20 - 5 - 10 = 65
      const doc = makeCompleteDoc({
        sections: [
          { name: "사업 개요", content: "짧은" },
          { name: "시장 분석", content: LONG_CONTENT },
          { name: "추진 전략", content: LONG_CONTENT },
          { name: "재무 계획", content: LONG_CONTENT },
          // "조직 및 인력" missing
        ],
        attachments: [],
      });
      const result = verifyPreSubmission(doc);
      expect(result.score).toBe(65);
      expect(result.passed).toBe(false); // has errors
    });
  });
});

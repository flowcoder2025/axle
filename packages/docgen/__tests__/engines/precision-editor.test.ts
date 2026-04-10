import { describe, it, expect } from "vitest";
import { generatePrecisionDocx } from "../../src/engines/precision-editor.js";
import type { DocumentSection } from "../../src/types.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SAMPLE_SECTIONS: DocumentSection[] = [
  {
    title: "사업 개요",
    content:
      "본 사업은 AI 기반 중소기업 지원 플랫폼 구축을 목표로 합니다. " +
      "혁신적인 기술을 활용하여 기업의 성장을 지원하고 경쟁력을 강화합니다.",
  },
  {
    title: "기술 설명",
    content:
      "자연어 처리(NLP) 및 벡터 검색 기술을 활용하여 사업계획서를 자동으로 분석하고 " +
      "맞춤형 조언을 제공합니다. RAG(Retrieval-Augmented Generation) 아키텍처 기반입니다.",
  },
  {
    title: "시장 분석",
    content:
      "국내 중소기업 지원 시장 규모는 연간 5조원 이상으로 추정되며 " +
      "연평균 8% 성장세를 보이고 있습니다.",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Checks that the buffer starts with the DOCX/ZIP magic bytes (PK\x03\x04).
 * A valid DOCX is a ZIP archive containing XML files.
 */
function isValidDocxBuffer(buf: Buffer): boolean {
  return (
    buf.length > 4 &&
    buf[0] === 0x50 && // P
    buf[1] === 0x4b && // K
    buf[2] === 0x03 &&
    buf[3] === 0x04
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("generatePrecisionDocx", () => {
  it("returns a non-empty buffer", async () => {
    const result = await generatePrecisionDocx({
      draftSections: SAMPLE_SECTIONS,
    });

    expect(result.docxBuffer).toBeInstanceOf(Buffer);
    expect(result.docxBuffer.length).toBeGreaterThan(0);
  });

  it("returns a valid DOCX (ZIP) buffer", async () => {
    const result = await generatePrecisionDocx({
      draftSections: SAMPLE_SECTIONS,
    });

    expect(isValidDocxBuffer(result.docxBuffer)).toBe(true);
  });

  it("returns a fileName with .docx extension", async () => {
    const result = await generatePrecisionDocx({
      draftSections: SAMPLE_SECTIONS,
    });

    expect(result.fileName).toMatch(/\.docx$/);
  });

  it("fileName includes section title slug", async () => {
    const result = await generatePrecisionDocx({
      draftSections: SAMPLE_SECTIONS,
    });

    // First section title is "사업 개요" → slug "사업_개요"
    expect(result.fileName).toContain("사업_개요");
  });

  it("handles single section without error", async () => {
    const result = await generatePrecisionDocx({
      draftSections: [SAMPLE_SECTIONS[0]!],
    });

    expect(isValidDocxBuffer(result.docxBuffer)).toBe(true);
    expect(result.fileName).toMatch(/\.docx$/);
  });

  it("applies programRequirements section title mapping", async () => {
    const result = await generatePrecisionDocx({
      draftSections: [{ title: "사업 개요", content: "내용입니다." }],
      programRequirements: {
        "사업 개요": "Project Overview",
      },
    });

    // Should still produce a valid DOCX even with title remapping
    expect(isValidDocxBuffer(result.docxBuffer)).toBe(true);
  });

  it("handles empty sections array gracefully", async () => {
    const result = await generatePrecisionDocx({
      draftSections: [],
    });

    expect(result.docxBuffer).toBeInstanceOf(Buffer);
    expect(result.fileName).toMatch(/\.docx$/);
  });

  it("larger document produces larger buffer than single section", async () => {
    const single = await generatePrecisionDocx({
      draftSections: [SAMPLE_SECTIONS[0]!],
    });
    const full = await generatePrecisionDocx({
      draftSections: SAMPLE_SECTIONS,
    });

    expect(full.docxBuffer.length).toBeGreaterThan(single.docxBuffer.length);
  });
});

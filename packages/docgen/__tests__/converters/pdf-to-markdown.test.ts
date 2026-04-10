import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock pdf-parse before importing the converter ─────────────────────────────
vi.mock("pdf-parse", () => ({
  default: vi.fn(),
}));

import pdfParse from "pdf-parse";
import { pdfToMarkdown } from "../../src/converters/pdf-to-markdown.js";

const mockPdfParse = vi.mocked(pdfParse);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePdfBuffer(): Buffer {
  return Buffer.from("fake-pdf");
}

function setupMock(text: string) {
  mockPdfParse.mockResolvedValue({
    text,
    numpages: 1,
    numrender: 1,
    info: {},
    metadata: null,
    version: "1.7",
  } as unknown as Awaited<ReturnType<typeof pdfParse>>);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("pdfToMarkdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty string for empty PDF text", async () => {
    setupMock("");
    const result = await pdfToMarkdown(makePdfBuffer());
    expect(result).toBe("");
  });

  it("converts plain paragraph text", async () => {
    setupMock("This is a simple paragraph with some text.");
    const result = await pdfToMarkdown(makePdfBuffer());
    expect(result).toContain("This is a simple paragraph with some text.");
  });

  it("detects a heading candidate (short, no punctuation)", async () => {
    setupMock("Introduction\nThis is the body text.");
    const result = await pdfToMarkdown(makePdfBuffer());
    // First heading → H1
    expect(result).toMatch(/^# Introduction/m);
    expect(result).toContain("This is the body text.");
  });

  it("does not treat long lines as headings", async () => {
    const longLine =
      "This is a very long line that should not be treated as a heading because it exceeds the limit.";
    setupMock(longLine);
    const result = await pdfToMarkdown(makePdfBuffer());
    expect(result).not.toMatch(/^#/m);
    expect(result).toContain(longLine);
  });

  it("does not treat punctuated lines as headings", async () => {
    setupMock("Ends with period.\nAnother sentence.");
    const result = await pdfToMarkdown(makePdfBuffer());
    expect(result).not.toMatch(/^#/m);
  });

  it("detects unordered list items", async () => {
    setupMock("- Item one\n- Item two\n- Item three");
    const result = await pdfToMarkdown(makePdfBuffer());
    expect(result).toMatch(/^- Item one/m);
    expect(result).toMatch(/^- Item two/m);
    expect(result).toMatch(/^- Item three/m);
  });

  it("detects ordered list items", async () => {
    setupMock("1. First\n2. Second\n3. Third");
    const result = await pdfToMarkdown(makePdfBuffer());
    expect(result).toMatch(/^1\. First/m);
    expect(result).toMatch(/^1\. Second/m);
    expect(result).toMatch(/^1\. Third/m);
  });

  it("preserves pipe-delimited table structure", async () => {
    const tableText =
      "| Name | Age |\n| John | 30 |\n| Jane | 25 |";
    setupMock(tableText);
    const result = await pdfToMarkdown(makePdfBuffer());
    expect(result).toContain("| Name | Age |");
    // Separator row should be inserted after header
    expect(result).toMatch(/\| --- \|/);
    expect(result).toContain("| John | 30 |");
    expect(result).toContain("| Jane | 25 |");
  });

  it("combines consecutive paragraph lines into one block", async () => {
    setupMock("Line one.\nLine two.\nLine three.");
    const result = await pdfToMarkdown(makePdfBuffer());
    expect(result).toContain("Line one. Line two. Line three.");
  });

  it("handles multiple sections with headings and paragraphs", async () => {
    const text = [
      "Overview",
      "This is overview content.",
      "",
      "Details",
      "These are the details.",
    ].join("\n");
    setupMock(text);
    const result = await pdfToMarkdown(makePdfBuffer());
    expect(result).toMatch(/^# Overview/m);
    expect(result).toContain("This is overview content.");
    expect(result).toMatch(/^## Details/m);
    expect(result).toContain("These are the details.");
  });

  it("strips excessive blank lines (max 2 consecutive newlines)", async () => {
    setupMock("First paragraph.\n\n\n\nSecond paragraph.");
    const result = await pdfToMarkdown(makePdfBuffer());
    expect(result).not.toMatch(/\n{3,}/);
  });

  it("passes the buffer to pdf-parse", async () => {
    setupMock("Content");
    const buf = makePdfBuffer();
    await pdfToMarkdown(buf);
    expect(mockPdfParse).toHaveBeenCalledWith(buf);
  });
});

import { describe, it, expect, vi } from "vitest";
import { extractText } from "../../src/converters/text-parser.js";

vi.mock("pdf-parse", () => ({
  default: vi.fn().mockResolvedValue({
    text: "PDF content here",
    numpages: 3,
    info: { Title: "Test PDF", Author: "Author" },
  }),
}));

vi.mock("jszip", () => {
  const mockFile = (content: string) => ({ async: () => Promise.resolve(content) });
  return {
    default: vi.fn().mockImplementation(() => ({
      loadAsync: vi.fn().mockResolvedValue({
        file: (name: string) => {
          if (name === "Contents/section0.xml") return mockFile("<TEXT><P><T>HWPX content</T></P></TEXT>");
          if (name === "word/document.xml") return mockFile("<w:body><w:p><w:r><w:t>DOCX text</w:t></w:r></w:p></w:body>");
          return null;
        },
      }),
    })),
  };
});

describe("extractText", () => {
  it("extracts text from PDF buffer", async () => {
    const buffer = Buffer.from("fake-pdf");
    const result = await extractText(buffer, "pdf");
    expect(result.text).toBe("PDF content here");
    expect(result.metadata.fileType).toBe("pdf");
    expect(result.metadata.pageCount).toBe(3);
  });

  it("extracts text from HWPX buffer", async () => {
    const buffer = Buffer.from("fake-hwpx");
    const result = await extractText(buffer, "hwpx");
    expect(result.text).toContain("HWPX content");
    expect(result.metadata.fileType).toBe("hwpx");
  });

  it("returns guidance for HWP binary format", async () => {
    const buffer = Buffer.from("fake-hwp");
    const result = await extractText(buffer, "hwp");
    expect(result.metadata.fileType).toBe("hwp");
    expect(result.text).toContain("HWPX");
  });

  it("throws on unsupported file type", async () => {
    await expect(extractText(Buffer.from("x"), "xyz")).rejects.toThrow("Unsupported");
  });
});

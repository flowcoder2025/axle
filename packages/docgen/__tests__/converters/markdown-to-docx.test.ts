import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { markdownToDocx } from "../../src/converters/markdown-to-docx.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extracts word/document.xml from the DOCX ZIP and returns its text content.
 * This lets us assert on the XML without binary-encoding hacks.
 */
async function extractDocumentXml(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("word/document.xml not found in DOCX");
  return file.async("string");
}

/**
 * Extracts docProps/core.xml which contains title/creator metadata.
 */
async function extractCoreXml(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const file = zip.file("docProps/core.xml");
  if (!file) throw new Error("docProps/core.xml not found in DOCX");
  return file.async("string");
}

/**
 * Extracts word/styles.xml which contains font settings.
 */
async function extractStylesXml(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const file = zip.file("word/styles.xml");
  if (!file) throw new Error("word/styles.xml not found in DOCX");
  return file.async("string");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("markdownToDocx", () => {
  it("returns a non-empty Buffer", async () => {
    const buf = await markdownToDocx("Hello world");
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it("produces a valid DOCX (ZIP) file signature", async () => {
    const buf = await markdownToDocx("# Test");
    // DOCX files begin with the ZIP magic bytes: PK\x03\x04
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });

  it("embeds heading text in word/document.xml", async () => {
    const buf = await markdownToDocx("# My Heading");
    const xml = await extractDocumentXml(buf);
    expect(xml).toContain("My Heading");
  });

  it("embeds paragraph text in word/document.xml", async () => {
    const buf = await markdownToDocx("This is a paragraph.");
    const xml = await extractDocumentXml(buf);
    expect(xml).toContain("This is a paragraph.");
  });

  it("handles multiple heading levels", async () => {
    const md = "# H1\n## H2\n### H3";
    const buf = await markdownToDocx(md);
    const xml = await extractDocumentXml(buf);
    expect(xml).toContain("H1");
    expect(xml).toContain("H2");
    expect(xml).toContain("H3");
  });

  it("embeds bullet list items in word/document.xml", async () => {
    const md = "- Apple\n- Banana\n- Cherry";
    const buf = await markdownToDocx(md);
    const xml = await extractDocumentXml(buf);
    expect(xml).toContain("Apple");
    expect(xml).toContain("Banana");
    expect(xml).toContain("Cherry");
  });

  it("embeds ordered list items in word/document.xml", async () => {
    const md = "1. First\n2. Second\n3. Third";
    const buf = await markdownToDocx(md);
    const xml = await extractDocumentXml(buf);
    expect(xml).toContain("First");
    expect(xml).toContain("Second");
    expect(xml).toContain("Third");
  });

  it("embeds table cell content in word/document.xml", async () => {
    const md = "| Name | Value |\n| --- | --- |\n| Foo | Bar |";
    const buf = await markdownToDocx(md);
    const xml = await extractDocumentXml(buf);
    expect(xml).toContain("Name");
    expect(xml).toContain("Value");
    expect(xml).toContain("Foo");
    expect(xml).toContain("Bar");
  });

  it("embeds code block content in word/document.xml", async () => {
    const md = "```js\nconst x = 1;\n```";
    const buf = await markdownToDocx(md);
    const xml = await extractDocumentXml(buf);
    expect(xml).toContain("const x = 1;");
  });

  it("embeds bold text in word/document.xml", async () => {
    const buf = await markdownToDocx("**Bold text here**");
    const xml = await extractDocumentXml(buf);
    expect(xml).toContain("Bold text here");
    // Bold run should have <w:b/> in XML
    expect(xml).toContain("<w:b/>");
  });

  it("embeds italic text in word/document.xml", async () => {
    const buf = await markdownToDocx("*Italic text here*");
    const xml = await extractDocumentXml(buf);
    expect(xml).toContain("Italic text here");
    // Italic run should have <w:i/> in XML
    expect(xml).toContain("<w:i/>");
  });

  it("uses custom title in docProps/core.xml", async () => {
    const buf = await markdownToDocx("content", { title: "My Custom Title" });
    const coreXml = await extractCoreXml(buf);
    expect(coreXml).toContain("My Custom Title");
  });

  it("accepts a custom fontFamily option without error", async () => {
    const buf = await markdownToDocx("Hello", { fontFamily: "Arial" });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.byteLength).toBeGreaterThan(0);
    // Font name appears in document or styles XML
    const docXml = await extractDocumentXml(buf);
    const stylesXml = await extractStylesXml(buf);
    const combined = docXml + stylesXml;
    expect(combined).toContain("Arial");
  });

  it("handles empty markdown gracefully", async () => {
    const buf = await markdownToDocx("");
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it("handles mixed content without throwing", async () => {
    const md = [
      "# Title",
      "",
      "Intro paragraph.",
      "",
      "## Section",
      "",
      "- item1",
      "- item2",
      "",
      "1. step one",
      "2. step two",
      "",
      "| Col A | Col B |",
      "| --- | --- |",
      "| val1 | val2 |",
      "",
      "```python",
      "print('hello')",
      "```",
    ].join("\n");

    await expect(markdownToDocx(md)).resolves.not.toThrow();
    const buf = await markdownToDocx(md);
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it("uses 맑은 고딕 Korean font in styles or document XML", async () => {
    const buf = await markdownToDocx("안녕하세요");
    const docXml = await extractDocumentXml(buf);
    const stylesXml = await extractStylesXml(buf);
    const combined = docXml + stylesXml;
    expect(combined).toContain("맑은 고딕");
  });
});

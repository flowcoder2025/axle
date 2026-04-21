import { describe, it, expect, beforeAll } from "vitest";
import JSZip from "jszip";

import {
  ZipXmlHwpxAdapter,
  getDefaultHwpxAdapter,
} from "../../../src/converters/hwpx/index.js";
import type {
  HwpxEdit,
  HwpxEditorAdapter,
} from "../../../src/converters/hwpx/index.js";

// ── Minimal HWPX fixture ──────────────────────────────────────────────────────

async function buildMinimalHwpx(sectionXml: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("Contents/section0.xml", sectionXml);
  zip.file("mimetype", "application/haansofthwp");
  return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
}

const SECTION_XML = `<?xml version="1.0" encoding="UTF-8"?>
<hp:HWPXMLDocument xmlns:hp="urn:schemas-microsoft-com:office:hp">
  <hp:body>
    <hp:section>
      <hp:p>
        <hp:tbl>
          <hp:tr>
            <hp:tc><hp:p><hp:t>원본셀</hp:t></hp:p></hp:tc>
          </hp:tr>
        </hp:tbl>
      </hp:p>
      <hp:p>
        <hp:t>원본 문단 텍스트</hp:t>
      </hp:p>
    </hp:section>
  </hp:body>
</hp:HWPXMLDocument>`;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("HwpxEditorAdapter — contract compliance", () => {
  let templateBuf: Buffer;

  beforeAll(async () => {
    templateBuf = await buildMinimalHwpx(SECTION_XML);
  });

  it("getDefaultHwpxAdapter returns a ZipXmlHwpxAdapter", () => {
    const adapter = getDefaultHwpxAdapter();
    expect(adapter).toBeInstanceOf(ZipXmlHwpxAdapter);
  });

  it("ZipXmlHwpxAdapter implements the HwpxEditorAdapter interface", () => {
    const adapter: HwpxEditorAdapter = new ZipXmlHwpxAdapter();
    expect(typeof adapter.loadTemplate).toBe("function");
    expect(typeof adapter.applyEdits).toBe("function");
    expect(typeof adapter.save).toBe("function");
  });

  it("round-trip: loadTemplate → applyEdits → save returns a valid HWPX buffer", async () => {
    const adapter: HwpxEditorAdapter = new ZipXmlHwpxAdapter();
    const edits: HwpxEdit[] = [
      { type: "replace_text", search: "원본 문단 텍스트", replacement: "수정된 문단" },
      { type: "set_cell", table: 0, row: 0, col: 0, value: "새 셀값" },
    ];

    const doc = await adapter.loadTemplate(templateBuf);
    const edited = await adapter.applyEdits(doc, edits);
    const out = await adapter.save(edited);

    expect(out).toBeInstanceOf(Buffer);
    expect(out.length).toBeGreaterThan(0);
    // Must still be a valid ZIP
    expect(out[0]).toBe(0x50);
    expect(out[1]).toBe(0x4b);

    const zip = await JSZip.loadAsync(out);
    const xml = await zip.file("Contents/section0.xml")!.async("string");
    expect(xml).toContain("수정된 문단");
    expect(xml).toContain("새 셀값");
    expect(xml).not.toContain("원본 문단 텍스트");
    expect(xml).not.toContain("원본셀");

    // Preserves untouched entries
    const mime = await zip.file("mimetype")!.async("string");
    expect(mime).toContain("application/haansofthwp");
  });

  it("applyEdits with empty edits leaves content intact", async () => {
    const adapter = new ZipXmlHwpxAdapter();
    const doc = await adapter.loadTemplate(templateBuf);
    const edited = await adapter.applyEdits(doc, []);
    const out = await adapter.save(edited);

    const zip = await JSZip.loadAsync(out);
    const xml = await zip.file("Contents/section0.xml")!.async("string");
    expect(xml).toContain("원본 문단 텍스트");
    expect(xml).toContain("원본셀");
  });

  it("rejects invalid document handles passed to applyEdits", async () => {
    const adapter = new ZipXmlHwpxAdapter();
    await expect(adapter.applyEdits({ notAZip: true }, [])).rejects.toThrow(
      /invalid document handle/
    );
  });

  it("rejects invalid document handles passed to save", async () => {
    const adapter = new ZipXmlHwpxAdapter();
    await expect(adapter.save({ notAZip: true })).rejects.toThrow(/invalid document handle/);
  });
});

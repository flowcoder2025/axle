import { describe, it, expect, beforeAll } from "vitest";
import JSZip from "jszip";
import { editHwpx, HwpxEdit } from "../../src/converters/hwpx-editor.js";

// ── Minimal HWPX fixture ──────────────────────────────────────────────────────

/**
 * Builds a minimal HWPX ZIP containing a single section XML file.
 * The XML mimics the hp namespace structure used by HWP XML.
 */
async function buildMinimalHwpx(sectionXml: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("Contents/section0.xml", sectionXml);
  zip.file(
    "mimetype",
    "application/haansofthwp"
  );
  return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
}

const SECTION_WITH_TABLE = `<?xml version="1.0" encoding="UTF-8"?>
<hp:HWPXMLDocument xmlns:hp="urn:schemas-microsoft-com:office:hp">
  <hp:body>
    <hp:section>
      <hp:p>
        <hp:tbl>
          <hp:tr>
            <hp:tc><hp:p><hp:t>셀A1</hp:t></hp:p></hp:tc>
            <hp:tc><hp:p><hp:t>셀B1</hp:t></hp:p></hp:tc>
          </hp:tr>
          <hp:tr>
            <hp:tc><hp:p><hp:t>셀A2</hp:t></hp:p></hp:tc>
            <hp:tc><hp:p><hp:t>셀B2</hp:t></hp:p></hp:tc>
          </hp:tr>
        </hp:tbl>
      </hp:p>
      <hp:p>
        <hp:t>일반 텍스트 내용입니다.</hp:t>
      </hp:p>
    </hp:section>
  </hp:body>
</hp:HWPXMLDocument>`;

const SECTION_WITH_CHECKBOX = `<?xml version="1.0" encoding="UTF-8"?>
<hp:HWPXMLDocument xmlns:hp="urn:schemas-microsoft-com:office:hp">
  <hp:body>
    <hp:section>
      <hp:p>
        <hp:field name="myCheckbox" type="checkbox" checked="false">체크박스</hp:field>
      </hp:p>
    </hp:section>
  </hp:body>
</hp:HWPXMLDocument>`;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("editHwpx", () => {
  let tableHwpx: Buffer;
  let checkboxHwpx: Buffer;

  beforeAll(async () => {
    tableHwpx = await buildMinimalHwpx(SECTION_WITH_TABLE);
    checkboxHwpx = await buildMinimalHwpx(SECTION_WITH_CHECKBOX);
  });

  it("returns a Buffer from templateBuffer", async () => {
    const result = await editHwpx({ templateBuffer: tableHwpx }, []);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  it("output is a valid ZIP (PK magic bytes)", async () => {
    const result = await editHwpx({ templateBuffer: tableHwpx }, []);
    expect(result[0]).toBe(0x50); // P
    expect(result[1]).toBe(0x4b); // K
    expect(result[2]).toBe(0x03);
    expect(result[3]).toBe(0x04);
  });

  it("replace_text: replaces matching text across the section XML", async () => {
    const edits: HwpxEdit[] = [
      { type: "replace_text", search: "일반 텍스트 내용입니다.", replacement: "수정된 텍스트입니다." },
    ];
    const result = await editHwpx({ templateBuffer: tableHwpx }, edits);

    // Load result ZIP and verify section XML was modified
    const zip = await JSZip.loadAsync(result);
    const sectionFile = zip.file("Contents/section0.xml");
    expect(sectionFile).not.toBeNull();
    const xml = await sectionFile!.async("string");
    expect(xml).toContain("수정된 텍스트입니다.");
    expect(xml).not.toContain("일반 텍스트 내용입니다.");
  });

  it("replace_text: leaves non-matching content unchanged", async () => {
    const edits: HwpxEdit[] = [
      { type: "replace_text", search: "존재하지않는텍스트", replacement: "NEW" },
    ];
    const result = await editHwpx({ templateBuffer: tableHwpx }, edits);
    const zip = await JSZip.loadAsync(result);
    const xml = await zip.file("Contents/section0.xml")!.async("string");
    expect(xml).toContain("일반 텍스트 내용입니다.");
  });

  it("toggle_checkbox: sets checked attribute to true", async () => {
    const edits: HwpxEdit[] = [
      { type: "toggle_checkbox", name: "myCheckbox", checked: true },
    ];
    const result = await editHwpx({ templateBuffer: checkboxHwpx }, edits);
    const zip = await JSZip.loadAsync(result);
    const xml = await zip.file("Contents/section0.xml")!.async("string");
    // The checked attribute should now be set to "true"
    expect(xml).toContain('checked="true"');
  });

  it("applies multiple edits in one call", async () => {
    const edits: HwpxEdit[] = [
      { type: "replace_text", search: "일반 텍스트 내용입니다.", replacement: "다중 편집 결과" },
      { type: "replace_text", search: "셀A1", replacement: "편집셀A1" },
    ];
    const result = await editHwpx({ templateBuffer: tableHwpx }, edits);
    const zip = await JSZip.loadAsync(result);
    const xml = await zip.file("Contents/section0.xml")!.async("string");
    expect(xml).toContain("다중 편집 결과");
    expect(xml).toContain("편집셀A1");
  });

  it("preserves other ZIP entries (mimetype)", async () => {
    const result = await editHwpx({ templateBuffer: tableHwpx }, []);
    const zip = await JSZip.loadAsync(result);
    const mimeFile = zip.file("mimetype");
    expect(mimeFile).not.toBeNull();
    const mimeContent = await mimeFile!.async("string");
    expect(mimeContent).toContain("application/haansofthwp");
  });

  it("throws when no template source is provided", async () => {
    await expect(editHwpx({}, [])).rejects.toThrow();
  });

  it("handles empty edits array without error", async () => {
    const result = await editHwpx({ templateBuffer: tableHwpx }, []);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });
});

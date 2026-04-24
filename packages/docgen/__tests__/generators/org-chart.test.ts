import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  generateOrgChartMermaid,
  generateOrgChartDocx,
  type OrgChartStructure,
} from "../../src/generators/org-chart.js";

const baseChart: OrgChartStructure = {
  companyName: "주식회사 제이이티",
  ceo: { name: "김희수", position: "대표이사" },
  departments: [
    { name: "경영지원팀", members: [{ name: "김창수", position: "팀장" }] },
    {
      name: "생산팀",
      members: [
        { name: "백성영", position: "사원" },
        { name: "안정빈", position: "사원" },
      ],
    },
    {
      name: "연구개발전담부서",
      members: [{ name: "심재경", position: "연구팀장" }],
    },
  ],
};

describe("generateOrgChartMermaid", () => {
  it("starts with flowchart TD header", () => {
    const out = generateOrgChartMermaid(baseChart);
    expect(out.split("\n")[0]).toBe("flowchart TD");
  });

  it("renders CEO node with company name and title", () => {
    const out = generateOrgChartMermaid(baseChart);
    expect(out).toContain("CEO[");
    expect(out).toContain("김희수");
    expect(out).toContain("대표이사");
    expect(out).toContain("주식회사 제이이티");
  });

  it("renders every department and its members", () => {
    const out = generateOrgChartMermaid(baseChart);
    expect(out).toContain("경영지원팀");
    expect(out).toContain("김창수 팀장");
    expect(out).toContain("백성영 사원");
    expect(out).toContain("안정빈 사원");
    expect(out).toContain("연구개발전담부서");
    expect(out).toContain("심재경 연구팀장");
  });

  it("connects every department to CEO", () => {
    const out = generateOrgChartMermaid(baseChart);
    for (let i = 1; i <= baseChart.departments.length; i += 1) {
      expect(out).toContain(`CEO --> D${i}`);
    }
  });

  it("applies classDef styles to CEO and departments", () => {
    const out = generateOrgChartMermaid(baseChart);
    expect(out).toContain("classDef ceo");
    expect(out).toContain("classDef dept");
    expect(out).toContain("class CEO ceo");
    expect(out).toContain("class D1,D2,D3 dept");
  });

  it("handles department with no members", () => {
    const out = generateOrgChartMermaid({
      ...baseChart,
      departments: [{ name: "신설팀", members: [] }],
    });
    expect(out).toContain("신설팀");
  });

  it("handles member with no position", () => {
    const out = generateOrgChartMermaid({
      companyName: "Acme",
      ceo: { name: "홍길동" },
      departments: [{ name: "개발팀", members: [{ name: "이순신" }] }],
    });
    expect(out).toContain("홍길동");
    expect(out).toContain("이순신");
    expect(out).not.toContain("이순신 undefined");
  });

  it("encodes HTML entities in labels to prevent SVG XSS", () => {
    const out = generateOrgChartMermaid({
      companyName: "<script>alert(1)</script>",
      ceo: {
        name: '<img src=x onerror="alert(2)">',
        position: "CEO & CTO",
      },
      departments: [
        {
          name: "<b onclick=evil()>hack</b>",
          members: [{ name: "a'b\"c", position: "pos" }],
        },
      ],
    });
    // Extract only the label content inside `NODE["..."]` — that's where
    // user input lives. Generator-owned tags (<b>, <br/>, <i>) are stripped
    // so any remaining `<` or `>` would mean user input slipped through
    // unescaped.
    const labels = Array.from(out.matchAll(/\["([^"]*)"\]/g)).map((m) => m[1]);
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      const stripped = label
        .replace(/<\/?b>/g, "")
        .replace(/<br\/>/g, "")
        .replace(/<\/?i>/g, "");
      expect(stripped).not.toContain("<");
      expect(stripped).not.toContain(">");
    }
    // HTML-encoded forms must be present.
    expect(out).toContain("&lt;script&gt;");
    expect(out).toContain("&amp;");
    expect(out).toContain("&quot;");
    expect(out).toContain("&#39;");
  });

  it("strips Mermaid-special punctuation that breaks the parser", () => {
    const out = generateOrgChartMermaid({
      companyName: "Acme [HQ] (North) {Main}|Sub",
      ceo: { name: "back`tick", position: "C.E.O." },
      departments: [],
    });
    // Brackets / braces / pipes / backticks would break `flowchart TD` parsing
    // when they appear INSIDE user-supplied labels.
    expect(out).not.toContain("[HQ]");
    expect(out).not.toContain("(North)");
    expect(out).not.toContain("{Main}");
    expect(out).not.toContain("|Sub");
    expect(out).not.toContain("back`tick");
    // Meaningful chars survive.
    expect(out).toContain("Acme HQ North MainSub");
    expect(out).toContain("backtick");
  });

  it("throws when companyName is missing", () => {
    expect(() =>
      generateOrgChartMermaid({
        companyName: "",
        ceo: { name: "x" },
        departments: [],
      }),
    ).toThrow(/companyName/);
  });

  it("throws when ceo.name is missing", () => {
    expect(() =>
      generateOrgChartMermaid({
        companyName: "Acme",
        ceo: { name: "" },
        departments: [],
      }),
    ).toThrow(/ceo\.name/);
  });

  it("produces deterministic output", () => {
    const out1 = generateOrgChartMermaid(baseChart);
    const out2 = generateOrgChartMermaid(baseChart);
    expect(out1).toBe(out2);
  });
});

// ─── WI-329: DOCX export ───────────────────────────────────────────────────

async function readDocumentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("word/document.xml missing from DOCX");
  return entry.async("string");
}

describe("generateOrgChartDocx", () => {
  it("returns a DOCX buffer + filename with the company name", async () => {
    const { docxBuffer, fileName } = await generateOrgChartDocx(baseChart);
    expect(docxBuffer).toBeInstanceOf(Buffer);
    expect(docxBuffer.byteLength).toBeGreaterThan(1000);
    expect(fileName).toContain("주식회사 제이이티");
    expect(fileName).toMatch(/조직도\.docx$/);
  });

  it("embeds CEO, company, and every department + member in the body", async () => {
    const { docxBuffer } = await generateOrgChartDocx(baseChart);
    const xml = await readDocumentXml(docxBuffer);
    expect(xml).toContain("주식회사 제이이티");
    expect(xml).toContain("김희수");
    expect(xml).toContain("경영지원팀");
    expect(xml).toContain("김창수");
    expect(xml).toContain("심재경");
    expect(xml).toContain("백성영");
  });

  it("embeds a PNG image when one is provided", async () => {
    const fakePng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG magic
      ...new Array(64).fill(0),
    ]);
    const { docxBuffer } = await generateOrgChartDocx(baseChart, {
      png: fakePng,
      pngWidthPx: 400,
      pngHeightPx: 300,
    });
    const zip = await JSZip.loadAsync(docxBuffer);
    // docx package stores images under word/media/*
    const mediaEntries = Object.keys(zip.files).filter((k) =>
      k.startsWith("word/media/"),
    );
    expect(mediaEntries.length).toBeGreaterThan(0);
  });

  it("omits the image section when no PNG is supplied", async () => {
    const { docxBuffer } = await generateOrgChartDocx(baseChart);
    const zip = await JSZip.loadAsync(docxBuffer);
    const mediaEntries = Object.keys(zip.files).filter((k) =>
      k.startsWith("word/media/"),
    );
    expect(mediaEntries.length).toBe(0);
  });

  it("sanitizes the filename from filesystem-special characters", async () => {
    const { fileName } = await generateOrgChartDocx({
      ...baseChart,
      companyName: "Acme/Co: *v1?",
    });
    expect(fileName).not.toMatch(/[\\/:*?"<>|]/);
    expect(fileName).toMatch(/조직도\.docx$/);
  });

  it("throws when companyName is missing", async () => {
    await expect(
      generateOrgChartDocx({ ...baseChart, companyName: "" }),
    ).rejects.toThrow(/companyName/);
  });
});

/**
 * Organization chart Mermaid generator.
 *
 * Produces a Mermaid `flowchart TD` string from an OrgChartStructure.
 * Rendered to SVG/PNG on the client via the `mermaid` library.
 *
 * Layout:
 *   CEO (root)
 *     └─ Department 1 (box with member list)
 *     └─ Department 2
 *     └─ ...
 */

export interface OrgChartMember {
  name: string;
  position?: string;
}

export interface OrgChartDepartment {
  name: string;
  members: OrgChartMember[];
}

export interface OrgChartStructure {
  companyName: string;
  ceo: OrgChartMember;
  departments: OrgChartDepartment[];
}

/**
 * Escapes user-supplied text so it can be safely embedded inside a Mermaid
 * node label that the caller constructs with its own `<b>`, `<br/>`, `<i>`
 * tags. Handles two concerns:
 *
 * 1. XSS — the UI renders Mermaid with `securityLevel: "loose"` (needed for
 *    `<br/>` + `<b>`), so any HTML tag in user input would be injected into
 *    the resulting SVG. All `<`, `>`, `&`, `"`, `'` are HTML-encoded.
 * 2. Mermaid parser safety — `[]{}()|` and backticks alter node/edge syntax,
 *    so they are stripped. Newlines become `<br/>` for in-label line breaks.
 *
 * Must be called on every user-controlled string; generator-owned tags
 * (`<b>`, `<br/>`, `<i>`) are added by the caller after escaping.
 */
function escapeLabel(text: string): string {
  return text
    .replace(/[`[\]{}()|]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br/>")
    .trim();
}

function formatMemberLine(member: OrgChartMember): string {
  const name = escapeLabel(member.name);
  const position = member.position ? escapeLabel(member.position) : "";
  return position ? `${name} ${position}` : name;
}

function formatDepartmentLabel(dept: OrgChartDepartment): string {
  const header = `<b>${escapeLabel(dept.name)}</b>`;
  if (dept.members.length === 0) return header;
  const lines = dept.members.map(formatMemberLine).join("<br/>");
  return `${header}<br/>${lines}`;
}

function formatCeoLabel(ceo: OrgChartMember, companyName: string): string {
  const title = ceo.position || "대표이사";
  const company = escapeLabel(companyName);
  const name = escapeLabel(ceo.name);
  return `<b>${escapeLabel(title)}</b><br/>${name}<br/><i>${company}</i>`;
}

/**
 * Generates a Mermaid `flowchart TD` string representing the given org chart.
 *
 * The output is deterministic (stable node ids) so snapshot tests are reliable.
 */
export function generateOrgChartMermaid(chart: OrgChartStructure): string {
  if (!chart.companyName?.trim()) {
    throw new Error("OrgChartStructure.companyName is required");
  }
  if (!chart.ceo?.name?.trim()) {
    throw new Error("OrgChartStructure.ceo.name is required");
  }

  const lines: string[] = ["flowchart TD"];
  const ceoLabel = formatCeoLabel(chart.ceo, chart.companyName);
  lines.push(`  CEO["${ceoLabel}"]`);

  chart.departments.forEach((dept, index) => {
    const nodeId = `D${index + 1}`;
    const label = formatDepartmentLabel(dept);
    lines.push(`  ${nodeId}["${label}"]`);
    lines.push(`  CEO --> ${nodeId}`);
  });

  lines.push("  classDef ceo fill:#2d6a8b,stroke:#1f4d66,color:#ffffff");
  lines.push("  classDef dept fill:#cfe6f0,stroke:#4a90a8,color:#102a3a");
  lines.push("  class CEO ceo");
  const deptIds = chart.departments.map((_, i) => `D${i + 1}`).join(",");
  if (deptIds) lines.push(`  class ${deptIds} dept`);

  return lines.join("\n");
}

// ─── DOCX export (WI-329) ─────────────────────────────────────────────────

import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  VerticalAlign,
  WidthType,
} from "docx";
import { buildDocxStyles, buildSectionProperties } from "../utils/docx-styles.js";
import { para, run, todayKorean } from "../utils/docx-helpers.js";

export interface OrgChartDocxOptions {
  /**
   * Optional PNG rendering of the chart. When provided, it is embedded as an
   * image at the top of the DOCX. The client usually produces this via
   * `html-to-image` in the Org Chart tab and uploads the buffer.
   */
  png?: Buffer;
  /**
   * Display width of the embedded PNG in DOCX pixels (used only when `png`
   * is supplied). Height is auto-scaled to preserve aspect ratio.
   */
  pngWidthPx?: number;
  pngHeightPx?: number;
  /** Document title — defaults to "{companyName} 조직도". */
  title?: string;
}

function buildHeaderParagraphs(chart: OrgChartStructure, title: string): Paragraph[] {
  return [
    new Paragraph({
      children: [run(title, { bold: true, size: 32 })],
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
    para(`작성일: ${todayKorean()}`, {
      align: AlignmentType.CENTER,
      spacingAfter: 200,
      size: 20,
    }),
    para(`대표자: ${chart.ceo.name}${chart.ceo.position ? ` (${chart.ceo.position})` : ""}`, {
      spacingAfter: 100,
      size: 22,
    }),
    para(`회사명: ${chart.companyName}`, { spacingAfter: 300, size: 22 }),
  ];
}

function buildHierarchyTable(chart: OrgChartStructure): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        children: [para("부서", { bold: true, align: AlignmentType.CENTER })],
        verticalAlign: VerticalAlign.CENTER,
        width: { size: 30, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [para("구성원", { bold: true, align: AlignmentType.CENTER })],
        verticalAlign: VerticalAlign.CENTER,
        width: { size: 50, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [para("인원", { bold: true, align: AlignmentType.CENTER })],
        verticalAlign: VerticalAlign.CENTER,
        width: { size: 20, type: WidthType.PERCENTAGE },
      }),
    ],
  });

  const bodyRows = chart.departments.map((dept) => {
    const membersText =
      dept.members.length > 0
        ? dept.members
            .map((m) => (m.position ? `${m.name} (${m.position})` : m.name))
            .join(", ")
        : "(미배정)";
    return new TableRow({
      children: [
        new TableCell({
          children: [para(dept.name)],
          verticalAlign: VerticalAlign.CENTER,
        }),
        new TableCell({
          children: [para(membersText)],
          verticalAlign: VerticalAlign.CENTER,
        }),
        new TableCell({
          children: [
            para(`${dept.members.length}명`, { align: AlignmentType.CENTER }),
          ],
          verticalAlign: VerticalAlign.CENTER,
        }),
      ],
    });
  });

  return new Table({
    rows: [headerRow, ...bodyRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function buildImageParagraph(
  png: Buffer,
  widthPx: number,
  heightPx: number,
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 300 },
    children: [
      new ImageRun({
        data: png,
        transformation: { width: widthPx, height: heightPx },
        type: "png",
      }),
    ],
  });
}

/**
 * Generate a DOCX buffer containing the org chart. The document always
 * includes a header (company + CEO) and a hierarchy table; when `png` is
 * supplied the rendered chart image is embedded above the table so the
 * reader sees both the visual and the text representation.
 *
 * The text table serves as a fallback when the image cannot be rendered
 * (e.g. the client is unable to produce a PNG) and also helps screen
 * readers / search indexers since the image itself is opaque.
 */
export async function generateOrgChartDocx(
  chart: OrgChartStructure,
  options: OrgChartDocxOptions = {},
): Promise<{ docxBuffer: Buffer; fileName: string }> {
  if (!chart.companyName?.trim()) {
    throw new Error("OrgChartStructure.companyName is required");
  }
  if (!chart.ceo?.name?.trim()) {
    throw new Error("OrgChartStructure.ceo.name is required");
  }

  const title = options.title ?? `${chart.companyName} 조직도`;
  const children: Array<Paragraph | Table> = [...buildHeaderParagraphs(chart, title)];

  if (options.png) {
    children.push(
      buildImageParagraph(
        options.png,
        options.pngWidthPx ?? 500,
        options.pngHeightPx ?? 400,
      ),
    );
  }

  children.push(buildHierarchyTable(chart));

  const doc = new Document({
    styles: buildDocxStyles(),
    sections: [
      {
        properties: buildSectionProperties(),
        children,
      },
    ],
  });

  const docxBuffer = (await Packer.toBuffer(doc)) as Buffer;
  const safe = chart.companyName.replace(/[\\/:*?"<>|]/g, "_").trim();
  return {
    docxBuffer,
    fileName: `${safe || "org-chart"}-조직도.docx`,
  };
}

/**
 * Research Institute Notification (기업부설연구소 설립 신고서) DOCX generator.
 *
 * Renders a KOITA-compatible report matching the structure of
 * `docs/연구소 개요.txt`:
 *   - Cover page (회사 + 연구소 기본 정보)
 *   - 연구소 개요 (overview prose)
 *   - 주요 업무 및 R&D 분야 (grouped bullet lists)
 *   - 핵심 보유 기술 (numbered list with descriptions)
 *   - 주요 연구개발 과제 현황 (projects table w/ budget totals)
 *   - (optional) 연구원 현황 (researcher roster table)
 *
 * Mirrors the WI-301 venture-tech-assessment shape: all non-required fields
 * are optional so the caller can render a report even before every slice of
 * the masterProfile has been filled in.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  VerticalAlign,
  WidthType,
} from "docx";
import { buildDocxStyles, buildSectionProperties } from "../utils/docx-styles.js";
import { krw, para, run, todayKorean } from "../utils/docx-helpers.js";

// ── Input shape ───────────────────────────────────────────────────────────────

export interface ResearchInstituteCompanyInfo {
  companyName: string;
  ceoName: string;
  /** ISO date (YYYY-MM-DD) */
  foundedDate?: string;
  businessNumber?: string;
  address?: string;
  /** 연구소 명칭 — 기본값: "{companyName} 기업부설연구소" */
  instituteName?: string;
  /** 연구소 소재지 — 본사 주소와 다를 때만 기재 */
  instituteAddress?: string;
  /** 연구소 전용 면적 (㎡) */
  instituteAreaSqm?: number;
  /** 연구소 설립일 (ISO) — foundedDate와 구분 */
  instituteFoundedDate?: string;
}

export interface ResearchInstituteRDField {
  /** 업무 카테고리 명칭 (예: "자동화 장비 신규 개발 및 고도화") */
  title: string;
  /** 카테고리 하위 bullet 항목 */
  items: string[];
}

export interface ResearchInstituteCoreTechnology {
  /** 기술명 (예: "자동화 시스템 통합 설계 기술") */
  name: string;
  /** 기술 설명 bullet 항목 */
  descriptions: string[];
}

export interface ResearchInstituteProject {
  /** 과제명 */
  name: string;
  /** 연구 내용 */
  content: string;
  /** 개발비 (원) */
  budget?: number;
}

export interface ResearchInstituteResearcher {
  /** 이름 */
  name: string;
  /** 직급 (예: 연구소장 / 책임연구원 / 선임연구원 / 연구원) */
  position?: string;
  /** 최종 학위 (예: 박사 / 석사 / 학사) */
  degree?: string;
  /** 전공 분야 */
  specialty?: string;
}

export interface ResearchInstituteNotificationInput {
  companyInfo: ResearchInstituteCompanyInfo;
  /** 연구소 개요 (자유 서술, 2-5 문단) */
  overview?: string;
  rdFields?: ResearchInstituteRDField[];
  coreTechnologies?: ResearchInstituteCoreTechnology[];
  projects?: ResearchInstituteProject[];
  researchers?: ResearchInstituteResearcher[];
  /** Cover 제목 — 기본값 "기업부설연구소 설립 신고서" */
  title?: string;
}

// ── Shared table styles ───────────────────────────────────────────────────────

const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
const HEADER_FILL = { type: "solid" as const, fill: "2F5496", color: "2F5496" };
const ZEBRA_FILL = { type: "solid" as const, fill: "F2F6FC", color: "F2F6FC" };

const PLACEHOLDER = "(미작성)";

function num(n?: number): string {
  if (n == null || Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("ko-KR").format(Math.round(n));
}

function money(n?: number): string {
  if (n == null || Number.isNaN(n)) return "-";
  return krw(Math.round(n));
}

function tableHeaderCell(text: string, widthPct?: number): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [run(text, { bold: true, size: 20, color: "FFFFFF" })],
        alignment: AlignmentType.CENTER,
      }),
    ],
    shading: HEADER_FILL,
    verticalAlign: VerticalAlign.CENTER,
    borders: {
      top: THIN_BORDER,
      bottom: THIN_BORDER,
      left: THIN_BORDER,
      right: THIN_BORDER,
    },
    width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
  });
}

function tableBodyCell(
  text: string,
  opts: {
    bold?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    zebra?: boolean;
    widthPct?: number;
  } = {},
): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [run(text, { bold: opts.bold ?? false, size: 20 })],
        alignment: opts.align ?? AlignmentType.LEFT,
        spacing: { before: 60, after: 60 },
      }),
    ],
    shading: opts.zebra ? ZEBRA_FILL : undefined,
    verticalAlign: VerticalAlign.CENTER,
    borders: {
      top: THIN_BORDER,
      bottom: THIN_BORDER,
      left: THIN_BORDER,
      right: THIN_BORDER,
    },
    width: opts.widthPct ? { size: opts.widthPct, type: WidthType.PERCENTAGE } : undefined,
  });
}

// ── Cover ─────────────────────────────────────────────────────────────────────

function buildCover(input: ResearchInstituteNotificationInput): Array<Paragraph | Table> {
  const { companyInfo } = input;
  const title = input.title ?? "기업부설연구소 설립 신고서";
  const instituteName =
    companyInfo.instituteName ?? `${companyInfo.companyName} 기업부설연구소`;

  const area =
    companyInfo.instituteAreaSqm != null
      ? `${num(companyInfo.instituteAreaSqm)} ㎡`
      : "-";

  const rows: Array<[string, string]> = [
    ["회사명", companyInfo.companyName],
    ["대표자", companyInfo.ceoName],
    ["사업자등록번호", companyInfo.businessNumber ?? "-"],
    ["회사 설립일", companyInfo.foundedDate ?? "-"],
    ["회사 소재지", companyInfo.address ?? "-"],
    ["연구소 명칭", instituteName],
    ["연구소 소재지", companyInfo.instituteAddress ?? companyInfo.address ?? "-"],
    ["연구소 설립일", companyInfo.instituteFoundedDate ?? "-"],
    ["연구소 전용 면적", area],
  ];

  const infoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [tableHeaderCell("항목", 30), tableHeaderCell("내용", 70)],
      }),
      ...rows.map(
        ([label, value], idx) =>
          new TableRow({
            children: [
              tableBodyCell(label, { bold: true, zebra: idx % 2 === 0, widthPct: 30 }),
              tableBodyCell(value, { zebra: idx % 2 === 0, widthPct: 70 }),
            ],
          }),
      ),
    ],
  });

  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [run(title, { bold: true, size: 44 })],
      spacing: { before: 0, after: 200 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [run("한국산업기술진흥협회(KOITA) 제출용", { size: 24, bold: true })],
      spacing: { after: 80 },
    }),
    para(`작성일: ${todayKorean()}`, {
      align: AlignmentType.CENTER,
      size: 20,
      spacingAfter: 320,
    }),
    infoTable,
    para("", { spacingAfter: 200 }),
  ];
}

// ── Overview section ─────────────────────────────────────────────────────────

function renderOverview(text: string | undefined): Paragraph[] {
  const trimmed = text?.trim();
  if (!trimmed) {
    return [
      new Paragraph({
        children: [run(PLACEHOLDER, { size: 22, color: "9CA3AF", italics: true })],
        spacing: { before: 80, after: 200, line: 360 },
      }),
    ];
  }
  const parts = trimmed.split(/\r?\n\s*\r?\n/);
  return parts.map(
    (part) =>
      new Paragraph({
        children: [run(part.trim(), { size: 22 })],
        spacing: { before: 60, after: 120, line: 360 },
        alignment: AlignmentType.JUSTIFIED,
      }),
  );
}

function buildOverviewSection(
  input: ResearchInstituteNotificationInput,
): Array<Paragraph | Table> {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [run("1. 연구소 개요", { bold: true, size: 28 })],
      spacing: { before: 320, after: 160 },
    }),
    ...renderOverview(input.overview),
  ];
}

// ── R&D fields section ───────────────────────────────────────────────────────

function buildRDFieldsSection(
  input: ResearchInstituteNotificationInput,
): Array<Paragraph | Table> {
  const blocks: Array<Paragraph | Table> = [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [run("2. 주요 업무 및 R&D 분야", { bold: true, size: 28 })],
      spacing: { before: 320, after: 160 },
    }),
  ];

  const fields = input.rdFields ?? [];
  if (fields.length === 0) {
    blocks.push(
      new Paragraph({
        children: [run(PLACEHOLDER, { size: 22, color: "9CA3AF", italics: true })],
        spacing: { before: 80, after: 200, line: 360 },
      }),
    );
    return blocks;
  }

  fields.forEach((field) => {
    blocks.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [run(`• ${field.title}`, { bold: true, size: 24 })],
        spacing: { before: 160, after: 80 },
      }),
    );
    if (field.items.length === 0) {
      blocks.push(
        new Paragraph({
          children: [run(PLACEHOLDER, { size: 22, color: "9CA3AF", italics: true })],
          spacing: { before: 40, after: 120, line: 320 },
        }),
      );
    } else {
      field.items.forEach((item) => {
        blocks.push(
          new Paragraph({
            children: [run(`  - ${item}`, { size: 22 })],
            spacing: { before: 40, after: 40, line: 320 },
            indent: { left: 360 },
          }),
        );
      });
    }
  });

  return blocks;
}

// ── Core technologies section ────────────────────────────────────────────────

function buildCoreTechnologiesSection(
  input: ResearchInstituteNotificationInput,
): Array<Paragraph | Table> {
  const blocks: Array<Paragraph | Table> = [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [run("3. 핵심 보유 기술", { bold: true, size: 28 })],
      spacing: { before: 320, after: 160 },
    }),
  ];

  const techs = input.coreTechnologies ?? [];
  if (techs.length === 0) {
    blocks.push(
      new Paragraph({
        children: [run(PLACEHOLDER, { size: 22, color: "9CA3AF", italics: true })],
        spacing: { before: 80, after: 200, line: 360 },
      }),
    );
    return blocks;
  }

  techs.forEach((tech, idx) => {
    blocks.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [run(`${idx + 1}. ${tech.name}`, { bold: true, size: 24 })],
        spacing: { before: 160, after: 80 },
      }),
    );
    if (tech.descriptions.length === 0) {
      blocks.push(
        new Paragraph({
          children: [run(PLACEHOLDER, { size: 22, color: "9CA3AF", italics: true })],
          spacing: { before: 40, after: 120, line: 320 },
        }),
      );
    } else {
      tech.descriptions.forEach((desc) => {
        blocks.push(
          new Paragraph({
            children: [run(`  - ${desc}`, { size: 22 })],
            spacing: { before: 40, after: 40, line: 320 },
            indent: { left: 360 },
          }),
        );
      });
    }
  });

  return blocks;
}

// ── Projects table ───────────────────────────────────────────────────────────

function buildProjectsTable(projects: ResearchInstituteProject[]): Table {
  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        tableHeaderCell("과제명", 30),
        tableHeaderCell("연구 내용", 50),
        tableHeaderCell("개발비 (원)", 20),
      ],
    }),
    ...projects.map(
      (p, idx) =>
        new TableRow({
          children: [
            tableBodyCell(p.name, { bold: true, zebra: idx % 2 === 0, widthPct: 30 }),
            tableBodyCell(p.content, { zebra: idx % 2 === 0, widthPct: 50 }),
            tableBodyCell(money(p.budget), {
              align: AlignmentType.RIGHT,
              zebra: idx % 2 === 0,
              widthPct: 20,
            }),
          ],
        }),
    ),
  ];

  // Only append a total row when at least one budget is known; otherwise the
  // "-" row is noisy without adding information.
  const knownBudgets = projects
    .map((p) => p.budget)
    .filter((b): b is number => typeof b === "number" && !Number.isNaN(b));
  if (knownBudgets.length > 0) {
    const total = knownBudgets.reduce((acc, b) => acc + b, 0);
    rows.push(
      new TableRow({
        children: [
          tableBodyCell("총계", { bold: true, widthPct: 30 }),
          tableBodyCell("", { widthPct: 50 }),
          tableBodyCell(money(total), {
            bold: true,
            align: AlignmentType.RIGHT,
            widthPct: 20,
          }),
        ],
      }),
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}

function buildProjectsSection(
  input: ResearchInstituteNotificationInput,
): Array<Paragraph | Table> {
  const blocks: Array<Paragraph | Table> = [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [run("4. 주요 연구개발 과제 현황", { bold: true, size: 28 })],
      spacing: { before: 320, after: 160 },
    }),
  ];

  const projects = input.projects ?? [];
  if (projects.length === 0) {
    blocks.push(
      new Paragraph({
        children: [run(PLACEHOLDER, { size: 22, color: "9CA3AF", italics: true })],
        spacing: { before: 80, after: 200, line: 360 },
      }),
    );
    return blocks;
  }

  blocks.push(buildProjectsTable(projects));
  blocks.push(para("", { spacingAfter: 200 }));
  return blocks;
}

// ── Researchers appendix (optional) ──────────────────────────────────────────

function buildResearchersTable(researchers: ResearchInstituteResearcher[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          tableHeaderCell("성명", 20),
          tableHeaderCell("직급", 20),
          tableHeaderCell("최종 학위", 20),
          tableHeaderCell("전공", 40),
        ],
      }),
      ...researchers.map(
        (r, idx) =>
          new TableRow({
            children: [
              tableBodyCell(r.name, { bold: true, zebra: idx % 2 === 0, widthPct: 20 }),
              tableBodyCell(r.position ?? "-", {
                align: AlignmentType.CENTER,
                zebra: idx % 2 === 0,
                widthPct: 20,
              }),
              tableBodyCell(r.degree ?? "-", {
                align: AlignmentType.CENTER,
                zebra: idx % 2 === 0,
                widthPct: 20,
              }),
              tableBodyCell(r.specialty ?? "-", {
                zebra: idx % 2 === 0,
                widthPct: 40,
              }),
            ],
          }),
      ),
    ],
  });
}

function buildResearchersAppendix(
  input: ResearchInstituteNotificationInput,
): Array<Paragraph | Table> {
  if (!input.researchers || input.researchers.length === 0) return [];

  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [run("부록. 연구원 현황", { bold: true, size: 32 })],
      spacing: { before: 480, after: 200 },
    }),
    new Paragraph({
      children: [
        run(`총 ${num(input.researchers.length)}명 등재`, {
          size: 22,
          color: "4B5563",
          italics: true,
        }),
      ],
      spacing: { before: 0, after: 160 },
    }),
    buildResearchersTable(input.researchers),
    para("", { spacingAfter: 200 }),
  ];
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function generateResearchInstituteNotificationDocx(
  input: ResearchInstituteNotificationInput,
): Promise<{ docxBuffer: Buffer; fileName: string }> {
  if (!input.companyInfo?.companyName?.trim()) {
    throw new Error(
      "ResearchInstituteNotificationInput.companyInfo.companyName is required",
    );
  }
  if (!input.companyInfo?.ceoName?.trim()) {
    throw new Error(
      "ResearchInstituteNotificationInput.companyInfo.ceoName is required",
    );
  }

  const children: Array<Paragraph | Table> = [
    ...buildCover(input),
    ...buildOverviewSection(input),
    ...buildRDFieldsSection(input),
    ...buildCoreTechnologiesSection(input),
    ...buildProjectsSection(input),
    ...buildResearchersAppendix(input),
  ];

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
  // Match venture-tech-assessment's filename sanitisation exactly: strip
  // filesystem-reserved chars, fall back to a generic name when the result is
  // empty or consists entirely of separators.
  const sanitized = input.companyInfo.companyName
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();
  const safe = /[^_\s]/.test(sanitized) ? sanitized : "research-institute";
  return {
    docxBuffer,
    fileName: `${safe}-연구소설립신고서.docx`,
  };
}

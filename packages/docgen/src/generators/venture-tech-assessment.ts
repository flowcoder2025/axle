/**
 * Venture Tech Assessment (벤처기업 신규 확인용 사업계획서 / 기술성평가서)
 * DOCX generator.
 *
 * Replaces the originally-planned HWPX template approach. The 2024 중기부
 * official form (docs/벤처(신규) 양식.txt) is rendered as a DOCX with:
 *   - Cover page (회사 정보)
 *   - 9 sections from VENTURE_BUSINESS_PLAN_SECTIONS (SSOT in types.ts)
 *   - Inline check-box lists for the 3 multi-select prompts
 *     (1-1 문제 중요성 / 2-1 제품 차별성 / 8-1 자금조달 수단)
 *   - Optional appendix tables (3-year finance, achievements, IP)
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
import { VENTURE_BUSINESS_PLAN_SECTIONS } from "../types.js";

// ── Fixed option lists from the official 2024 form ───────────────────────────

/** 1-1. 문제의 중요성 — 6개 옵션 (양식 그대로) */
export const PROBLEM_IMPORTANCE_OPTIONS = [
  "많은 사람들이 겪고 있는 문제임",
  "앞으로 더 많은 사람들이 경험할 문제임",
  "시급히 해결되어야 하는 문제임",
  "현재 많은 비용이 투입되는 문제임",
  "꼭 해결해야 하는 문제임",
  "자주 발생하는 문제임",
] as const;

/** 2-1. 제품/서비스 차별성 — 6개 옵션 (양식 그대로) */
export const PRODUCT_DIFFERENTIATION_OPTIONS = [
  "기존에 없는 제품",
  "기존제품대비 고성능",
  "기존 제품 대비 저렴함",
  "기존 제품 대비 편리함",
  "기존제품 대비 디자인 우수",
  "기타",
] as const;

/**
 * 8-1. 자금 조달 수단 — 양식의 묶음 옵션을 분리해 다중 선택을 명확하게 표현.
 * (영업이익 / 자본금 / 투자(엔젤·VC·금융권·기타) / 정부지원(창업·R&D) /
 *  대출(정책보증·시중은행) / 기타)
 */
export const FUNDING_SOURCE_OPTIONS = [
  "영업이익",
  "자본금",
  "투자(엔젤)",
  "투자(VC)",
  "투자(금융권)",
  "투자(기타)",
  "정부지원(창업지원)",
  "정부지원(R&D 지원)",
  "대출(정책보증)",
  "대출(시중은행)",
  "기타",
] as const;

// ── Input shape ───────────────────────────────────────────────────────────────

export interface VentureTechAssessmentCompanyInfo {
  companyName: string;
  ceoName: string;
  /** ISO date (YYYY-MM-DD) — falls back to "" if unset. */
  foundedDate?: string;
  businessNumber?: string;
  address?: string;
  /** Capital amount in KRW (whole won). */
  capitalAmount?: number;
}

export interface VentureTechAssessmentFinanceRow {
  year: number;
  revenue?: number;
  operatingProfit?: number;
  netProfit?: number;
}

export interface VentureTechAssessmentAchievements {
  /** 국내 매출 (원) */
  domesticSales?: number;
  /** 수출액 (원) */
  exports?: number;
  /** 정규직 직원 수 */
  employeeCount?: number;
}

export interface VentureTechAssessmentIp {
  patents?: number;
  trademarks?: number;
  designs?: number;
  softwareCopyrights?: number;
}

export interface VentureTechAssessmentChecks {
  /** 1-1 문제의 중요성 — PROBLEM_IMPORTANCE_OPTIONS 라벨 부분집합 */
  problemImportance?: string[];
  /** 2-1 제품/서비스 차별성 — PRODUCT_DIFFERENTIATION_OPTIONS 라벨 부분집합 */
  productDifferentiation?: string[];
  /** 8-1 자금 조달 수단 — FUNDING_SOURCE_OPTIONS 라벨 부분집합 */
  fundingSources?: string[];
}

export interface VentureTechAssessmentInput {
  companyInfo: VentureTechAssessmentCompanyInfo;
  /** key = SectionConfig.id, value = 본문 (Korean text). */
  sections: Record<string, string>;
  checks?: VentureTechAssessmentChecks;
  /** 최근 3년 재무 (정렬 무관 — 생성기가 연도 오름차순으로 정렬) */
  finance?: VentureTechAssessmentFinanceRow[];
  achievements?: VentureTechAssessmentAchievements;
  intellectualProperty?: VentureTechAssessmentIp;
  /** Cover 헤더 — 기본값 "기술성평가서". */
  title?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function buildCover(input: VentureTechAssessmentInput): Array<Paragraph | Table> {
  const { companyInfo } = input;
  const title = input.title ?? "기술성평가서";

  const rows: Array<[string, string]> = [
    ["회사명", companyInfo.companyName],
    ["대표자", companyInfo.ceoName],
    ["사업자등록번호", companyInfo.businessNumber ?? "-"],
    ["설립일", companyInfo.foundedDate ?? "-"],
    ["소재지", companyInfo.address ?? "-"],
    ["자본금", money(companyInfo.capitalAmount)],
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
      children: [run("벤처기업(신규) 확인용 사업계획서", { size: 24, bold: true })],
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

// ── Check-box list rendering ─────────────────────────────────────────────────

// Unicode ballot box characters — the 2024 중기부 official form uses these
// glyphs. Korean fonts (맑은 고딕 / NanumGothic) render them correctly.
const CHECKED_MARK = "☑"; // ☑
const UNCHECKED_MARK = "☐"; // ☐

function renderChecklist(
  options: readonly string[],
  selected: string[] | undefined,
): Paragraph[] {
  const set = new Set(selected ?? []);
  return options.map((option) => {
    const mark = set.has(option) ? CHECKED_MARK : UNCHECKED_MARK;
    return new Paragraph({
      children: [run(`${mark} ${option}`, { size: 22 })],
      spacing: { before: 40, after: 40, line: 320 },
    });
  });
}

// Map section id → embedded checklist + sub-heading
const SECTION_CHECKLIST_MAP: Record<
  string,
  { heading: string; options: readonly string[]; pick: (c?: VentureTechAssessmentChecks) => string[] | undefined }
> = {
  background: {
    heading: "1-1. 문제의 중요성 (해당 항목에 모두 표시)",
    options: PROBLEM_IMPORTANCE_OPTIONS,
    pick: (c) => c?.problemImportance,
  },
  solution: {
    heading: "2-1. 제품/서비스의 차별성 (해당 항목에 모두 표시)",
    options: PRODUCT_DIFFERENTIATION_OPTIONS,
    pick: (c) => c?.productDifferentiation,
  },
  finance: {
    heading: "8-1. 자금 조달 수단 (해당 항목에 모두 표시)",
    options: FUNDING_SOURCE_OPTIONS,
    pick: (c) => c?.fundingSources,
  },
};

// ── Main sections ────────────────────────────────────────────────────────────

function renderSectionBody(text: string | undefined): Paragraph[] {
  const trimmed = text?.trim();
  if (!trimmed) {
    return [
      new Paragraph({
        children: [run(PLACEHOLDER, { size: 22, color: "9CA3AF", italics: true })],
        spacing: { before: 80, after: 200, line: 360 },
      }),
    ];
  }
  // Split on blank lines so each paragraph stands on its own
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

function buildSections(input: VentureTechAssessmentInput): Array<Paragraph | Table> {
  const blocks: Array<Paragraph | Table> = [];

  VENTURE_BUSINESS_PLAN_SECTIONS.forEach((cfg, idx) => {
    blocks.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [run(`${idx + 1}. ${cfg.title}`, { bold: true, size: 28 })],
        spacing: { before: 320, after: 160 },
      }),
    );
    blocks.push(
      new Paragraph({
        children: [run(cfg.instruction, { size: 20, color: "4B5563", italics: true })],
        spacing: { before: 0, after: 160 },
      }),
    );

    const checklist = SECTION_CHECKLIST_MAP[cfg.id];
    if (checklist) {
      blocks.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [run(checklist.heading, { bold: true, size: 24 })],
          spacing: { before: 160, after: 120 },
        }),
      );
      for (const p of renderChecklist(checklist.options, checklist.pick(input.checks))) {
        blocks.push(p);
      }
    }

    blocks.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [run("본문", { bold: true, size: 24 })],
        spacing: { before: 160, after: 80 },
      }),
    );
    for (const p of renderSectionBody(input.sections[cfg.id])) {
      blocks.push(p);
    }
  });

  return blocks;
}

// ── Appendix tables ──────────────────────────────────────────────────────────

function buildFinanceTable(rows: VentureTechAssessmentFinanceRow[]): Table {
  const sorted = [...rows].sort((a, b) => a.year - b.year);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          tableHeaderCell("연도", 16),
          tableHeaderCell("매출액", 28),
          tableHeaderCell("영업이익", 28),
          tableHeaderCell("당기순이익", 28),
        ],
      }),
      ...sorted.map(
        (row, idx) =>
          new TableRow({
            children: [
              tableBodyCell(`${row.year}`, {
                align: AlignmentType.CENTER,
                zebra: idx % 2 === 0,
                widthPct: 16,
              }),
              tableBodyCell(money(row.revenue), {
                align: AlignmentType.RIGHT,
                zebra: idx % 2 === 0,
                widthPct: 28,
              }),
              tableBodyCell(money(row.operatingProfit), {
                align: AlignmentType.RIGHT,
                zebra: idx % 2 === 0,
                widthPct: 28,
              }),
              tableBodyCell(money(row.netProfit), {
                align: AlignmentType.RIGHT,
                zebra: idx % 2 === 0,
                widthPct: 28,
              }),
            ],
          }),
      ),
    ],
  });
}

function buildAchievementsTable(a: VentureTechAssessmentAchievements): Table {
  const rows: Array<[string, string]> = [
    ["국내 매출 (최근 회계연도)", money(a.domesticSales)],
    ["수출액 (최근 회계연도)", money(a.exports)],
    ["정규직 직원 수", a.employeeCount != null ? `${num(a.employeeCount)}명` : "-"],
  ];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [tableHeaderCell("구분", 50), tableHeaderCell("값", 50)],
      }),
      ...rows.map(
        ([label, value], idx) =>
          new TableRow({
            children: [
              tableBodyCell(label, { bold: true, zebra: idx % 2 === 0, widthPct: 50 }),
              tableBodyCell(value, {
                align: AlignmentType.RIGHT,
                zebra: idx % 2 === 0,
                widthPct: 50,
              }),
            ],
          }),
      ),
    ],
  });
}

function buildIpTable(ip: VentureTechAssessmentIp): Table {
  const rows: Array<[string, string]> = [
    ["특허", ip.patents != null ? `${num(ip.patents)}건` : "-"],
    ["상표", ip.trademarks != null ? `${num(ip.trademarks)}건` : "-"],
    ["디자인", ip.designs != null ? `${num(ip.designs)}건` : "-"],
    ["SW 저작권", ip.softwareCopyrights != null ? `${num(ip.softwareCopyrights)}건` : "-"],
  ];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [tableHeaderCell("권리 유형", 50), tableHeaderCell("보유 건수", 50)],
      }),
      ...rows.map(
        ([label, value], idx) =>
          new TableRow({
            children: [
              tableBodyCell(label, { bold: true, zebra: idx % 2 === 0, widthPct: 50 }),
              tableBodyCell(value, {
                align: AlignmentType.RIGHT,
                zebra: idx % 2 === 0,
                widthPct: 50,
              }),
            ],
          }),
      ),
    ],
  });
}

function buildAppendix(input: VentureTechAssessmentInput): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = [];
  const hasAny = input.finance?.length || input.achievements || input.intellectualProperty;
  if (!hasAny) return out;

  out.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [run("부록. 기업 현황 데이터", { bold: true, size: 32 })],
      spacing: { before: 480, after: 200 },
    }),
  );

  if (input.finance && input.finance.length > 0) {
    out.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [run("최근 재무 현황 (연도별)", { bold: true, size: 26 })],
        spacing: { before: 200, after: 120 },
      }),
    );
    out.push(buildFinanceTable(input.finance));
    out.push(para("", { spacingAfter: 200 }));
  }

  if (input.achievements) {
    out.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [run("매출 및 인력 실적", { bold: true, size: 26 })],
        spacing: { before: 200, after: 120 },
      }),
    );
    out.push(buildAchievementsTable(input.achievements));
    out.push(para("", { spacingAfter: 200 }));
  }

  if (input.intellectualProperty) {
    out.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [run("지식재산권 보유 현황", { bold: true, size: 26 })],
        spacing: { before: 200, after: 120 },
      }),
    );
    out.push(buildIpTable(input.intellectualProperty));
    out.push(para("", { spacingAfter: 200 }));
  }

  return out;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function generateVentureTechAssessmentDocx(
  input: VentureTechAssessmentInput,
): Promise<{ docxBuffer: Buffer; fileName: string }> {
  if (!input.companyInfo?.companyName?.trim()) {
    throw new Error("VentureTechAssessmentInput.companyInfo.companyName is required");
  }
  if (!input.companyInfo?.ceoName?.trim()) {
    throw new Error("VentureTechAssessmentInput.companyInfo.ceoName is required");
  }

  const children: Array<Paragraph | Table> = [
    ...buildCover(input),
    ...buildSections(input),
    ...buildAppendix(input),
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
  // Strip filesystem-reserved chars, then fall back to a generic name when
  // the result is empty *or* contains nothing but separators (e.g. the input
  // was made entirely of reserved chars and survived as `____`).
  const sanitized = input.companyInfo.companyName
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();
  const safe = /[^_\s]/.test(sanitized) ? sanitized : "venture";
  return {
    docxBuffer,
    fileName: `${safe}-기술성평가서.docx`,
  };
}

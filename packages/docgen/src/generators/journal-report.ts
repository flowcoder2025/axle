import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import {
  buildDocxStyles,
  buildSectionProperties,
  FONT_KOREAN,
} from "../utils/docx-styles.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface JournalEntry {
  date: string;
  title: string;
  objectives?: string;
  results?: string;
  nextSteps?: string;
  hours?: number;
}

export interface JournalReportInput {
  clientName: string;
  researcherName: string;
  year: number;
  month: number;
  journals: JournalEntry[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function zeroPad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatKoreanDate(dateStr: string): string {
  // Accept YYYY-MM-DD or YYYY.MM.DD or already-Korean formats
  const m = dateStr.match(/(\d{4})[-.](\d{1,2})[-.](\d{1,2})/);
  if (!m) return dateStr;
  return `${m[1]}년 ${zeroPad(Number(m[2]))}월 ${zeroPad(Number(m[3]))}일`;
}

// ── Style constants ────────────────────────────────────────────────────────────

const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" };
const TABLE_BORDER = {
  top: THIN_BORDER,
  bottom: THIN_BORDER,
  left: THIN_BORDER,
  right: THIN_BORDER,
  insideHorizontal: THIN_BORDER,
  insideVertical: THIN_BORDER,
};

const HEADER_FILL = { type: "solid" as const, fill: "1F3864", color: "1F3864" };
const LABEL_FILL = { type: "solid" as const, fill: "EBF3FB", color: "EBF3FB" };
const SECTION_FILL = { type: "solid" as const, fill: "F5F5F5", color: "F5F5F5" };

// ── Run & paragraph builders ──────────────────────────────────────────────────

function run(
  text: string,
  opts: { bold?: boolean; size?: number; color?: string } = {}
): TextRun {
  return new TextRun({
    text,
    font: { name: FONT_KOREAN, eastAsia: FONT_KOREAN },
    size: opts.size ?? 22,
    bold: opts.bold ?? false,
    color: opts.color,
  });
}

function para(
  text: string,
  opts: {
    bold?: boolean;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    color?: string;
    spacingBefore?: number;
    spacingAfter?: number;
  } = {}
): Paragraph {
  return new Paragraph({
    children: [
      run(text, { bold: opts.bold, size: opts.size, color: opts.color }),
    ],
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: {
      before: opts.spacingBefore ?? 0,
      after: opts.spacingAfter ?? 0,
      line: 360,
    },
  });
}

function cell(
  text: string,
  opts: {
    bold?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    shade?: typeof HEADER_FILL | typeof LABEL_FILL | typeof SECTION_FILL;
    textColor?: string;
    widthPct?: number;
    columnSpan?: number;
    size?: number;
  } = {}
): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          run(text, {
            bold: opts.bold ?? false,
            size: opts.size ?? 20,
            color: opts.textColor,
          }),
        ],
        alignment: opts.align ?? AlignmentType.CENTER,
        spacing: { before: 80, after: 80 },
      }),
    ],
    borders: TABLE_BORDER,
    shading: opts.shade,
    verticalAlign: VerticalAlign.CENTER,
    ...(opts.widthPct !== undefined
      ? { width: { size: opts.widthPct, type: WidthType.PERCENTAGE } }
      : {}),
    ...(opts.columnSpan !== undefined ? { columnSpan: opts.columnSpan } : {}),
  });
}

// ── Sub-builders ──────────────────────────────────────────────────────────────

function buildHeaderInfo(input: JournalReportInput): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDER,
    rows: [
      new TableRow({
        children: [
          cell("보고 기간", { bold: true, shade: LABEL_FILL, widthPct: 20 }),
          cell(
            `${input.year}년 ${zeroPad(input.month)}월`,
            { align: AlignmentType.LEFT, widthPct: 30 }
          ),
          cell("발주 기관", { bold: true, shade: LABEL_FILL, widthPct: 20 }),
          cell(input.clientName, { align: AlignmentType.LEFT, widthPct: 30 }),
        ],
      }),
      new TableRow({
        children: [
          cell("연구자", { bold: true, shade: LABEL_FILL, widthPct: 20 }),
          cell(input.researcherName, { align: AlignmentType.LEFT, widthPct: 80, columnSpan: 3 }),
        ],
      }),
    ],
  });
}

function buildSummaryTable(journals: JournalEntry[]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell("No.", { bold: true, shade: HEADER_FILL, textColor: "FFFFFF", widthPct: 6 }),
      cell("일자", { bold: true, shade: HEADER_FILL, textColor: "FFFFFF", widthPct: 22 }),
      cell("연구 제목", { bold: true, shade: HEADER_FILL, textColor: "FFFFFF", widthPct: 57 }),
      cell("시간(h)", { bold: true, shade: HEADER_FILL, textColor: "FFFFFF", widthPct: 15 }),
    ],
  });

  const dataRows = journals.map(
    (j, idx) =>
      new TableRow({
        children: [
          cell(String(idx + 1), { widthPct: 6 }),
          cell(formatKoreanDate(j.date), { align: AlignmentType.CENTER, widthPct: 22 }),
          cell(j.title, { align: AlignmentType.LEFT, widthPct: 57 }),
          cell(j.hours !== undefined ? String(j.hours) : "-", {
            align: AlignmentType.CENTER,
            widthPct: 15,
          }),
        ],
      })
  );

  const totalHours = journals.reduce((sum, j) => sum + (j.hours ?? 0), 0);
  const totalRow = new TableRow({
    children: [
      cell("합계", {
        bold: true,
        shade: LABEL_FILL,
        align: AlignmentType.RIGHT,
        columnSpan: 3,
        widthPct: 85,
      }),
      cell(`${totalHours}h`, {
        bold: true,
        shade: LABEL_FILL,
        align: AlignmentType.CENTER,
        widthPct: 15,
      }),
    ],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDER,
    rows: [headerRow, ...dataRows, totalRow],
  });
}

function buildDetailSection(entry: JournalEntry, index: number): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Section header
  paragraphs.push(
    new Paragraph({
      children: [
        run(
          `${index + 1}. [${formatKoreanDate(entry.date)}] ${entry.title}`,
          { bold: true, size: 22, color: "1F3864" }
        ),
      ],
      spacing: { before: 360, after: 120, line: 360 },
    })
  );

  // Objectives
  if (entry.objectives) {
    paragraphs.push(para("▶ 연구 목표", { bold: true, size: 20, spacingAfter: 60 }));
    paragraphs.push(
      new Paragraph({
        children: [run(entry.objectives, { size: 20 })],
        indent: { left: 280 },
        spacing: { before: 0, after: 120, line: 360 },
      })
    );
  }

  // Results
  if (entry.results) {
    paragraphs.push(para("▶ 연구 결과", { bold: true, size: 20, spacingAfter: 60 }));
    paragraphs.push(
      new Paragraph({
        children: [run(entry.results, { size: 20 })],
        indent: { left: 280 },
        spacing: { before: 0, after: 120, line: 360 },
      })
    );
  }

  // Next steps
  if (entry.nextSteps) {
    paragraphs.push(para("▶ 차기 계획", { bold: true, size: 20, spacingAfter: 60 }));
    paragraphs.push(
      new Paragraph({
        children: [run(entry.nextSteps, { size: 20 })],
        indent: { left: 280 },
        spacing: { before: 0, after: 120, line: 360 },
      })
    );
  }

  // Hours
  if (entry.hours !== undefined) {
    paragraphs.push(
      new Paragraph({
        children: [
          run("연구 시간: ", { bold: true, size: 20 }),
          run(`${entry.hours}시간`, { size: 20 }),
        ],
        spacing: { before: 60, after: 80, line: 360 },
      })
    );
  }

  return paragraphs;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generate a monthly research journal report DOCX.
 *
 * The document contains:
 * - Title: 연구일지 월간 보고서
 * - Reporting period, client, and researcher info table
 * - Summary table (date / title / hours per entry, total hours)
 * - Detailed sections for each journal entry
 *
 * @param input - Report data
 * @returns DOCX document as a Buffer
 */
export async function generateJournalReportDocx(
  input: JournalReportInput
): Promise<Buffer> {
  const { year, month, journals } = input;
  const totalHours = journals.reduce((sum, j) => sum + (j.hours ?? 0), 0);

  const children = [
    // ── Title ────────────────────────────────────────────────────────────────
    para("연구일지 월간 보고서", {
      bold: true,
      size: 52,
      align: AlignmentType.CENTER,
      spacingAfter: 160,
    }),
    para(`${year}년 ${zeroPad(month)}월`, {
      size: 30,
      align: AlignmentType.CENTER,
      color: "555555",
      spacingAfter: 480,
    }),

    // ── Header info table ─────────────────────────────────────────────────────
    buildHeaderInfo(input),

    // ── Section divider ───────────────────────────────────────────────────────
    para("", { spacingAfter: 320 }),

    // ── Summary heading ───────────────────────────────────────────────────────
    para("■ 연구 일정 요약", {
      bold: true,
      size: 26,
      color: "1F3864",
      spacingAfter: 120,
    }),

    // ── Summary table ─────────────────────────────────────────────────────────
    buildSummaryTable(journals),

    // ── Spacer ────────────────────────────────────────────────────────────────
    para("", { spacingAfter: 320 }),

    // ── Detail heading ────────────────────────────────────────────────────────
    para("■ 연구 내용 상세", {
      bold: true,
      size: 26,
      color: "1F3864",
      spacingAfter: 120,
    }),

    // ── Per-entry detail blocks ───────────────────────────────────────────────
    ...journals.flatMap((entry, idx) => buildDetailSection(entry, idx)),

    // ── Total hours summary ───────────────────────────────────────────────────
    para("", { spacingAfter: 320 }),
    new Paragraph({
      children: [
        run("총 연구 시간: ", { bold: true, size: 24, color: "1F3864" }),
        run(`${totalHours}시간`, { bold: true, size: 24 }),
      ],
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 0 },
    }),
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

  return Packer.toBuffer(doc);
}

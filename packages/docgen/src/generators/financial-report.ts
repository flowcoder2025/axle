import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  VerticalAlign,
  WidthType,
} from "docx";
import { buildDocxStyles, buildSectionProperties } from "../utils/docx-styles.js";
import { run, para } from "../utils/docx-helpers.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FinancialReportInput {
  clientName: string;
  year: number;
  revenue?: number;
  operatingProfit?: number;
  netProfit?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  totalEquity?: number;
  creditRating?: string;
  source?: string;
  ratios?: {
    debtRatio?: number;
    roe?: number;
    roa?: number;
    operatingMargin?: number;
    netMargin?: number;
    debtToAsset?: number;
  };
  analysis?: string;
  adjustments?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
const HEADER_FILL = { type: "solid" as const, fill: "2F5496", color: "2F5496" };
const ROW_FILL = { type: "solid" as const, fill: "F2F6FC", color: "F2F6FC" };

function krw(n?: number): string {
  if (n == null) return "-";
  return new Intl.NumberFormat("ko-KR").format(Math.round(n)) + "원";
}

function pct(n?: number): string {
  if (n == null) return "-";
  return `${n.toFixed(2)}%`;
}

function tableCell(
  text: string,
  opts: {
    bold?: boolean;
    shade?: typeof HEADER_FILL | typeof ROW_FILL;
    textColor?: string;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    widthPct?: number;
  } = {}
): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [run(text, { bold: opts.bold ?? false, size: 20, color: opts.textColor })],
        alignment: opts.align ?? AlignmentType.LEFT,
        spacing: { before: 60, after: 60 },
      }),
    ],
    borders: {
      top: THIN_BORDER,
      bottom: THIN_BORDER,
      left: THIN_BORDER,
      right: THIN_BORDER,
    },
    shading: opts.shade,
    verticalAlign: VerticalAlign.CENTER,
    width: opts.widthPct
      ? { size: opts.widthPct, type: WidthType.PERCENTAGE }
      : undefined,
  });
}

function buildFinancialTable(input: FinancialReportInput): Table {
  const rows: [string, string][] = [
    ["매출액", krw(input.revenue)],
    ["영업이익", krw(input.operatingProfit)],
    ["당기순이익", krw(input.netProfit)],
    ["자산총계", krw(input.totalAssets)],
    ["부채총계", krw(input.totalLiabilities)],
    ["자본총계", krw(input.totalEquity)],
    ...(input.creditRating ? [["신용등급", input.creditRating] as [string, string]] : []),
    ...(input.source ? [["출처", input.source] as [string, string]] : []),
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          tableCell("항목", { bold: true, shade: HEADER_FILL, textColor: "FFFFFF", widthPct: 35 }),
          tableCell("금액", { bold: true, shade: HEADER_FILL, textColor: "FFFFFF", widthPct: 65 }),
        ],
      }),
      ...rows.map(
        ([label, value], idx) =>
          new TableRow({
            children: [
              tableCell(label, { bold: true, shade: idx % 2 === 0 ? ROW_FILL : undefined, widthPct: 35 }),
              tableCell(value, { align: AlignmentType.RIGHT, widthPct: 65 }),
            ],
          })
      ),
    ],
    borders: {
      insideHorizontal: THIN_BORDER,
      insideVertical: THIN_BORDER,
      top: THIN_BORDER,
      bottom: THIN_BORDER,
      left: THIN_BORDER,
      right: THIN_BORDER,
    },
  });
}

function buildRatiosTable(ratios: NonNullable<FinancialReportInput["ratios"]>): Table {
  const rows: [string, string][] = [
    ["부채비율", pct(ratios.debtRatio)],
    ["ROE (자기자본이익률)", pct(ratios.roe)],
    ["ROA (총자산이익률)", pct(ratios.roa)],
    ["영업이익률", pct(ratios.operatingMargin)],
    ["순이익률", pct(ratios.netMargin)],
    ["부채/자산 비율", pct(ratios.debtToAsset)],
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          tableCell("지표", { bold: true, shade: HEADER_FILL, textColor: "FFFFFF", widthPct: 50 }),
          tableCell("값", { bold: true, shade: HEADER_FILL, textColor: "FFFFFF", widthPct: 50 }),
        ],
      }),
      ...rows.map(
        ([label, value], idx) =>
          new TableRow({
            children: [
              tableCell(label, { bold: true, shade: idx % 2 === 0 ? ROW_FILL : undefined, widthPct: 50 }),
              tableCell(value, { align: AlignmentType.RIGHT, widthPct: 50 }),
            ],
          })
      ),
    ],
    borders: {
      insideHorizontal: THIN_BORDER,
      insideVertical: THIN_BORDER,
      top: THIN_BORDER,
      bottom: THIN_BORDER,
      left: THIN_BORDER,
      right: THIN_BORDER,
    },
  });
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function generateFinancialReportDocx(input: FinancialReportInput): Promise<Buffer> {
  const children = [
    para(`재무 분석 보고서`, { bold: true, size: 48, align: AlignmentType.CENTER, spacingAfter: 200 }),
    para(`${input.clientName}  |  ${input.year}년`, {
      size: 28,
      align: AlignmentType.CENTER,
      spacingAfter: 400,
    }),

    para("1. 재무 현황", { bold: true, size: 28, spacingAfter: 160 }),
    buildFinancialTable(input),
    para("", { spacingAfter: 300 }),
  ];

  if (input.ratios) {
    children.push(para("2. 재무 비율 분석", { bold: true, size: 28, spacingAfter: 160 }));
    children.push(buildRatiosTable(input.ratios));
    children.push(para("", { spacingAfter: 300 }));
  }

  if (input.analysis) {
    children.push(para("3. 종합 의견", { bold: true, size: 28, spacingAfter: 160 }));
    children.push(
      new Paragraph({
        children: [run(input.analysis, { size: 20 })],
        spacing: { before: 60, after: 60, line: 360 },
      })
    );
    children.push(para("", { spacingAfter: 300 }));
  }

  if (input.adjustments) {
    children.push(para("4. 조정 사항", { bold: true, size: 28, spacingAfter: 160 }));
    children.push(
      new Paragraph({
        children: [run(input.adjustments, { size: 20 })],
        spacing: { before: 60, after: 60, line: 360 },
      })
    );
  }

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

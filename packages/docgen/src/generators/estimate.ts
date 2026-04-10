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
import {
  buildDocxStyles,
  buildSectionProperties,
} from "../utils/docx-styles.js";
import { krw, fmtDate, todayKorean, run, para } from "../utils/docx-helpers.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface EstimateDocInput {
  estimateNumber: string;
  clientName: string;
  clientAddress?: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  totalAmount: number;
  taxAmount?: number;
  validUntil?: string;
  memo?: string;
  issuerName: string;
  issuerCompany: string;
}

// ── Table cell builder ────────────────────────────────────────────────────────

const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" };
const HEADER_FILL = { type: "solid" as const, fill: "2F5496", color: "2F5496" };
const TOTAL_FILL = { type: "solid" as const, fill: "D6E4F0", color: "D6E4F0" };

function cell(
  text: string,
  opts: {
    bold?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    shade?: typeof HEADER_FILL;
    textColor?: string;
    widthPct?: number;
  } = {}
): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          run(text, {
            bold: opts.bold ?? false,
            size: 20,
            color: opts.textColor,
          }),
        ],
        alignment: opts.align ?? AlignmentType.CENTER,
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

// ── Info table (수신/발신) ─────────────────────────────────────────────────────

function buildInfoTable(input: EstimateDocInput): Table {
  const labelOpts = { bold: true, shade: { type: "solid" as const, fill: "F2F2F2", color: "F2F2F2" } };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell("견적번호", { ...labelOpts, widthPct: 15 }),
          cell(input.estimateNumber, { align: AlignmentType.LEFT, widthPct: 35 }),
          cell("발행일", { ...labelOpts, widthPct: 15 }),
          cell(todayKorean(), { align: AlignmentType.LEFT, widthPct: 35 }),
        ],
      }),
      new TableRow({
        children: [
          cell("수신", { ...labelOpts, widthPct: 15 }),
          cell(input.clientName, { align: AlignmentType.LEFT, widthPct: 35 }),
          cell("발신", { ...labelOpts, widthPct: 15 }),
          cell(input.issuerCompany, { align: AlignmentType.LEFT, widthPct: 35 }),
        ],
      }),
      ...(input.clientAddress || input.issuerName
        ? [
            new TableRow({
              children: [
                cell("주소", { ...labelOpts, widthPct: 15 }),
                cell(input.clientAddress ?? "", { align: AlignmentType.LEFT, widthPct: 35 }),
                cell("담당자", { ...labelOpts, widthPct: 15 }),
                cell(input.issuerName, { align: AlignmentType.LEFT, widthPct: 35 }),
              ],
            }),
          ]
        : []),
      ...(input.validUntil
        ? [
            new TableRow({
              children: [
                cell("유효기간", { ...labelOpts, widthPct: 15 }),
                cell(fmtDate(input.validUntil), { align: AlignmentType.LEFT, widthPct: 85 }),
              ],
            }),
          ]
        : []),
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

// ── Items table ────────────────────────────────────────────────────────────────

function buildItemsTable(input: EstimateDocInput): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell("No.", { bold: true, shade: HEADER_FILL, textColor: "FFFFFF", widthPct: 6 }),
      cell("품목", { bold: true, shade: HEADER_FILL, textColor: "FFFFFF", widthPct: 40 }),
      cell("수량", { bold: true, shade: HEADER_FILL, textColor: "FFFFFF", widthPct: 12 }),
      cell("단가", { bold: true, shade: HEADER_FILL, textColor: "FFFFFF", widthPct: 21 }),
      cell("금액", { bold: true, shade: HEADER_FILL, textColor: "FFFFFF", widthPct: 21 }),
    ],
  });

  const itemRows = input.items.map(
    (item, idx) =>
      new TableRow({
        children: [
          cell(String(idx + 1), { widthPct: 6 }),
          cell(item.name, { align: AlignmentType.LEFT, widthPct: 40 }),
          cell(String(item.quantity), { widthPct: 12 }),
          cell(krw(item.unitPrice), { align: AlignmentType.RIGHT, widthPct: 21 }),
          cell(krw(item.amount), { align: AlignmentType.RIGHT, widthPct: 21 }),
        ],
      })
  );

  const subtotal = input.totalAmount - (input.taxAmount ?? 0);
  const subtotalRow = new TableRow({
    children: [
      new TableCell({
        children: [
          new Paragraph({
            children: [run("소계", { bold: true, size: 20 })],
            alignment: AlignmentType.RIGHT,
            spacing: { before: 60, after: 60 },
          }),
        ],
        borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
        shading: TOTAL_FILL,
        verticalAlign: VerticalAlign.CENTER,
        columnSpan: 4,
      }),
      cell(krw(subtotal), { bold: true, shade: TOTAL_FILL, align: AlignmentType.RIGHT, widthPct: 21 }),
    ],
  });

  const taxRow = input.taxAmount
    ? new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [run("부가세 (10%)", { bold: true, size: 20 })],
                alignment: AlignmentType.RIGHT,
                spacing: { before: 60, after: 60 },
              }),
            ],
            borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
            shading: TOTAL_FILL,
            verticalAlign: VerticalAlign.CENTER,
            columnSpan: 4,
          }),
          cell(krw(input.taxAmount), { bold: true, shade: TOTAL_FILL, align: AlignmentType.RIGHT, widthPct: 21 }),
        ],
      })
    : null;

  const totalRow = new TableRow({
    children: [
      new TableCell({
        children: [
          new Paragraph({
            children: [run("합 계", { bold: true, size: 20, color: "FFFFFF" })],
            alignment: AlignmentType.RIGHT,
            spacing: { before: 60, after: 60 },
          }),
        ],
        borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
        shading: { type: "solid", fill: "2F5496", color: "2F5496" },
        verticalAlign: VerticalAlign.CENTER,
        columnSpan: 4,
      }),
      cell(krw(input.totalAmount), {
        bold: true,
        shade: { type: "solid", fill: "2F5496", color: "2F5496" },
        textColor: "FFFFFF",
        align: AlignmentType.RIGHT,
        widthPct: 21,
      }),
    ],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow,
      ...itemRows,
      subtotalRow,
      ...(taxRow ? [taxRow] : []),
      totalRow,
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

export async function generateEstimateDocx(input: EstimateDocInput): Promise<Buffer> {
  const children = [
    // Title
    para("견  적  서", { bold: true, size: 48, align: AlignmentType.CENTER, spacingAfter: 400 }),

    // Info table
    buildInfoTable(input),

    // Spacer
    para("", { spacingAfter: 200 }),

    // Items table
    buildItemsTable(input),
  ];

  // Memo
  if (input.memo) {
    children.push(para("", { spacingAfter: 160 }));
    children.push(para("※ 비고", { bold: true, size: 20 }));
    children.push(
      new Paragraph({
        children: [run(input.memo, { size: 18, color: "666666" })],
        spacing: { before: 60, after: 0, line: 360 },
      })
    );
  }

  // Issuer signature area
  children.push(para("", { spacingAfter: 400 }));
  children.push(
    para(`${input.issuerCompany}  |  담당: ${input.issuerName}`, {
      align: AlignmentType.RIGHT,
      size: 20,
    })
  );

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

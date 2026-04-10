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

export interface ContractParty {
  name: string;
  representative: string;
  businessNumber?: string;
  address?: string;
}

export interface ContractTerm {
  title: string;
  content: string;
  order: number;
}

export interface ContractDocInput {
  contractNumber: string;
  title: string;
  partyA: ContractParty;
  partyB: ContractParty;
  terms: Array<ContractTerm>;
  totalAmount?: number;
  startDate?: string;
  endDate?: string;
  signatureDate?: string;
}

// ── Table cell builders ────────────────────────────────────────────────────────

const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" };
const PARTY_LABEL_FILL = { type: "solid" as const, fill: "2F5496", color: "2F5496" };
const PARTY_ROW_FILL = { type: "solid" as const, fill: "F2F2F2", color: "F2F2F2" };
const SIG_FILL = { type: "solid" as const, fill: "EBF3FB", color: "EBF3FB" };

function labelCell(text: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [run(text, { bold: true, size: 20, color: "FFFFFF" })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 80 },
      }),
    ],
    shading: PARTY_LABEL_FILL,
    borders: {
      top: THIN_BORDER,
      bottom: THIN_BORDER,
      left: THIN_BORDER,
      right: THIN_BORDER,
    },
    verticalAlign: VerticalAlign.CENTER,
    width: { size: 20, type: WidthType.PERCENTAGE },
  });
}

function valueCell(text: string, widthPct = 30): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [run(text, { size: 20 })],
        spacing: { before: 80, after: 80 },
      }),
    ],
    borders: {
      top: THIN_BORDER,
      bottom: THIN_BORDER,
      left: THIN_BORDER,
      right: THIN_BORDER,
    },
    verticalAlign: VerticalAlign.CENTER,
    width: { size: widthPct, type: WidthType.PERCENTAGE },
  });
}

// ── Party info table ───────────────────────────────────────────────────────────

function buildPartyTable(party: ContractParty, label: string): Table {
  const rows: TableRow[] = [
    // Header row: 갑/을 label spanning full width
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [run(`${label} (${party.name})`, { bold: true, size: 22, color: "FFFFFF" })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 80, after: 80 },
            }),
          ],
          shading: PARTY_LABEL_FILL,
          columnSpan: 4,
          borders: {
            top: THIN_BORDER,
            bottom: THIN_BORDER,
            left: THIN_BORDER,
            right: THIN_BORDER,
          },
        }),
      ],
    }),
    // Representative
    new TableRow({
      children: [
        labelCell("대표자"),
        valueCell(party.representative, 30),
        labelCell("사업자번호"),
        valueCell(party.businessNumber ?? "—", 30),
      ],
    }),
  ];

  if (party.address) {
    rows.push(
      new TableRow({
        children: [
          labelCell("주소"),
          new TableCell({
            children: [
              new Paragraph({
                children: [run(party.address, { size: 20 })],
                spacing: { before: 80, after: 80 },
              }),
            ],
            borders: {
              top: THIN_BORDER,
              bottom: THIN_BORDER,
              left: THIN_BORDER,
              right: THIN_BORDER,
            },
            columnSpan: 3,
            verticalAlign: VerticalAlign.CENTER,
          }),
        ],
      })
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
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

// ── Contract overview table ────────────────────────────────────────────────────

function buildOverviewTable(input: ContractDocInput): Table | null {
  const hasAmount = input.totalAmount !== undefined;
  const hasDuration = input.startDate || input.endDate;
  if (!hasAmount && !hasDuration) return null;

  const rows: TableRow[] = [];

  if (hasAmount && input.totalAmount !== undefined) {
    rows.push(
      new TableRow({
        children: [
          labelCell("계약금액"),
          new TableCell({
            children: [
              new Paragraph({
                children: [run(krw(input.totalAmount), { bold: true, size: 22 })],
                spacing: { before: 80, after: 80 },
              }),
            ],
            borders: {
              top: THIN_BORDER,
              bottom: THIN_BORDER,
              left: THIN_BORDER,
              right: THIN_BORDER,
            },
            columnSpan: 3,
          }),
        ],
      })
    );
  }

  if (hasDuration) {
    rows.push(
      new TableRow({
        children: [
          labelCell("계약기간"),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  run(
                    `${fmtDate(input.startDate)} ~ ${fmtDate(input.endDate)}`,
                    { size: 22 }
                  ),
                ],
                spacing: { before: 80, after: 80 },
              }),
            ],
            borders: {
              top: THIN_BORDER,
              bottom: THIN_BORDER,
              left: THIN_BORDER,
              right: THIN_BORDER,
            },
            columnSpan: 3,
          }),
        ],
      })
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
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

// ── Signature table ────────────────────────────────────────────────────────────

function buildSignatureTable(input: ContractDocInput): Table {
  const signDate = fmtDate(input.signatureDate) || todayKorean();

  function sigCell(label: string, party: ContractParty): TableCell {
    return new TableCell({
      children: [
        new Paragraph({
          children: [run(label, { bold: true, size: 20 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 60 },
        }),
        new Paragraph({
          children: [run(party.name, { size: 20 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 20, after: 20 },
        }),
        new Paragraph({
          children: [run(`대표자: ${party.representative}`, { size: 20 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 20, after: 20 },
        }),
        new Paragraph({
          children: [run("(인)", { size: 20, color: "888888" })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 80 },
        }),
      ],
      shading: SIG_FILL,
      borders: {
        top: THIN_BORDER,
        bottom: THIN_BORDER,
        left: THIN_BORDER,
        right: THIN_BORDER,
      },
      verticalAlign: VerticalAlign.CENTER,
      width: { size: 45, type: WidthType.PERCENTAGE },
    });
  }

  // Spacer cell between the two signature cells
  const spacerCell = new TableCell({
    children: [new Paragraph({ children: [] })],
    borders: {
      top: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
    },
    width: { size: 10, type: WidthType.PERCENTAGE },
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          sigCell("갑 (갑 측)", input.partyA),
          spacerCell,
          sigCell("을 (을 측)", input.partyB),
        ],
      }),
    ],
  });
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function generateContractDocx(input: ContractDocInput): Promise<Buffer> {
  // Sort terms by order
  const sortedTerms = [...input.terms].sort((a, b) => a.order - b.order);

  const children: (Paragraph | Table)[] = [
    // Title
    para(input.title || "용역 계약서", {
      bold: true,
      size: 48,
      align: AlignmentType.CENTER,
      spacingAfter: 160,
    }),

    // Contract number + date
    para(`계약번호: ${input.contractNumber}    작성일: ${todayKorean()}`, {
      size: 20,
      color: "666666",
      align: AlignmentType.CENTER,
      spacingAfter: 400,
    }),

    // Preamble
    para(
      `본 계약은 아래 당사자 간에 성실히 이행할 것을 합의하고 다음과 같이 계약을 체결한다.`,
      { size: 22, align: AlignmentType.JUSTIFIED, spacingAfter: 240 }
    ),

    // Party A table
    buildPartyTable(input.partyA, "갑"),
    para("", { spacingAfter: 160 }),

    // Party B table
    buildPartyTable(input.partyB, "을"),
    para("", { spacingAfter: 240 }),
  ];

  // Overview table (amount + duration)
  const overviewTable = buildOverviewTable(input);
  if (overviewTable) {
    children.push(overviewTable);
    children.push(para("", { spacingAfter: 240 }));
  }

  // Contract terms (조항)
  for (const term of sortedTerms) {
    children.push(
      para(`제${term.order}조 (${term.title})`, {
        bold: true,
        size: 24,
        spacingBefore: 200,
        spacingAfter: 80,
      })
    );
    // Split multi-paragraph content
    const blocks = term.content.split(/\n{1,}/);
    for (const block of blocks) {
      const trimmed = block.trim();
      if (trimmed) {
        children.push(
          new Paragraph({
            children: [run(trimmed, { size: 22 })],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 0, after: 80, line: 360 },
            indent: { left: 360 },
          })
        );
      }
    }
  }

  // Signature area
  children.push(para("", { spacingAfter: 400 }));
  children.push(
    para(`위 계약의 증거로 본 계약서를 2부 작성하여 각 1부씩 보관한다.`, {
      size: 22,
      align: AlignmentType.CENTER,
      spacingAfter: 80,
    })
  );
  children.push(
    para(fmtDate(input.signatureDate) || todayKorean(), {
      size: 22,
      align: AlignmentType.CENTER,
      spacingAfter: 320,
    })
  );
  children.push(buildSignatureTable(input));

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

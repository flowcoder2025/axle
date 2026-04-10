import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  ShadingType,
  BorderStyle,
  LevelFormat,
  convertMillimetersToTwip,
} from "docx";
import {
  buildDocxStyles,
  buildSectionProperties,
  FONT_KOREAN,
  FONT_SIZE_BODY,
  FONT_SIZE_H1,
  FONT_SIZE_H2,
  FONT_SIZE_H3,
  SPACING,
} from "../utils/docx-styles.js";

// ── Public option types ───────────────────────────────────────────────────────

export interface MarkdownToDocxOptions {
  title?: string;
  author?: string;
  /** Font family for body text (defaults to 맑은 고딕) */
  fontFamily?: string;
}

// ── Internal AST types ────────────────────────────────────────────────────────

type BlockNode =
  | HeadingNode
  | ParagraphNode
  | BulletListNode
  | OrderedListNode
  | CodeBlockNode
  | TableNode
  | BlankNode;

interface HeadingNode {
  type: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

interface ParagraphNode {
  type: "paragraph";
  runs: InlineRun[];
}

interface BulletListNode {
  type: "bullet";
  items: InlineRun[][];
}

interface OrderedListNode {
  type: "ordered";
  items: InlineRun[][];
}

interface CodeBlockNode {
  type: "code";
  lang: string;
  lines: string[];
}

interface TableNode {
  type: "table";
  /** rows[0] is the header row */
  rows: string[][];
}

interface BlankNode {
  type: "blank";
}

interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

// ── Inline parser ─────────────────────────────────────────────────────────────

/**
 * Parses a markdown inline string into a list of InlineRun segments.
 * Handles: **bold**, *italic*, `code`, and combinations.
 */
function parseInline(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  // Token regex: bold+italic, bold, italic, inline-code, plain text
  const tokenRe = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|__(.+?)__|_(.+?)_|\*(.+?)\*|`(.+?)`|([^*_`]+))/gs;

  for (const match of text.matchAll(tokenRe)) {
    const [, , boldItalic, bold1, bold2, italic1, italic2, code, plain] = match;

    if (boldItalic) {
      runs.push({ text: boldItalic, bold: true, italic: true });
    } else if (bold1 || bold2) {
      runs.push({ text: bold1 ?? bold2, bold: true });
    } else if (italic1 || italic2) {
      runs.push({ text: italic1 ?? italic2, italic: true });
    } else if (code) {
      runs.push({ text: code, code: true });
    } else if (plain) {
      runs.push({ text: plain });
    }
  }

  return runs.length > 0 ? runs : [{ text }];
}

// ── Block parser ──────────────────────────────────────────────────────────────

function parseMarkdown(markdown: string): BlockNode[] {
  const rawLines = markdown.split(/\r?\n/);
  const blocks: BlockNode[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];

    // Blank line
    if (line.trim() === "") {
      blocks.push({ type: "blank" });
      i++;
      continue;
    }

    // Fenced code block
    const fenceMatch = line.match(/^```(\w*)$/);
    if (fenceMatch) {
      const lang = fenceMatch[1] ?? "";
      const codeLines: string[] = [];
      i++;
      while (i < rawLines.length && !rawLines[i].startsWith("```")) {
        codeLines.push(rawLines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: "code", lang, lines: codeLines });
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 6) as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ type: "heading", level, text: headingMatch[2].trim() });
      i++;
      continue;
    }

    // Table (requires header + separator + rows)
    if (line.startsWith("|")) {
      const tableRows: string[][] = [];
      while (i < rawLines.length && rawLines[i].startsWith("|")) {
        const row = rawLines[i]
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
        // Skip separator rows (e.g. | --- | --- |)
        if (!row.every((c) => /^[-:]+$/.test(c))) {
          tableRows.push(row);
        }
        i++;
      }
      if (tableRows.length > 0) {
        blocks.push({ type: "table", rows: tableRows });
      }
      continue;
    }

    // Unordered list
    if (/^[-*•]\s+/.test(line)) {
      const items: InlineRun[][] = [];
      while (i < rawLines.length && /^[-*•]\s+/.test(rawLines[i])) {
        items.push(parseInline(rawLines[i].replace(/^[-*•]\s+/, "")));
        i++;
      }
      blocks.push({ type: "bullet", items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: InlineRun[][] = [];
      while (i < rawLines.length && /^\d+\.\s+/.test(rawLines[i])) {
        items.push(parseInline(rawLines[i].replace(/^\d+\.\s+/, "")));
        i++;
      }
      blocks.push({ type: "ordered", items });
      continue;
    }

    // Paragraph — accumulate until a blank line or block starter
    const paraLines: string[] = [];
    while (
      i < rawLines.length &&
      rawLines[i].trim() !== "" &&
      !rawLines[i].startsWith("#") &&
      !rawLines[i].startsWith("|") &&
      !rawLines[i].startsWith("```") &&
      !/^[-*•]\s+/.test(rawLines[i]) &&
      !/^\d+\.\s+/.test(rawLines[i])
    ) {
      paraLines.push(rawLines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", runs: parseInline(paraLines.join(" ")) });
    }
  }

  return blocks;
}

// ── docx element builders ─────────────────────────────────────────────────────

function makeTextRun(run: InlineRun, font: string): TextRun {
  return new TextRun({
    text: run.text,
    bold: run.bold,
    italics: run.italic,
    font: { name: font, eastAsia: font },
    size: run.code ? 20 : FONT_SIZE_BODY, // 10pt for inline code
    ...(run.code
      ? {
          highlight: "yellow",
        }
      : {}),
  });
}

function makeHeadingParagraph(
  node: HeadingNode,
  font: string
): Paragraph {
  const headingLevelMap: Record<number, typeof HeadingLevel[keyof typeof HeadingLevel]> = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
    6: HeadingLevel.HEADING_6,
  };
  const sizeMap: Record<number, number> = {
    1: FONT_SIZE_H1,
    2: FONT_SIZE_H2,
    3: FONT_SIZE_H3,
    4: FONT_SIZE_H3,
    5: FONT_SIZE_H3,
    6: FONT_SIZE_H3,
  };

  return new Paragraph({
    heading: headingLevelMap[node.level],
    children: [
      new TextRun({
        text: node.text,
        bold: true,
        font: { name: font, eastAsia: font },
        size: sizeMap[node.level],
      }),
    ],
  });
}

function makeParagraph(node: ParagraphNode, font: string): Paragraph {
  return new Paragraph({
    spacing: { after: SPACING.afterParagraph, line: SPACING.line },
    alignment: AlignmentType.JUSTIFIED,
    children: node.runs.map((r) => makeTextRun(r, font)),
  });
}

function makeBulletParagraphs(
  node: BulletListNode,
  font: string
): Paragraph[] {
  return node.items.map(
    (runs) =>
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 80 },
        children: runs.map((r) => makeTextRun(r, font)),
      })
  );
}

function makeOrderedParagraphs(
  node: OrderedListNode,
  font: string
): Paragraph[] {
  return node.items.map(
    (runs) =>
      new Paragraph({
        numbering: { reference: "docgen-numbering", level: 0 },
        spacing: { after: 80 },
        children: runs.map((r) => makeTextRun(r, font)),
      })
  );
}

function makeCodeParagraphs(node: CodeBlockNode, font: string): Paragraph[] {
  return node.lines.map(
    (line) =>
      new Paragraph({
        spacing: { after: 0, line: 240 },
        shading: { type: ShadingType.CLEAR, fill: "F3F4F6" },
        border: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
        },
        children: [
          new TextRun({
            text: line || " ",
            font: { name: "Courier New", eastAsia: font },
            size: 18, // 9pt
          }),
        ],
      })
  );
}

function makeTable(node: TableNode, font: string): Table {
  const [headerRow, ...dataRows] = node.rows;

  const buildCells = (cells: string[], isHeader: boolean): TableCell[] =>
    cells.map(
      (cell) =>
        new TableCell({
          shading: isHeader
            ? { type: ShadingType.CLEAR, fill: "E5E7EB" }
            : undefined,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: cell,
                  bold: isHeader,
                  font: { name: font, eastAsia: font },
                  size: FONT_SIZE_BODY,
                }),
              ],
            }),
          ],
        })
    );

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: buildCells(headerRow, true),
    }),
    ...dataRows.map(
      (row) =>
        new TableRow({
          children: buildCells(row, false),
        })
    ),
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}

// ── Main converter ────────────────────────────────────────────────────────────

/**
 * Converts a Markdown string to a DOCX buffer.
 *
 * Supported Markdown elements:
 * - Headings: # – ###### → Heading1–6
 * - **bold**, *italic*, ***bold+italic***, `inline code`
 * - Bullet lists (-/*) and ordered lists (1. …)
 * - Pipe tables (| col | col |)
 * - Fenced code blocks (``` … ```) — monospace, gray background
 */
export async function markdownToDocx(
  markdown: string,
  options: MarkdownToDocxOptions = {}
): Promise<Buffer> {
  const font = options.fontFamily ?? FONT_KOREAN;
  const blocks = parseMarkdown(markdown);

  const children: (Paragraph | Table)[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "blank":
        children.push(new Paragraph({ text: "" }));
        break;

      case "heading":
        children.push(makeHeadingParagraph(block, font));
        break;

      case "paragraph":
        children.push(makeParagraph(block, font));
        break;

      case "bullet":
        children.push(...makeBulletParagraphs(block, font));
        break;

      case "ordered":
        children.push(...makeOrderedParagraphs(block, font));
        break;

      case "code":
        children.push(...makeCodeParagraphs(block, font));
        break;

      case "table":
        children.push(makeTable(block, font));
        // Add spacing after table
        children.push(new Paragraph({ text: "" }));
        break;
    }
  }

  const doc = new Document({
    creator: options.author ?? "AXLE docgen",
    title: options.title ?? "",
    styles: buildDocxStyles(),
    numbering: {
      config: [
        {
          reference: "docgen-numbering",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: {
                    left: convertMillimetersToTwip(12),
                    hanging: convertMillimetersToTwip(6),
                  },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: buildSectionProperties(),
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

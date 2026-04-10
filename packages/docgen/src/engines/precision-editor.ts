import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  PageNumber,
  AlignmentType,
  Footer,
  Header,
} from "docx";
import type { PrecisionInput, PrecisionOutput, DocumentSection } from "../types.js";
import {
  buildDocxStyles,
  buildSectionProperties,
  FONT_KOREAN,
  FONT_SIZE_BODY,
  SPACING,
} from "../utils/docx-styles.js";

/**
 * Precision Editor Engine (WI-064)
 *
 * Generates a well-formatted DOCX file from draft sections.
 * Uses the `docx` npm package to produce:
 *   - Heading styles (제목, 소제목) via 맑은 고딕
 *   - Justified paragraphs with Korean spacing
 *   - Table of contents placeholder
 *   - Page numbers in the footer
 */

// ── Paragraph builders ────────────────────────────────────────────────────────

// HeadingLevel values are string literals that map to docx's heading type
type DocxHeadingValue = "Heading1" | "Heading2" | "Heading3" | "Heading4" | "Heading5" | "Heading6" | "Title";

const HEADING_LEVEL_MAP: Record<1 | 2 | 3, DocxHeadingValue> = {
  1: HeadingLevel.HEADING_1 as DocxHeadingValue,
  2: HeadingLevel.HEADING_2 as DocxHeadingValue,
  3: HeadingLevel.HEADING_3 as DocxHeadingValue,
};

function buildHeadingParagraph(text: string, level: 1 | 2 | 3): Paragraph {
  return new Paragraph({
    text,
    heading: HEADING_LEVEL_MAP[level],
  });
}

function buildBodyParagraphs(content: string): Paragraph[] {
  // Split on double newlines to preserve intentional paragraph breaks
  const blocks = content.split(/\n{2,}/);
  return blocks
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        new Paragraph({
          children: [
            new TextRun({
              text: block,
              font: { name: FONT_KOREAN, eastAsia: FONT_KOREAN },
              size: FONT_SIZE_BODY,
            }),
          ],
          alignment: AlignmentType.JUSTIFIED,
          spacing: {
            after: SPACING.afterParagraph,
            line: SPACING.line,
          },
        })
    );
}

function buildTocPlaceholder(): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: "[목 차]",
        bold: true,
        font: { name: FONT_KOREAN, eastAsia: FONT_KOREAN },
        size: 28,
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  });
}

function buildPageNumberFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({ children: [PageNumber.CURRENT] }),
          new TextRun(" / "),
          new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
  });
}

// ── Section mapping ───────────────────────────────────────────────────────────

/**
 * If program requirements define a mapping from canonical section titles to
 * form-specific titles, this function applies the mapping.
 * Falls back to the original title when no mapping is found.
 */
function mapSectionTitle(
  title: string,
  requirements?: Record<string, unknown>
): string {
  if (!requirements) return title;
  const mapped = requirements[title];
  return typeof mapped === "string" ? mapped : title;
}

// ── File name builder ─────────────────────────────────────────────────────────

function buildFileName(sections: DocumentSection[]): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const titleSection = sections[0];
  const slug = titleSection
    ? titleSection.title.replace(/\s+/g, "_").slice(0, 20)
    : "document";
  return `business_plan_${slug}_${timestamp}.docx`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generatePrecisionDocx(
  input: PrecisionInput
): Promise<PrecisionOutput> {
  const { draftSections, programRequirements } = input;

  // 1. Analyze program form structure and map sections
  const mappedSections = draftSections.map((section) => ({
    ...section,
    title: mapSectionTitle(section.title, programRequirements),
  }));

  // 2. Build document body: TOC placeholder + sections
  const bodyChildren: Paragraph[] = [buildTocPlaceholder()];

  for (const section of mappedSections) {
    bodyChildren.push(buildHeadingParagraph(section.title, 1));
    bodyChildren.push(...buildBodyParagraphs(section.content));
  }

  // 3. Compose DOCX document
  const doc = new Document({
    styles: buildDocxStyles(),
    sections: [
      {
        properties: buildSectionProperties(),
        headers: {
          default: new Header({ children: [] }),
        },
        footers: {
          default: buildPageNumberFooter(),
        },
        children: bodyChildren,
      },
    ],
  });

  // 4. Serialize to buffer
  const docxBuffer = await Packer.toBuffer(doc);

  return {
    docxBuffer,
    fileName: buildFileName(draftSections),
  };
}

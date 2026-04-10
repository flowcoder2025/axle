import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import {
  buildDocxStyles,
  buildSectionProperties,
  FONT_KOREAN,
} from "../utils/docx-styles.js";
import { run, para } from "../utils/docx-helpers.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PatentDraftInput {
  inventionTitle: string;       // 발명의 명칭
  inventorName: string;
  applicantName: string;
  technicalField: string;       // 기술 분야
  backgroundArt: string;        // 배경 기술
  problemToSolve: string;       // 해결하고자 하는 과제
  solutionMeans: string;        // 과제의 해결 수단
  effectOfInvention: string;    // 발명의 효과
  detailedDescription: string;  // 발명을 실시하기 위한 구체적인 내용
  claims: string[];             // 청구항 (1항, 2항, ...)
  abstractText: string;         // 요약서
}

/** Korean patent section header in 【】 brackets */
function sectionHeader(label: string): Paragraph {
  return new Paragraph({
    children: [
      run(`【${label}】`, { bold: true, size: 24 }),
    ],
    alignment: AlignmentType.LEFT,
    spacing: { before: 320, after: 120, line: 360 },
  });
}

/** Indented sub-section header in 【】 brackets */
function subSectionHeader(label: string): Paragraph {
  return new Paragraph({
    children: [
      run(`【${label}】`, { bold: true, size: 22 }),
    ],
    alignment: AlignmentType.LEFT,
    spacing: { before: 200, after: 80, line: 360 },
    indent: { left: 360 },
  });
}

/** Body text paragraph, optionally indented */
function bodyPara(text: string, indentLevel = 0): Paragraph {
  return new Paragraph({
    children: [run(text, { size: 22 })],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 0, after: 80, line: 360 },
    indent: indentLevel > 0 ? { left: 360 * indentLevel } : undefined,
  });
}

/** Splits text by newline and generates one body paragraph per non-empty line */
function bodyParas(text: string, indentLevel = 0): Paragraph[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => bodyPara(line, indentLevel));
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generates a Korean patent specification (명세서) DOCX buffer.
 *
 * Document structure follows Korean Intellectual Property Office (KIPO)
 * standard patent application format:
 *
 *   【발명의 명칭】
 *   【기술 분야】
 *   【배경 기술】
 *   【발명의 내용】
 *     【해결하고자 하는 과제】
 *     【과제의 해결 수단】
 *     【발명의 효과】
 *   【발명을 실시하기 위한 구체적인 내용】
 *   【청구의 범위】
 *     【청구항 1】
 *     【청구항 2】 ...
 *   【요약서】
 *     【요약】
 */
export async function generatePatentDraftDocx(input: PatentDraftInput): Promise<Buffer> {
  const children: Paragraph[] = [];

  // ── Cover info (발명자 / 출원인) ──────────────────────────────────────────
  children.push(
    para("특  허  명  세  서", {
      bold: true,
      size: 40,
      align: AlignmentType.CENTER,
      spacingBefore: 0,
      spacingAfter: 320,
    })
  );
  children.push(
    para(`발 명 자: ${input.inventorName}`, {
      size: 22,
      align: AlignmentType.LEFT,
      spacingAfter: 80,
    })
  );
  children.push(
    para(`출 원 인: ${input.applicantName}`, {
      size: 22,
      align: AlignmentType.LEFT,
      spacingAfter: 320,
    })
  );

  // ── 발명의 명칭 ────────────────────────────────────────────────────────────
  children.push(sectionHeader("발명의 명칭"));
  children.push(bodyPara(input.inventionTitle));

  // ── 기술 분야 ──────────────────────────────────────────────────────────────
  children.push(sectionHeader("기술 분야"));
  children.push(...bodyParas(input.technicalField));

  // ── 배경 기술 ──────────────────────────────────────────────────────────────
  children.push(sectionHeader("배경 기술"));
  children.push(...bodyParas(input.backgroundArt));

  // ── 발명의 내용 ────────────────────────────────────────────────────────────
  children.push(sectionHeader("발명의 내용"));

  // 해결하고자 하는 과제
  children.push(subSectionHeader("해결하고자 하는 과제"));
  children.push(...bodyParas(input.problemToSolve, 1));

  // 과제의 해결 수단
  children.push(subSectionHeader("과제의 해결 수단"));
  children.push(...bodyParas(input.solutionMeans, 1));

  // 발명의 효과
  children.push(subSectionHeader("발명의 효과"));
  children.push(...bodyParas(input.effectOfInvention, 1));

  // ── 발명을 실시하기 위한 구체적인 내용 ────────────────────────────────────
  children.push(sectionHeader("발명을 실시하기 위한 구체적인 내용"));
  children.push(...bodyParas(input.detailedDescription));

  // ── 청구의 범위 ────────────────────────────────────────────────────────────
  children.push(sectionHeader("청구의 범위"));
  for (let i = 0; i < input.claims.length; i++) {
    const claimNum = i + 1;
    children.push(subSectionHeader(`청구항 ${claimNum}`));
    children.push(...bodyParas(input.claims[i], 1));
  }

  // ── 요약서 ────────────────────────────────────────────────────────────────
  children.push(sectionHeader("요약서"));
  children.push(subSectionHeader("요약"));
  children.push(...bodyParas(input.abstractText, 1));

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

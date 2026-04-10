import { AlignmentType, Paragraph, TextRun } from "docx";
import { FONT_KOREAN } from "./docx-styles.js";

// ── Shared run/para options ────────────────────────────────────────────────────

export interface IRunOptions {
  bold?: boolean;
  size?: number;
  color?: string;
  italics?: boolean;
}

export interface IParagraphOptions {
  bold?: boolean;
  size?: number;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  color?: string;
  spacingBefore?: number;
  spacingAfter?: number;
  indent?: number;
}

// ── Formatting utilities ───────────────────────────────────────────────────────

/** Format a number as Korean currency (e.g. 1,234,567원) */
export function krw(amount: number): string {
  return new Intl.NumberFormat("ko-KR").format(amount) + "원";
}

/**
 * Format an ISO date string as Korean date (YYYY년 MM월 DD일).
 * Returns the original string if it cannot be parsed.
 */
export function fmtDate(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, "0")}월 ${String(d.getDate()).padStart(2, "0")}일`;
}

/** Return today's date as a Korean date string (e.g. 2025년 04월 10일) */
export function todayKorean(date?: Date): string {
  const d = date ?? new Date();
  return fmtDate(d.toISOString().slice(0, 10));
}

// ── docx element builders ─────────────────────────────────────────────────────

/** Build a TextRun with Korean font defaults */
export function run(text: string, options: Partial<IRunOptions> = {}): TextRun {
  return new TextRun({
    text,
    font: { name: FONT_KOREAN, eastAsia: FONT_KOREAN },
    size: options.size ?? 22,
    bold: options.bold ?? false,
    color: options.color,
    italics: options.italics ?? false,
  });
}

/** Build a Paragraph containing a single TextRun with Korean font defaults */
export function para(text: string, options: IParagraphOptions = {}): Paragraph {
  return new Paragraph({
    children: [
      run(text, {
        bold: options.bold,
        size: options.size,
        color: options.color,
      }),
    ],
    alignment: options.align ?? AlignmentType.LEFT,
    spacing: {
      before: options.spacingBefore ?? 0,
      after: options.spacingAfter ?? 0,
      line: 360,
    },
    indent: options.indent ? { left: options.indent } : undefined,
  });
}

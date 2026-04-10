import pdfParse from "pdf-parse";

// ── Internal types ────────────────────────────────────────────────────────────

interface TextLine {
  text: string;
  trimmed: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Splits raw PDF text into non-empty lines, normalising whitespace.
 */
function splitLines(raw: string): TextLine[] {
  return raw
    .split(/\r?\n/)
    .map((text) => ({ text, trimmed: text.trim() }))
    .filter((l) => l.trimmed.length > 0);
}

/**
 * Returns true when the line looks like a heading candidate:
 * - Short (≤ 80 chars)
 * - Does NOT end with sentence-ending punctuation
 * - Starts with an uppercase/Korean character or a number
 */
function isHeadingCandidate(line: TextLine): boolean {
  const t = line.trimmed;
  if (t.length === 0 || t.length > 80) return false;
  if (/[.,:;!?]$/.test(t)) return false;
  // Allow lines that start with a numeral (e.g. "1. Introduction"), uppercase, or Korean
  return /^[A-Z0-9\uAC00-\uD7A3]/.test(t);
}

/**
 * Detects whether a line is part of a markdown-style table separator row
 * produced by a prior pass (not needed here, but kept for clarity).
 */

/**
 * Detects a list item: starts with a bullet character or `N.`
 */
function listMatch(text: string): { ordered: boolean; content: string } | null {
  // Ordered: "1. ", "2. ", …
  const ordered = text.match(/^(\d+)\.\s+(.+)$/);
  if (ordered) return { ordered: true, content: ordered[2] };
  // Unordered: "• ", "· ", "- ", "* "
  const unordered = text.match(/^[•·\-\*]\s+(.+)$/);
  if (unordered) return { ordered: false, content: unordered[1] };
  return null;
}

/**
 * Attempts to detect a simple pipe-delimited table (some PDFs export tables
 * with | separators in their text layer).
 */
function detectTableBlock(lines: TextLine[], start: number): number {
  let i = start;
  while (i < lines.length && lines[i].trimmed.startsWith("|")) {
    i++;
  }
  return i - start; // number of consecutive pipe rows
}

/**
 * Infers a rough heading level from position in the document:
 * - First heading encountered → H1
 * - Subsequent headings with ≤ 30 chars → H2 (section titles)
 * - Longer subsequent headings → H3
 */
function inferHeadingLevel(
  line: TextLine,
  headingCount: number
): 1 | 2 | 3 {
  if (headingCount === 0) return 1;
  if (line.trimmed.length <= 30) return 2;
  return 3;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Converts a PDF buffer to a Markdown string.
 *
 * Strategy:
 * 1. Extract raw text with pdf-parse.
 * 2. Split into lines and classify each line as heading / list / table / paragraph.
 * 3. Emit the appropriate Markdown syntax.
 * 4. Preserve pipe-delimited table rows as Markdown tables.
 */
export async function pdfToMarkdown(pdfBuffer: Buffer): Promise<string> {
  const data = await pdfParse(pdfBuffer);
  const rawText: string = data.text ?? "";

  const lines = splitLines(rawText);
  const output: string[] = [];
  let headingCount = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Table block ─────────────────────────────────────────────────────────
    if (line.trimmed.startsWith("|")) {
      const blockLen = detectTableBlock(lines, i);
      const tableRows = lines.slice(i, i + blockLen);

      // Emit header row (first row), separator, then remaining rows
      tableRows.forEach((row, idx) => {
        output.push(row.trimmed);
        if (idx === 0) {
          // Generate separator based on cell count
          const cells = row.trimmed.split("|").filter((c) => c.trim().length > 0);
          output.push("|" + cells.map(() => " --- ").join("|") + "|");
        }
      });
      output.push("");
      i += blockLen;
      continue;
    }

    // ── List item ────────────────────────────────────────────────────────────
    const listItem = listMatch(line.trimmed);
    if (listItem) {
      const prefix = listItem.ordered ? "1." : "-";
      output.push(`${prefix} ${listItem.content}`);
      i++;
      continue;
    }

    // ── Heading ──────────────────────────────────────────────────────────────
    if (isHeadingCandidate(line)) {
      const level = inferHeadingLevel(line, headingCount);
      output.push(`${"#".repeat(level)} ${line.trimmed}`);
      output.push("");
      headingCount++;
      i++;
      continue;
    }

    // ── Regular paragraph ────────────────────────────────────────────────────
    // Accumulate consecutive paragraph lines into a single block.
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      !lines[i].trimmed.startsWith("|") &&
      !listMatch(lines[i].trimmed) &&
      !isHeadingCandidate(lines[i])
    ) {
      paraLines.push(lines[i].trimmed);
      i++;
    }
    if (paraLines.length > 0) {
      output.push(paraLines.join(" "));
      output.push("");
    }
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

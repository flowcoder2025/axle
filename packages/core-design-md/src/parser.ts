/**
 * `parseDesignMd` — regex-only DESIGN.md → `DesignTokens` extractor.
 *
 * Why no markdown library: WI-613 deliberately forbids
 * remark / marked / unified etc. so the package stays
 * zero-runtime-dependency. The trade-off is that the parser only
 * looks at two specific table groups (Neutral Scale, Sidebar) plus
 * the header — anything outside those windows is ignored.
 *
 * Robustness rules:
 *   - Empty input → returns an empty `DesignTokens` (never throws).
 *   - Malformed tables (missing column, no hex value) → that row is
 *     skipped silently. Throwing on a typo would make the loader
 *     brittle in a multi-tenant pack-install context.
 *   - Hex columns may carry inline-code backticks (`` `#FFFFFF` ``)
 *     or a bare value — both are accepted.
 */

import type { DesignTokens } from "./types.js";

const HEX_RE = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;

/**
 * Normalise a markdown row label to a kebab-case token key.
 * "Text Primary" → "text-primary".
 * "Sidebar Active BG" → "sidebar-active-bg".
 */
export function labelToTokenKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Extract the trimmed hex value from a markdown table cell, returning
 * `null` if the cell is missing a hex literal (e.g. rgba(), calc(),
 * blank, plain text reference).
 */
function extractHex(cell: string | undefined): string | null {
  if (!cell) return null;
  const m = HEX_RE.exec(cell);
  if (!m) return null;
  return m[0].toUpperCase();
}

/**
 * Parse a single markdown table block — already trimmed to its
 * `| header | … |` / separator / data rows — into row records.
 *
 * Returns `null` when the input doesn't look like a table.
 */
function parseTableBlock(block: string): Array<string[]> | null {
  const lines = block.split("\n").filter((l) => l.trim().startsWith("|"));
  if (lines.length < 2) return null;
  // Drop the separator row (`| --- | --- |`) and the header row.
  const dataLines = lines.slice(2);
  return dataLines.map((line) => splitRow(line));
}

function splitRow(line: string): string[] {
  // Strip leading/trailing pipes, then split on `|`. Cells may contain
  // backtick-wrapped values — splitting on `|` is safe because pipe
  // inside a code span is invalid markdown for table rows.
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

/**
 * Slice the source between an H3 heading line (`### {heading}`) and
 * the next H2/H3 boundary. Returns `null` when the heading is absent.
 */
function sliceSection(source: string, headingMatcher: RegExp): string | null {
  const lines = source.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (headingMatcher.test(lines[i]!)) {
      start = i + 1;
      break;
    }
  }
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (/^##\s/.test(line) || /^###\s/.test(line)) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

interface TablePopulation {
  light: Record<string, string>;
  dark: Record<string, string>;
}

function populateFromTable(
  block: string | null,
  expectedCols: number,
): TablePopulation {
  const out: TablePopulation = { light: {}, dark: {} };
  if (!block) return out;
  const rows = parseTableBlock(block);
  if (!rows) return out;
  for (const row of rows) {
    if (row.length < expectedCols) continue;
    const label = row[0];
    if (!label) continue;
    const lightHex = extractHex(row[1]);
    const darkHex = extractHex(row[2]);
    if (!lightHex && !darkHex) continue; // skip rgba/calc/text-only rows
    const key = labelToTokenKey(label);
    if (!key) continue;
    if (lightHex) out.light[key] = lightHex;
    if (darkHex) out.dark[key] = darkHex;
  }
  return out;
}

function extractHeaderMeta(source: string): {
  name: string;
  category?: string;
} {
  const h1 = /^#\s+(.+?)\s*$/m.exec(source);
  // "Design System: FlowCoder Default" → "FlowCoder Default".
  // Strip the optional `Design System:` prefix so consumers can use
  // the bare theme name as their pack/theme id.
  const rawName = h1?.[1] ?? "";
  const name = rawName.replace(/^Design System:\s*/i, "").trim();
  const cat = /^>\s*Category:\s*(.+?)\s*$/m.exec(source);
  const meta: { name: string; category?: string } = { name };
  if (cat?.[1]) meta.category = cat[1].trim();
  return meta;
}

export function parseDesignMd(source: string): DesignTokens {
  const empty: DesignTokens = {
    colors: { light: {}, dark: {} },
    sidebar: { light: {}, dark: {} },
    meta: { name: "" },
  };
  if (!source || source.trim().length === 0) return empty;

  const neutralBlock = sliceSection(source, /^###\s+Neutral Scale\b/);
  const sidebarBlock = sliceSection(source, /^###\s+Sidebar\b/);

  const colors = populateFromTable(neutralBlock, 3);
  const sidebar = populateFromTable(sidebarBlock, 3);
  const meta = extractHeaderMeta(source);

  return { colors, sidebar, meta };
}

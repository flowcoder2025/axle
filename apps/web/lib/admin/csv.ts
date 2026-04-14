/**
 * Simple CSV formatter — escapes quotes, wraps fields with commas/newlines.
 * For admin exports only (no streaming, limit 10,000 rows).
 */

type CsvValue = string | number | boolean | null | undefined | Date;

function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const headerLine = headers.map(escapeCell).join(",");
  const dataLines = rows.map((row) => row.map(escapeCell).join(","));
  // UTF-8 BOM for Excel compatibility
  return "\uFEFF" + [headerLine, ...dataLines].join("\n");
}

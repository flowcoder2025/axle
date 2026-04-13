/**
 * Generate CSV string from headers and rows.
 * Prepends BOM for Korean Excel compatibility.
 */
export function generateCsv(headers: string[], rows: string[][]): string {
  const BOM = "\uFEFF";
  const escape = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];
  return BOM + lines.join("\n");
}

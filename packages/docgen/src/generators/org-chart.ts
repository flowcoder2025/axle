/**
 * Organization chart Mermaid generator.
 *
 * Produces a Mermaid `flowchart TD` string from an OrgChartStructure.
 * Rendered to SVG/PNG on the client via the `mermaid` library.
 *
 * Layout:
 *   CEO (root)
 *     └─ Department 1 (box with member list)
 *     └─ Department 2
 *     └─ ...
 */

export interface OrgChartMember {
  name: string;
  position?: string;
}

export interface OrgChartDepartment {
  name: string;
  members: OrgChartMember[];
}

export interface OrgChartStructure {
  companyName: string;
  ceo: OrgChartMember;
  departments: OrgChartDepartment[];
}

/**
 * Escapes user-supplied text so it can be safely embedded inside a Mermaid
 * node label that the caller constructs with its own `<b>`, `<br/>`, `<i>`
 * tags. Handles two concerns:
 *
 * 1. XSS — the UI renders Mermaid with `securityLevel: "loose"` (needed for
 *    `<br/>` + `<b>`), so any HTML tag in user input would be injected into
 *    the resulting SVG. All `<`, `>`, `&`, `"`, `'` are HTML-encoded.
 * 2. Mermaid parser safety — `[]{}()|` and backticks alter node/edge syntax,
 *    so they are stripped. Newlines become `<br/>` for in-label line breaks.
 *
 * Must be called on every user-controlled string; generator-owned tags
 * (`<b>`, `<br/>`, `<i>`) are added by the caller after escaping.
 */
function escapeLabel(text: string): string {
  return text
    .replace(/[`[\]{}()|]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br/>")
    .trim();
}

function formatMemberLine(member: OrgChartMember): string {
  const name = escapeLabel(member.name);
  const position = member.position ? escapeLabel(member.position) : "";
  return position ? `${name} ${position}` : name;
}

function formatDepartmentLabel(dept: OrgChartDepartment): string {
  const header = `<b>${escapeLabel(dept.name)}</b>`;
  if (dept.members.length === 0) return header;
  const lines = dept.members.map(formatMemberLine).join("<br/>");
  return `${header}<br/>${lines}`;
}

function formatCeoLabel(ceo: OrgChartMember, companyName: string): string {
  const title = ceo.position || "대표이사";
  const company = escapeLabel(companyName);
  const name = escapeLabel(ceo.name);
  return `<b>${escapeLabel(title)}</b><br/>${name}<br/><i>${company}</i>`;
}

/**
 * Generates a Mermaid `flowchart TD` string representing the given org chart.
 *
 * The output is deterministic (stable node ids) so snapshot tests are reliable.
 */
export function generateOrgChartMermaid(chart: OrgChartStructure): string {
  if (!chart.companyName?.trim()) {
    throw new Error("OrgChartStructure.companyName is required");
  }
  if (!chart.ceo?.name?.trim()) {
    throw new Error("OrgChartStructure.ceo.name is required");
  }

  const lines: string[] = ["flowchart TD"];
  const ceoLabel = formatCeoLabel(chart.ceo, chart.companyName);
  lines.push(`  CEO["${ceoLabel}"]`);

  chart.departments.forEach((dept, index) => {
    const nodeId = `D${index + 1}`;
    const label = formatDepartmentLabel(dept);
    lines.push(`  ${nodeId}["${label}"]`);
    lines.push(`  CEO --> ${nodeId}`);
  });

  lines.push("  classDef ceo fill:#2d6a8b,stroke:#1f4d66,color:#ffffff");
  lines.push("  classDef dept fill:#cfe6f0,stroke:#4a90a8,color:#102a3a");
  lines.push("  class CEO ceo");
  const deptIds = chart.departments.map((_, i) => `D${i + 1}`).join(",");
  if (deptIds) lines.push(`  class ${deptIds} dept`);

  return lines.join("\n");
}

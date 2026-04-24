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
 * Escapes characters that would break Mermaid node label syntax.
 * Mermaid uses `<br/>` for line breaks inside labels. Quotes and backticks are
 * stripped to avoid parser ambiguity.
 */
function escapeLabel(text: string): string {
  return text.replace(/["`]/g, "").replace(/\n/g, "<br/>").trim();
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

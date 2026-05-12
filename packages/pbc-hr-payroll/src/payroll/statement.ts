/**
 * `renderStatementMarkdown` / `renderStatementHtml` — pure
 * formatters that turn a `PayrollStatement` into a Korean payroll
 * slip (급여명세서). Render targets are markdown and HTML; PDF /
 * HWPX rendering is a follow-up WI (see sprint contract).
 *
 * The renderers are deliberately string-only — no `react-dom/server`
 * or other heavyweight runtime — so they can be invoked from a
 * Server Action or a Vercel edge handler without dragging in a
 * browser-only dependency tree.
 *
 * XSS posture: `PayrollResult` only carries numbers + a single Date,
 * so the HTML renderer escapes every interpolated value (including
 * the document URL) on the way out. The unit test in
 * `__tests__/statement.test.ts` asserts no `<script>` token appears.
 */

import type { PayrollResult, PayrollStatement, YearMonth } from "../types.js";

/**
 * Optional context that supplements the rendered slip with
 * (userId, period, employeeName, organizationName) — the
 * `PayrollStatement` shape itself doesn't carry these, so the
 * caller (FlowTeams payroll page, a Server Action wrapper, …)
 * supplies them at render time.
 *
 * Every field is optional so the renderer degrades gracefully when
 * the caller has none of the context: the rendered slip simply omits
 * the header info row.
 */
export interface PayrollStatementRenderContext {
  userId?: string;
  employeeName?: string;
  organizationName?: string;
  period?: YearMonth;
}

const KRW = new Intl.NumberFormat("ko-KR");

function formatKrw(amount: number): string {
  return `${KRW.format(Math.round(amount))} 원`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function insuranceSubtotal(result: PayrollResult): number {
  const d = result.deductions;
  return (
    d.nationalPension + d.healthInsurance + d.longTermCare + d.employmentInsurance
  );
}

function totalDeductions(result: PayrollResult): number {
  const d = result.deductions;
  return (
    d.nationalPension +
    d.healthInsurance +
    d.longTermCare +
    d.employmentInsurance +
    d.incomeTax +
    d.localIncomeTax +
    d.other
  );
}

function formatPeriod(period: YearMonth): string {
  return `${period.year}년 ${String(period.month).padStart(2, "0")}월`;
}

/**
 * Markdown payroll slip (급여명세서).
 *
 * Sections:
 *   1. 헤더 — 귀속 기간 / 사원 식별 (context가 제공되면)
 *   2. 지급내역 — 기본급 (총지급액)
 *   3. 공제내역 — 4대보험 + 소득세/지방소득세/기타
 *   4. 실수령액
 *   5. 비고 — 적용 보험요율 연도 / 산출 시각
 */
export function renderStatementMarkdown(
  statement: PayrollStatement,
  ctx: PayrollStatementRenderContext = {},
): string {
  const r = statement.result;
  const d = r.deductions;
  const insurance = insuranceSubtotal(r);
  const totalDed = totalDeductions(r);

  const headerLines: string[] = ["# 급여명세서", ""];
  if (ctx.period) {
    headerLines.push(`**귀속 기간:** ${formatPeriod(ctx.period)}`);
  }
  if (ctx.employeeName) {
    headerLines.push(`**성명:** ${ctx.employeeName}`);
  } else if (ctx.userId) {
    headerLines.push(`**사번:** ${ctx.userId}`);
  }
  if (ctx.organizationName) {
    headerLines.push(`**소속:** ${ctx.organizationName}`);
  }
  if (headerLines.length > 2) headerLines.push("");

  return [
    ...headerLines,
    "## 지급내역",
    "",
    "| 항목 | 금액 |",
    "| --- | ---: |",
    `| 기본급 (총지급액) | ${formatKrw(r.gross)} |`,
    "",
    "## 공제내역",
    "",
    "| 항목 | 금액 |",
    "| --- | ---: |",
    `| 국민연금 | ${formatKrw(d.nationalPension)} |`,
    `| 건강보험 | ${formatKrw(d.healthInsurance)} |`,
    `| 장기요양보험 | ${formatKrw(d.longTermCare)} |`,
    `| 고용보험 | ${formatKrw(d.employmentInsurance)} |`,
    `| **4대보험 소계** | **${formatKrw(insurance)}** |`,
    `| 소득세 | ${formatKrw(d.incomeTax)} |`,
    `| 지방소득세 | ${formatKrw(d.localIncomeTax)} |`,
    `| 기타 | ${formatKrw(d.other)} |`,
    `| **공제 합계** | **${formatKrw(totalDed)}** |`,
    "",
    "## 실수령액",
    "",
    `**${formatKrw(r.net)}**`,
    "",
    "---",
    "",
    `*적용 보험요율 연도: ${r.metadata.insuranceRatesYear} / ` +
      `산출 시각: ${r.metadata.calculatedAt.toISOString()}*`,
    statement.documentUrl
      ? `\n*문서 URL: ${statement.documentUrl}*`
      : "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/**
 * HTML payroll slip (급여명세서) — semantic + escaped.
 *
 * - Wrapped in `<article class="payroll-statement">` so the consumer
 *   can scope styles without injecting unscoped CSS.
 * - Every dynamic string is run through `escapeHtml` (no `dangerouslySet…`
 *   pattern survives into the output).
 * - No `<script>`, no inline event handlers — the unit test asserts
 *   the rendered HTML carries no `<script>` token.
 */
export function renderStatementHtml(
  statement: PayrollStatement,
  ctx: PayrollStatementRenderContext = {},
): string {
  const r = statement.result;
  const d = r.deductions;
  const insurance = insuranceSubtotal(r);
  const totalDed = totalDeductions(r);

  const headerRows: string[] = [];
  if (ctx.period) {
    headerRows.push(
      `      <div class="meta-row"><span class="meta-label">귀속 기간</span><span>${escapeHtml(
        formatPeriod(ctx.period),
      )}</span></div>`,
    );
  }
  if (ctx.employeeName) {
    headerRows.push(
      `      <div class="meta-row"><span class="meta-label">성명</span><span>${escapeHtml(
        ctx.employeeName,
      )}</span></div>`,
    );
  } else if (ctx.userId) {
    headerRows.push(
      `      <div class="meta-row"><span class="meta-label">사번</span><span>${escapeHtml(
        ctx.userId,
      )}</span></div>`,
    );
  }
  if (ctx.organizationName) {
    headerRows.push(
      `      <div class="meta-row"><span class="meta-label">소속</span><span>${escapeHtml(
        ctx.organizationName,
      )}</span></div>`,
    );
  }

  const deductionRow = (label: string, amount: number, bold = false): string => {
    const tag = bold ? "strong" : "span";
    return (
      `        <tr><td><${tag}>${escapeHtml(label)}</${tag}></td>` +
      `<td class="amount"><${tag}>${escapeHtml(formatKrw(amount))}</${tag}></td></tr>`
    );
  };

  return [
    '<article class="payroll-statement">',
    '  <header class="payroll-header">',
    "    <h1>급여명세서</h1>",
    headerRows.length > 0
      ? `    <div class="payroll-meta">\n${headerRows.join("\n")}\n    </div>`
      : "",
    "  </header>",
    '  <section class="payroll-section">',
    "    <h2>지급내역</h2>",
    "    <table>",
    "      <tbody>",
    `        <tr><td>기본급 (총지급액)</td><td class="amount">${escapeHtml(
      formatKrw(r.gross),
    )}</td></tr>`,
    "      </tbody>",
    "    </table>",
    "  </section>",
    '  <section class="payroll-section">',
    "    <h2>공제내역</h2>",
    "    <table>",
    "      <tbody>",
    deductionRow("국민연금", d.nationalPension),
    deductionRow("건강보험", d.healthInsurance),
    deductionRow("장기요양보험", d.longTermCare),
    deductionRow("고용보험", d.employmentInsurance),
    deductionRow("4대보험 소계", insurance, true),
    deductionRow("소득세", d.incomeTax),
    deductionRow("지방소득세", d.localIncomeTax),
    deductionRow("기타", d.other),
    deductionRow("공제 합계", totalDed, true),
    "      </tbody>",
    "    </table>",
    "  </section>",
    '  <section class="payroll-section payroll-net">',
    "    <h2>실수령액</h2>",
    `    <p class="net-amount"><strong>${escapeHtml(formatKrw(r.net))}</strong></p>`,
    "  </section>",
    '  <footer class="payroll-footer">',
    `    <p>적용 보험요율 연도: ${escapeHtml(String(r.metadata.insuranceRatesYear))}</p>`,
    `    <p>산출 시각: ${escapeHtml(r.metadata.calculatedAt.toISOString())}</p>`,
    statement.documentUrl
      ? `    <p>문서 URL: <a href="${escapeHtml(statement.documentUrl)}" rel="noopener noreferrer">${escapeHtml(statement.documentUrl)}</a></p>`
      : "",
    "  </footer>",
    "</article>",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

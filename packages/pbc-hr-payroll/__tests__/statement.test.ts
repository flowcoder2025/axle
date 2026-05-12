/**
 * WI-612 — markdown / HTML renderers for `PayrollStatement`.
 *
 * The renderers are pure string templates over `PayrollResult` +
 * optional context. The tests assert:
 *   - Korean labels required by the sprint contract appear.
 *   - Numeric safety: negative `other` deductions render with the
 *     correct sign (no crash, no formatting drift).
 *   - XSS safety: every dynamic value is HTML-escaped and no
 *     `<script>` token survives into the rendered HTML.
 */

import { describe, expect, it } from "vitest";
import {
  renderStatementHtml,
  renderStatementMarkdown,
  type PayrollResult,
  type PayrollStatement,
} from "../src/index.js";

function fixtureResult(overrides: Partial<PayrollResult> = {}): PayrollResult {
  return {
    gross: 3_700_000,
    deductions: {
      nationalPension: 166_500,
      healthInsurance: 131_350,
      longTermCare: 17_010,
      employmentInsurance: 33_300,
      incomeTax: 95_220,
      localIncomeTax: 9_520,
      other: 0,
      ...(overrides.deductions ?? {}),
    },
    net: 3_247_100,
    metadata: {
      insuranceRatesYear: 2026,
      calculatedAt: new Date("2026-05-15T03:00:00Z"),
    },
    ...overrides,
  };
}

function fixtureStatement(
  overrides: Partial<PayrollStatement> = {},
): PayrollStatement {
  return {
    result: fixtureResult(),
    ...overrides,
  };
}

describe("WI-612 — renderStatementMarkdown", () => {
  it("includes the Korean labels required by the sprint contract", () => {
    const md = renderStatementMarkdown(fixtureStatement());
    // contract checklist 6: "한국어 라벨('기본급', '4대보험', '실수령액')"
    expect(md).toContain("기본급");
    expect(md).toContain("4대보험");
    expect(md).toContain("실수령액");
    // section headers
    expect(md).toContain("# 급여명세서");
    expect(md).toContain("## 공제내역");
  });

  it("formats KRW values with thousand separators and the 원 suffix", () => {
    const md = renderStatementMarkdown(fixtureStatement());
    expect(md).toContain("3,700,000 원"); // gross
    expect(md).toContain("3,247,100 원"); // net
  });

  it("safely renders 0 and negative deductions without crashing", () => {
    const md = renderStatementMarkdown(
      fixtureStatement({
        result: fixtureResult({
          deductions: {
            nationalPension: 0,
            healthInsurance: 0,
            longTermCare: 0,
            employmentInsurance: 0,
            incomeTax: 0,
            localIncomeTax: 0,
            other: -50_000, // refund / negative adjustment
          },
        }),
      }),
    );
    expect(md).toContain("0 원");
    expect(md).toContain("-50,000 원");
  });

  it("includes period header when context is supplied", () => {
    const md = renderStatementMarkdown(fixtureStatement(), {
      period: { year: 2026, month: 5 },
      employeeName: "홍길동",
    });
    expect(md).toContain("2026년 05월");
    expect(md).toContain("홍길동");
  });
});

describe("WI-612 — renderStatementHtml", () => {
  it("includes the Korean labels required by the sprint contract", () => {
    const html = renderStatementHtml(fixtureStatement());
    expect(html).toContain("기본급");
    expect(html).toContain("4대보험");
    expect(html).toContain("실수령액");
    expect(html).toContain("<h1>급여명세서</h1>");
  });

  it("never emits a <script> token or inline event handler", () => {
    const html = renderStatementHtml(fixtureStatement(), {
      employeeName: "홍길동",
      organizationName: "FlowCoder",
      userId: "user_42",
      period: { year: 2026, month: 5 },
    });
    expect(html.toLowerCase()).not.toContain("<script");
    expect(html.toLowerCase()).not.toContain("javascript:");
    expect(html).not.toMatch(/\son\w+\s*=/i); // no onclick=, onerror=, etc.
  });

  it("escapes HTML-significant characters in context strings (XSS)", () => {
    const html = renderStatementHtml(fixtureStatement(), {
      employeeName: '<script>alert("xss")</script>',
      organizationName: 'Bad & "Co"',
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
    );
    expect(html).toContain("Bad &amp; &quot;Co&quot;");
  });

  it("escapes a maliciously-crafted documentUrl", () => {
    const html = renderStatementHtml(
      fixtureStatement({
        documentUrl: 'https://example.com/"><script>alert(1)</script>',
      }),
    );
    expect(html.toLowerCase()).not.toContain("<script>alert");
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
  });

  it("renders 0 and negative deductions safely (numeric edge cases)", () => {
    const html = renderStatementHtml(
      fixtureStatement({
        result: fixtureResult({
          deductions: {
            nationalPension: 0,
            healthInsurance: 0,
            longTermCare: 0,
            employmentInsurance: 0,
            incomeTax: 0,
            localIncomeTax: 0,
            other: -25_000,
          },
        }),
      }),
    );
    expect(html).toContain("0 원");
    expect(html).toContain("-25,000 원");
  });
});

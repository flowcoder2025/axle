/**
 * WI-603 — payroll calculator + 10-fixture matrix.
 *
 * The calculator covers the WI title matrix
 * (정규/계약/일용/시간제 × 일반/연장/공휴) with deterministic outputs
 * pinned in `__tests__/fixtures/payroll-2026.ts`. Tests assert both
 * **invariants** (so a future refactor that changes the rounding rule
 * but preserves the contract still passes) and **pinned values** (so a
 * silent drift in the bracket math fails loudly).
 */

import { describe, expect, it } from "vitest";
import {
  calculatePayroll,
  KOREAN_INSURANCE_RATES_2026,
  type PayrollResult,
} from "../src/index.js";
import {
  PAYROLL_FIXTURES_2026,
  type PayrollFixture,
} from "./fixtures/payroll-2026.js";

const FIXED_NOW = new Date("2026-05-15T03:00:00Z");

function runFixture(fixture: PayrollFixture): PayrollResult {
  return calculatePayroll(fixture.input, { now: FIXED_NOW });
}

describe("WI-603 — calculatePayroll covers all 10 fixture cells", () => {
  it("exposes ≥ 10 fixtures spanning the WI title matrix", () => {
    expect(PAYROLL_FIXTURES_2026.length).toBeGreaterThanOrEqual(10);
    const cells = new Set(PAYROLL_FIXTURES_2026.map((f) => f.matrixCell));
    // 4 employment types × at least 1 work type each is the minimum the
    // WI title demands; 10 fixtures spread across the matrix easily.
    expect(cells.size).toBeGreaterThanOrEqual(8);
  });

  for (const fixture of PAYROLL_FIXTURES_2026) {
    describe(fixture.name, () => {
      const result = runFixture(fixture);

      it("matches the pinned gross / deductions / net", () => {
        expect(result.gross).toBe(fixture.expected.gross);
        expect(result.deductions).toEqual(fixture.expected.deductions);
        expect(result.net).toBe(fixture.expected.net);
      });

      it("stamps metadata.insuranceRatesYear from the input period", () => {
        expect(result.metadata.insuranceRatesYear).toBe(
          fixture.expected.metadata.insuranceRatesYear,
        );
        expect(result.metadata.calculatedAt).toEqual(FIXED_NOW);
      });
    });
  }
});

describe("WI-603 — invariants that hold for every fixture", () => {
  for (const fixture of PAYROLL_FIXTURES_2026) {
    it(`net + Σ(deductions) === gross  (${fixture.name})`, () => {
      const result = runFixture(fixture);
      const sumDeductions = Object.values(result.deductions).reduce(
        (s, v) => s + v,
        0,
      );
      expect(result.net + sumDeductions).toBe(result.gross);
    });

    it(`exposes the camelCase deduction keys  (${fixture.name})`, () => {
      const result = runFixture(fixture);
      expect(Object.keys(result.deductions).sort()).toEqual(
        [
          "employmentInsurance",
          "healthInsurance",
          "incomeTax",
          "localIncomeTax",
          "longTermCare",
          "nationalPension",
          "other",
        ].sort(),
      );
    });

    it(`every deduction is a non-negative integer  (${fixture.name})`, () => {
      const result = runFixture(fixture);
      for (const v of Object.values(result.deductions)) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    });

    it(`localIncomeTax = floor(incomeTax × 0.1)  (${fixture.name})`, () => {
      const result = runFixture(fixture);
      expect(result.deductions.localIncomeTax).toBe(
        Math.floor(result.deductions.incomeTax * 0.1),
      );
    });
  }
});

describe("WI-603 — year-aware integration with insuranceRates", () => {
  it("applies the 2026 row to a 2026 period", () => {
    const result = calculatePayroll(
      {
        userId: "u",
        orgId: "o",
        period: { year: 2026, month: 1 },
        baseSalary: 3_000_000,
      },
      { now: FIXED_NOW },
    );
    // Direct multiplication against the 2026 row (no overtime / bonus /
    // allowance) — proves the calculator delegates to
    // `getInsuranceRatesForYear(2026)` and not a hardcoded constant.
    expect(result.deductions.nationalPension).toBe(
      Math.floor(3_000_000 * KOREAN_INSURANCE_RATES_2026.nationalPension),
    );
    expect(result.deductions.healthInsurance).toBe(
      Math.floor(3_000_000 * KOREAN_INSURANCE_RATES_2026.healthInsurance),
    );
    expect(result.deductions.longTermCare).toBe(
      Math.floor(3_000_000 * KOREAN_INSURANCE_RATES_2026.longTermCare),
    );
    expect(result.deductions.employmentInsurance).toBe(
      Math.floor(3_000_000 * KOREAN_INSURANCE_RATES_2026.employmentInsurance),
    );
  });

  it("falls back to the nearest year when an unknown future year is requested", () => {
    const result = calculatePayroll(
      {
        userId: "u",
        orgId: "o",
        period: { year: 2030, month: 1 },
        baseSalary: 3_000_000,
      },
      { now: FIXED_NOW },
    );
    // 2030 is unknown → the nearest-year fallback returns the 2026 row,
    // and the metadata stamps that fallback year so the consumer can
    // surface it on the payslip.
    expect(result.metadata.insuranceRatesYear).toBe(2026);
  });
});

describe("WI-603 — overtime / holiday premium math (가산임금 1.5x)", () => {
  it("applies 1.5x the ordinary hourly wage to overtime hours", () => {
    // baseline (no overtime)
    const baseline = calculatePayroll(
      {
        userId: "u",
        orgId: "o",
        period: { year: 2026, month: 5 },
        salaryType: "MONTHLY",
        baseSalary: 2_090_000, // 통상시급 = 2,090,000 / 209 = 10,000원
      },
      { now: FIXED_NOW },
    );
    // +10h overtime → premium = 10 × 10,000 × 1.5 = 150,000
    const withOvertime = calculatePayroll(
      {
        userId: "u",
        orgId: "o",
        period: { year: 2026, month: 5 },
        salaryType: "MONTHLY",
        baseSalary: 2_090_000,
        overtimeHours: 10,
      },
      { now: FIXED_NOW },
    );
    expect(withOvertime.gross - baseline.gross).toBe(150_000);
  });

  it("applies 1.5x the ordinary hourly wage to holiday hours", () => {
    const baseline = calculatePayroll(
      {
        userId: "u",
        orgId: "o",
        period: { year: 2026, month: 5 },
        salaryType: "MONTHLY",
        baseSalary: 2_090_000,
      },
      { now: FIXED_NOW },
    );
    const withHoliday = calculatePayroll(
      {
        userId: "u",
        orgId: "o",
        period: { year: 2026, month: 5 },
        salaryType: "MONTHLY",
        baseSalary: 2_090_000,
        holidayHours: 8,
      },
      { now: FIXED_NOW },
    );
    expect(withHoliday.gross - baseline.gross).toBe(120_000); // 8 × 10,000 × 1.5
  });
});

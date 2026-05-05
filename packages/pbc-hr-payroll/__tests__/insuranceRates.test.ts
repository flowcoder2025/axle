/**
 * WI-602 — 4대보험 rates 2025 / 2026 (year-aware lookup).
 *
 * Spec: docs/specs/meta-platform/pbc-hr-payroll.md §3.1, §5
 *
 * Pins:
 *   - Constants are camelCase (matches `PayrollResult.deductions`, see WI-601).
 *   - Each rate row has its own `year` so a payroll engine can record
 *     `metadata.insuranceRatesYear` from the row it actually used.
 *   - `getInsuranceRatesForYear(year)` is the single year-aware entry
 *     point — adding a new year only requires dropping a new file under
 *     `src/payroll/insuranceRates/<year>.ts` and registering it in the
 *     barrel.
 *   - Unknown years fall back to the **most recent** registered year and
 *     the metadata reflects the fallback (the calculator can stamp the
 *     fallback year onto the payslip without a separate flag).
 */

import { describe, expect, it } from "vitest";
import {
  KOREAN_INSURANCE_RATES_2025,
  KOREAN_INSURANCE_RATES_2026,
  getInsuranceRatesForYear,
  type InsuranceRates,
} from "../src/index.js";

const RATE_KEYS = [
  "nationalPension",
  "healthInsurance",
  "longTermCare",
  "employmentInsurance",
  "industrialAccident",
] as const satisfies ReadonlyArray<keyof Omit<InsuranceRates, "year">>;

describe("WI-602 — KOREAN_INSURANCE_RATES_2025 (officially confirmed values)", () => {
  it("stamps year=2025 and exposes all five rate keys", () => {
    expect(KOREAN_INSURANCE_RATES_2025.year).toBe(2025);
    for (const key of RATE_KEYS) {
      expect(KOREAN_INSURANCE_RATES_2025).toHaveProperty(key);
      expect(typeof KOREAN_INSURANCE_RATES_2025[key]).toBe("number");
    }
  });

  it("uses the published 2025 rates: NP 4.5% / Health 3.545% / LTC 0.4591%", () => {
    expect(KOREAN_INSURANCE_RATES_2025.nationalPension).toBeCloseTo(0.045, 6);
    expect(KOREAN_INSURANCE_RATES_2025.healthInsurance).toBeCloseTo(0.03545, 6);
    // Long-term care = health insurance × 12.95% (2025 장기요양보험료율).
    expect(KOREAN_INSURANCE_RATES_2025.longTermCare).toBeCloseTo(0.004591, 6);
    expect(KOREAN_INSURANCE_RATES_2025.longTermCare).toBeCloseTo(
      KOREAN_INSURANCE_RATES_2025.healthInsurance * 0.1295,
      4,
    );
  });

  it("uses the published 2025 employment insurance employee share (0.9%)", () => {
    // 실업급여 1.8% split 50/50 between employee and employer; 고용안정·
    // 직업능력개발 surcharge is employer-only and not on this row.
    expect(KOREAN_INSURANCE_RATES_2025.employmentInsurance).toBeCloseTo(0.009, 6);
  });

  it("uses the all-industry-average 산재 rate (1.47%) as the documented default", () => {
    // 산재 rate is industry-segmented and employer-paid only; we pin the
    // all-industry average so consumers without per-industry data get a
    // sensible default and `PayrollResult.deductions` (employee-side)
    // can ignore it correctly.
    expect(KOREAN_INSURANCE_RATES_2025.industrialAccident).toBeCloseTo(0.0147, 6);
  });

  it("keeps every rate within the plausible regulatory range [0, 0.05]", () => {
    for (const key of RATE_KEYS) {
      expect(KOREAN_INSURANCE_RATES_2025[key]).toBeGreaterThanOrEqual(0);
      expect(KOREAN_INSURANCE_RATES_2025[key]).toBeLessThanOrEqual(0.05);
    }
  });
});

describe("WI-602 — KOREAN_INSURANCE_RATES_2026 (forward-projected)", () => {
  it("stamps year=2026 and exposes all five rate keys", () => {
    expect(KOREAN_INSURANCE_RATES_2026.year).toBe(2026);
    for (const key of RATE_KEYS) {
      expect(KOREAN_INSURANCE_RATES_2026).toHaveProperty(key);
      expect(typeof KOREAN_INSURANCE_RATES_2026[key]).toBe("number");
    }
  });

  it("keeps every rate within the plausible regulatory range [0, 0.05]", () => {
    for (const key of RATE_KEYS) {
      expect(KOREAN_INSURANCE_RATES_2026[key]).toBeGreaterThanOrEqual(0);
      expect(KOREAN_INSURANCE_RATES_2026[key]).toBeLessThanOrEqual(0.05);
    }
  });

  it("preserves the long-term care derivation (≈ healthInsurance × 12.95%)", () => {
    // The 장기요양보험료율 has stayed at 12.95% in successive years; if
    // the 2026 row breaks this invariant a future maintainer must
    // re-derive it explicitly (and update this test).
    expect(KOREAN_INSURANCE_RATES_2026.longTermCare).toBeCloseTo(
      KOREAN_INSURANCE_RATES_2026.healthInsurance * 0.1295,
      4,
    );
  });
});

describe("WI-602 — getInsuranceRatesForYear (year-aware lookup)", () => {
  it("returns the 2025 row for year=2025", () => {
    const rates = getInsuranceRatesForYear(2025);
    expect(rates.year).toBe(2025);
    expect(rates).toEqual(KOREAN_INSURANCE_RATES_2025);
  });

  it("returns the 2026 row for year=2026", () => {
    const rates = getInsuranceRatesForYear(2026);
    expect(rates.year).toBe(2026);
    expect(rates).toEqual(KOREAN_INSURANCE_RATES_2026);
  });

  it("falls back to the most recent registered year for an unknown future year", () => {
    // Adding a 2027 file should make this test fail and force the
    // maintainer to either bump the expected fallback or extend coverage.
    const rates = getInsuranceRatesForYear(2030);
    expect(rates.year).toBe(2026);
    expect(rates).toEqual(KOREAN_INSURANCE_RATES_2026);
  });

  it("falls back to the earliest registered year for a year before coverage", () => {
    // A pre-2025 lookup is almost certainly a bug in the caller; we
    // return the earliest known row rather than throw so a payslip can
    // still be issued, and the caller can detect the mismatch via
    // `metadata.insuranceRatesYear`.
    const rates = getInsuranceRatesForYear(2020);
    expect(rates.year).toBe(2025);
    expect(rates).toEqual(KOREAN_INSURANCE_RATES_2025);
  });

  it("rejects non-integer / non-finite years", () => {
    expect(() => getInsuranceRatesForYear(Number.NaN)).toThrow(/year/i);
    expect(() => getInsuranceRatesForYear(Number.POSITIVE_INFINITY)).toThrow(/year/i);
    expect(() => getInsuranceRatesForYear(2025.5)).toThrow(/year/i);
  });

  it("returns the same reference each call (rates are immutable singletons)", () => {
    expect(getInsuranceRatesForYear(2025)).toBe(KOREAN_INSURANCE_RATES_2025);
    expect(getInsuranceRatesForYear(2026)).toBe(KOREAN_INSURANCE_RATES_2026);
  });
});

describe("WI-602 — applying rates against a sample payroll preserves the camelCase contract", () => {
  it("computes employee deductions via `gross * rates[key]` for every rate", () => {
    // The TARGET pin from WI-601: rate keys map 1:1 onto the four
    // employee-paid `PayrollResult.deductions` slots. This test exercises
    // that mapping end-to-end so a rename on either side breaks here.
    // Rounding (not flooring) sidesteps IEEE-754 noise on rates like
    // 0.009 × 3,000,000 == 26999.999...; production code will use the
    // 원 단위 절사 rule from `payroll/calculate.ts` (WI-603) — this
    // test is about the key contract, not the rounding rule.
    const gross = 3_000_000;
    const rates = KOREAN_INSURANCE_RATES_2025;
    const employeeDeductions = {
      nationalPension: Math.round(gross * rates.nationalPension),
      healthInsurance: Math.round(gross * rates.healthInsurance),
      longTermCare: Math.round(gross * rates.longTermCare),
      employmentInsurance: Math.round(gross * rates.employmentInsurance),
    };

    expect(employeeDeductions.nationalPension).toBe(135_000);
    expect(employeeDeductions.healthInsurance).toBe(106_350);
    expect(employeeDeductions.longTermCare).toBe(13_773);
    expect(employeeDeductions.employmentInsurance).toBe(27_000);
  });
});

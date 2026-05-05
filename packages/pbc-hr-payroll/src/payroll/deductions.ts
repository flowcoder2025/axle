/**
 * Deduction primitives shared by `calculate.ts` (WI-603).
 *
 * Two responsibilities:
 *
 *   1. `calculateInsuranceDeductions` — multiplies gross by the
 *      year-aware `InsuranceRates` row and floors each result to the
 *      원 단위 절사 convention used on Korean payslips.
 *
 *   2. `calculateMonthlyIncomeTax` — a deliberately **simplified**
 *      replacement for the 간이세액표 (monthly withholding) lookup. The
 *      table itself is thousands of rows keyed by `(monthly_taxable,
 *      dependents)` and ships with the National Tax Service every year;
 *      a per-WI shipment of the full table is out of scope here.
 *
 * The simplification:
 *
 *   annual_taxable = monthly_taxable × 12
 *   employment_deduction = min(annual_taxable × 0.30, 14_750_000)   // 근로소득공제 ≈ table cap
 *   personal_deduction   = 1_500_000                                 // 본인 인적공제만 (부양가족 미적용)
 *   tax_base = max(0, annual_taxable − employment_deduction − personal_deduction)
 *   annual_tax = bracket(tax_base)                                   // 종합소득세 누진세
 *   tax_credit = min(annual_tax × 0.55, 740_000)                     // 근로소득세액공제
 *   monthly_withholding = floor(max(0, annual_tax − tax_credit) / 12)
 *
 * The bracket constants match the 종합소득세 brackets in force for
 * earnings paid in calendar year 2026 (no scheduled change vs 2025).
 *
 * Real-world callers must replace this with a full 간이세액표 lookup
 * (WI-610 docs lists this as a follow-up); the simplified function ships
 * here so WI-603 has a self-contained, fixture-pinned baseline that
 * exercises the full payroll pipeline end-to-end.
 */

import type { InsuranceRates } from "../types.js";

export interface InsuranceDeductionBreakdown {
  nationalPension: number;
  healthInsurance: number;
  longTermCare: number;
  employmentInsurance: number;
}

/**
 * Returns the **employee-paid** 4대보험 deductions for a given gross.
 * Each component is `floor(gross × rate)` (원 단위 절사). 산재 is
 * employer-only and is omitted from the breakdown.
 */
export function calculateInsuranceDeductions(
  gross: number,
  rates: InsuranceRates,
): InsuranceDeductionBreakdown {
  return {
    nationalPension: Math.floor(gross * rates.nationalPension),
    healthInsurance: Math.floor(gross * rates.healthInsurance),
    longTermCare: Math.floor(gross * rates.longTermCare),
    employmentInsurance: Math.floor(gross * rates.employmentInsurance),
  };
}

/**
 * Simplified 간이세액표 stand-in. See file header for the formula and
 * the limits of this approximation.
 */
export function calculateMonthlyIncomeTax(monthlyTaxable: number): number {
  if (monthlyTaxable <= 0) return 0;

  const annualTaxable = monthlyTaxable * 12;

  const employmentDeduction = Math.min(annualTaxable * 0.3, 14_750_000);
  const personalDeduction = 1_500_000;
  const taxBase = Math.max(
    0,
    annualTaxable - employmentDeduction - personalDeduction,
  );

  let annualTax: number;
  if (taxBase <= 14_000_000) {
    annualTax = taxBase * 0.06;
  } else if (taxBase <= 50_000_000) {
    annualTax = taxBase * 0.15 - 1_260_000;
  } else if (taxBase <= 88_000_000) {
    annualTax = taxBase * 0.24 - 5_760_000;
  } else if (taxBase <= 150_000_000) {
    annualTax = taxBase * 0.35 - 15_440_000;
  } else if (taxBase <= 300_000_000) {
    annualTax = taxBase * 0.38 - 19_940_000;
  } else if (taxBase <= 500_000_000) {
    annualTax = taxBase * 0.4 - 25_940_000;
  } else if (taxBase <= 1_000_000_000) {
    annualTax = taxBase * 0.42 - 35_940_000;
  } else {
    annualTax = taxBase * 0.45 - 65_940_000;
  }

  const taxCredit = Math.min(annualTax * 0.55, 740_000);
  const annualWithholding = Math.max(0, annualTax - taxCredit);

  return Math.floor(annualWithholding / 12);
}

/**
 * 통상시급 — ordinary hourly wage used to multiply premium hours.
 *
 *   - MONTHLY: `baseSalary / 209` (Korean 월 소정근로시간:
 *     주 40h × 52w / 12m + 주휴 35.67 ≈ 209).
 *   - HOURLY:  prefer the explicit `hourlyRate`; fall back to nothing
 *     (caller is on the hook).
 *   - DAILY:   `hourlyRate` if provided, else `baseSalary / 209` (same
 *     rule of thumb when the dailyRate isn't broken out).
 */
export function computeOrdinaryHourlyWage(
  baseSalary: number,
  salaryType: "MONTHLY" | "HOURLY" | "DAILY",
  hourlyRate?: number,
): number {
  if (hourlyRate && hourlyRate > 0) return hourlyRate;
  if (salaryType === "MONTHLY") return baseSalary / 209;
  // HOURLY/DAILY without an explicit hourlyRate falls back to the
  // monthly-equivalent divisor — better than 0 so a downstream multiply
  // doesn't silently zero out premium pay.
  return baseSalary / 209;
}

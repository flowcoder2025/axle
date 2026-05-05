/**
 * `calculatePayroll` — synchronous, deterministic payroll computation
 * used by every fixture in `__tests__/fixtures/payroll-2026.ts`.
 *
 * Pipeline:
 *
 *   1. Resolve the `InsuranceRates` row for `input.period.year` via
 *      `getInsuranceRatesForYear` (year-aware; nearest-known fallback).
 *   2. Compute 가산임금 (premium pay) for overtime / holiday hours
 *      using 통상시급 × 1.5 (Korean Labor Standards Act §56).
 *   3. Sum gross = base + premium + bonus + allowances.
 *   4. Compute 4대보험 employee deductions (`floor(gross × rate)`).
 *   5. Compute 소득세 / 지방소득세 via the simplified bracket
 *      approximation in `deductions.ts` (간이세액표 lookup is a
 *      WI-610 follow-up).
 *   6. Stamp `metadata.insuranceRatesYear` from the row that was
 *      actually used (surfaces the year-fallback to the consumer).
 *
 * The function is synchronous internally; the `PayrollService.calculate`
 * surface returns `Promise<PayrollResult>`, so a thin async wrapper
 * lives in WI-607's service factory rather than here.
 */

import { getInsuranceRatesForYear } from "./insuranceRates/index.js";
import {
  calculateInsuranceDeductions,
  calculateMonthlyIncomeTax,
  computeOrdinaryHourlyWage,
} from "./deductions.js";
import type { PayrollInput, PayrollResult } from "../types.js";

export interface CalculatePayrollOptions {
  /** Override `metadata.calculatedAt` — used by tests to pin the wall clock. */
  now?: Date;
}

export function calculatePayroll(
  input: PayrollInput,
  options?: CalculatePayrollOptions,
): PayrollResult {
  const rates = getInsuranceRatesForYear(input.period.year);
  const salaryType = input.salaryType ?? "MONTHLY";

  const ordinaryHourlyWage = computeOrdinaryHourlyWage(
    input.baseSalary,
    salaryType,
    input.hourlyRate,
  );

  const overtimeHours = input.overtimeHours ?? 0;
  const holidayHours = input.holidayHours ?? 0;
  const overtimePay = overtimeHours * ordinaryHourlyWage * 1.5;
  const holidayPay = holidayHours * ordinaryHourlyWage * 1.5;

  const allowanceTotal = (input.allowances ?? []).reduce(
    (sum, a) => sum + a.amount,
    0,
  );

  const gross = Math.round(
    input.baseSalary +
      overtimePay +
      holidayPay +
      (input.bonus ?? 0) +
      allowanceTotal,
  );

  const insurance = calculateInsuranceDeductions(gross, rates);

  const insuranceTotal =
    insurance.nationalPension +
    insurance.healthInsurance +
    insurance.longTermCare +
    insurance.employmentInsurance;
  const taxableIncome = Math.max(0, gross - insuranceTotal);

  const incomeTax = calculateMonthlyIncomeTax(taxableIncome);
  const localIncomeTax = Math.floor(incomeTax * 0.1);
  const other = 0;

  const totalDeductions = insuranceTotal + incomeTax + localIncomeTax + other;
  const net = gross - totalDeductions;

  return {
    gross,
    deductions: {
      ...insurance,
      incomeTax,
      localIncomeTax,
      other,
    },
    net,
    metadata: {
      insuranceRatesYear: rates.year,
      calculatedAt: options?.now ?? new Date(),
    },
  };
}

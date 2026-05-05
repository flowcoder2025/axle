/**
 * WI-603 — payroll regression fixtures (calendar year 2026).
 *
 * Ten scenarios cover the WI title matrix:
 *
 *   employment ∈ { FULL_TIME, CONTRACT, DAILY, PART_TIME }
 *      ×
 *   work     ∈ { 일반근로, 연장근로(overtime), 공휴근로(holiday) }
 *
 * Each fixture pins the **employee-paid** payroll outcome:
 *   - `gross` is the full additive total (base + premium + bonus +
 *     allowances) before any deduction.
 *   - `deductions.*` follow the Korean 4대보험 employee share for the
 *     calendar year of `input.period.year` (driven by
 *     `getInsuranceRatesForYear`).
 *   - `incomeTax` uses the simplified bracket-based approximation
 *     described in `src/payroll/deductions.ts` — exact only against the
 *     calculator that ships in this WI; the 간이세액표 lookup is a
 *     follow-up (see WI-610). The fixtures pin the approximation so a
 *     drift in either the brackets or the rounding rule fails loudly.
 *   - `net = gross − Σ(deductions)` (invariant, rechecked in tests).
 *
 * The fixtures are pinned **for 2026 rates only**; if the 2026 rate
 * row in `src/payroll/insuranceRates/2026.ts` is updated this file
 * must be regenerated. That coupling is intentional — the WI title
 * mandates "fixture만 갱신하면 되는 구조".
 */

import type { PayrollInput, PayrollResult } from "../../src/types.js";

export interface PayrollFixture {
  /** Human-readable scenario label (used as the test name). */
  name: string;
  /** Brief Korean tag for the matrix cell (employment × work). */
  matrixCell: string;
  input: PayrollInput;
  /** Expected `PayrollResult` minus the wall-clock `metadata.calculatedAt`. */
  expected: Omit<PayrollResult, "metadata"> & {
    metadata: { insuranceRatesYear: number };
  };
}

const PERIOD_2026 = { year: 2026, month: 5 } as const;

export const PAYROLL_FIXTURES_2026: readonly PayrollFixture[] = [
  // ── FULL_TIME × {일반, 연장, 공휴} ────────────────────────────────
  {
    name: "FULL_TIME / 일반근로 — 월급 3,500,000",
    matrixCell: "정규직 × 일반",
    input: {
      userId: "user_ft_regular",
      orgId: "org_test",
      period: PERIOD_2026,
      employmentType: "FULL_TIME",
      salaryType: "MONTHLY",
      baseSalary: 3_500_000,
    },
    expected: {
      gross: 3_500_000,
      deductions: {
        nationalPension: 157_500,
        healthInsurance: 124_075,
        longTermCare: 16_068,
        employmentInsurance: 31_499,
        incomeTax: 147_523,
        localIncomeTax: 14_752,
        other: 0,
      },
      net: 3_008_583,
      metadata: { insuranceRatesYear: 2026 },
    },
  },
  {
    name: "FULL_TIME / 연장근로 — 월급 3,500,000 + 연장 20h",
    matrixCell: "정규직 × 연장",
    input: {
      userId: "user_ft_overtime",
      orgId: "org_test",
      period: PERIOD_2026,
      employmentType: "FULL_TIME",
      salaryType: "MONTHLY",
      baseSalary: 3_500_000,
      overtimeHours: 20,
    },
    expected: {
      gross: 4_002_392,
      deductions: {
        nationalPension: 180_107,
        healthInsurance: 141_884,
        longTermCare: 18_374,
        employmentInsurance: 36_021,
        incomeTax: 195_313,
        localIncomeTax: 19_531,
        other: 0,
      },
      net: 3_411_162,
      metadata: { insuranceRatesYear: 2026 },
    },
  },
  {
    name: "FULL_TIME / 공휴근로 — 월급 3,500,000 + 공휴 8h",
    matrixCell: "정규직 × 공휴",
    input: {
      userId: "user_ft_holiday",
      orgId: "org_test",
      period: PERIOD_2026,
      employmentType: "FULL_TIME",
      salaryType: "MONTHLY",
      baseSalary: 3_500_000,
      holidayHours: 8,
    },
    expected: {
      gross: 3_700_957,
      deductions: {
        nationalPension: 166_543,
        healthInsurance: 131_198,
        longTermCare: 16_991,
        employmentInsurance: 33_308,
        incomeTax: 166_639,
        localIncomeTax: 16_663,
        other: 0,
      },
      net: 3_169_615,
      metadata: { insuranceRatesYear: 2026 },
    },
  },

  // ── CONTRACT × {일반, 연장} ───────────────────────────────────────
  {
    name: "CONTRACT / 일반근로 — 월급 3,000,000",
    matrixCell: "계약직 × 일반",
    input: {
      userId: "user_ct_regular",
      orgId: "org_test",
      period: PERIOD_2026,
      employmentType: "CONTRACT",
      salaryType: "MONTHLY",
      baseSalary: 3_000_000,
    },
    expected: {
      gross: 3_000_000,
      deductions: {
        nationalPension: 135_000,
        healthInsurance: 106_350,
        longTermCare: 13_772,
        employmentInsurance: 26_999,
        incomeTax: 99_960,
        localIncomeTax: 9_996,
        other: 0,
      },
      net: 2_607_923,
      metadata: { insuranceRatesYear: 2026 },
    },
  },
  {
    name: "CONTRACT / 연장근로 — 월급 3,000,000 + 연장 15h + 식대 100k",
    matrixCell: "계약직 × 연장",
    input: {
      userId: "user_ct_overtime",
      orgId: "org_test",
      period: PERIOD_2026,
      employmentType: "CONTRACT",
      salaryType: "MONTHLY",
      baseSalary: 3_000_000,
      overtimeHours: 15,
      allowances: [{ type: "meals", amount: 100_000 }],
    },
    expected: {
      gross: 3_422_967,
      deductions: {
        nationalPension: 154_033,
        healthInsurance: 121_344,
        longTermCare: 15_714,
        employmentInsurance: 30_806,
        incomeTax: 140_195,
        localIncomeTax: 14_019,
        other: 0,
      },
      net: 2_946_856,
      metadata: { insuranceRatesYear: 2026 },
    },
  },

  // ── DAILY × {일반, 연장} ──────────────────────────────────────────
  {
    name: "DAILY / 일반근로 — 일급 150,000 × 22일",
    matrixCell: "일용직 × 일반",
    input: {
      userId: "user_dl_regular",
      orgId: "org_test",
      period: PERIOD_2026,
      employmentType: "DAILY",
      salaryType: "DAILY",
      baseSalary: 3_300_000, // 150,000 × 22 days
      hourlyRate: 18_750, // 150,000 / 8h
    },
    expected: {
      gross: 3_300_000,
      deductions: {
        nationalPension: 148_500,
        healthInsurance: 116_985,
        longTermCare: 15_150,
        employmentInsurance: 29_699,
        incomeTax: 128_498,
        localIncomeTax: 12_849,
        other: 0,
      },
      net: 2_848_319,
      metadata: { insuranceRatesYear: 2026 },
    },
  },
  {
    name: "DAILY / 연장근로 — 일급 150,000 × 22일 + 연장 10h",
    matrixCell: "일용직 × 연장",
    input: {
      userId: "user_dl_overtime",
      orgId: "org_test",
      period: PERIOD_2026,
      employmentType: "DAILY",
      salaryType: "DAILY",
      baseSalary: 3_300_000,
      hourlyRate: 18_750,
      overtimeHours: 10,
    },
    expected: {
      gross: 3_581_250,
      deductions: {
        nationalPension: 161_156,
        healthInsurance: 126_955,
        longTermCare: 16_441,
        employmentInsurance: 32_231,
        incomeTax: 155_252,
        localIncomeTax: 15_525,
        other: 0,
      },
      net: 3_073_690,
      metadata: { insuranceRatesYear: 2026 },
    },
  },

  // ── PART_TIME × {일반, 연장, 공휴} ────────────────────────────────
  {
    name: "PART_TIME / 일반근로 — 시급 12,000 × 80h",
    matrixCell: "시간제 × 일반",
    input: {
      userId: "user_pt_regular",
      orgId: "org_test",
      period: PERIOD_2026,
      employmentType: "PART_TIME",
      salaryType: "HOURLY",
      baseSalary: 960_000, // 12,000 × 80
      hourlyRate: 12_000,
    },
    expected: {
      gross: 960_000,
      deductions: {
        nationalPension: 43_200,
        healthInsurance: 34_032,
        longTermCare: 4_407,
        employmentInsurance: 8_640,
        incomeTax: 13_062,
        localIncomeTax: 1_306,
        other: 0,
      },
      net: 855_353,
      metadata: { insuranceRatesYear: 2026 },
    },
  },
  {
    name: "PART_TIME / 연장근로 — 시급 12,000 × 80h + 연장 5h",
    matrixCell: "시간제 × 연장",
    input: {
      userId: "user_pt_overtime",
      orgId: "org_test",
      period: PERIOD_2026,
      employmentType: "PART_TIME",
      salaryType: "HOURLY",
      baseSalary: 960_000,
      hourlyRate: 12_000,
      overtimeHours: 5,
    },
    expected: {
      gross: 1_050_000,
      deductions: {
        nationalPension: 47_250,
        healthInsurance: 37_222,
        longTermCare: 4_820,
        employmentInsurance: 9_450,
        incomeTax: 14_603,
        localIncomeTax: 1_460,
        other: 0,
      },
      net: 935_195,
      metadata: { insuranceRatesYear: 2026 },
    },
  },
  {
    name: "PART_TIME / 공휴근로 — 시급 12,000 × 80h + 공휴 8h",
    matrixCell: "시간제 × 공휴",
    input: {
      userId: "user_pt_holiday",
      orgId: "org_test",
      period: PERIOD_2026,
      employmentType: "PART_TIME",
      salaryType: "HOURLY",
      baseSalary: 960_000,
      hourlyRate: 12_000,
      holidayHours: 8,
    },
    expected: {
      gross: 1_104_000,
      deductions: {
        nationalPension: 49_680,
        healthInsurance: 39_136,
        longTermCare: 5_068,
        employmentInsurance: 9_936,
        incomeTax: 15_528,
        localIncomeTax: 1_552,
        other: 0,
      },
      net: 983_100,
      metadata: { insuranceRatesYear: 2026 },
    },
  },
] as const;

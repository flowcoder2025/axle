/**
 * WI-601 — `@axle/pbc-hr-payroll` skeleton + types.ts contract.
 *
 * The package ships only the type contract in this WI so dependent apps
 * (FlowTeams) can declare their dependency against the public surface
 * before the per-domain implementations land in WI-602..WI-606.
 *
 * Spec: docs/specs/meta-platform/pbc-hr-payroll.md §3.1
 *
 * The TARGET line for WI-601 explicitly calls out "camelCase
 * InsuranceRates" — the spec's own §3.1 comment ("키 컨벤션:
 * PayrollResult.deductions와 일치하는 camelCase 사용") pins this. The
 * tests below freeze the camelCase keys on both `InsuranceRates` and the
 * `PayrollResult.deductions` shape so a future renamer touches both
 * sides intentionally.
 */

import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_METHODS,
  ATTENDANCE_STATUSES,
  EMPLOYMENT_TYPES,
  LEAVE_STATUSES,
  LEAVE_TYPES,
  PAYROLL_STATUSES,
  SALARY_TYPES,
  type AttendanceMethod,
  type AttendanceRecord,
  type AttendanceService,
  type AttendanceSummary,
  type EmploymentType,
  type InsuranceRates,
  type LeaveBalance,
  type LeaveRequestInput,
  type LeaveService,
  type LeaveType,
  type NomuConsultationService,
  type PayrollInput,
  type PayrollResult,
  type PayrollService,
  type PayrollStatement,
  type SalaryType,
  type YearMonth,
} from "../src/index.js";

describe("pbc-hr-payroll type contract (WI-601)", () => {
  it("declares the four employment types from spec §3.1", () => {
    expect(EMPLOYMENT_TYPES).toHaveLength(4);
    expect(EMPLOYMENT_TYPES).toEqual(["FULL_TIME", "CONTRACT", "DAILY", "PART_TIME"]);
  });

  it("declares the three salary types", () => {
    expect(SALARY_TYPES).toEqual(["MONTHLY", "HOURLY", "DAILY"]);
  });

  it("declares the four attendance methods (QR / IP / GPS / MANUAL)", () => {
    expect(ATTENDANCE_METHODS).toEqual(["QR", "IP", "GPS", "MANUAL"]);
  });

  it("declares the four attendance statuses", () => {
    expect(ATTENDANCE_STATUSES).toEqual(["NORMAL", "LATE", "EARLY_LEAVE", "ABSENT"]);
  });

  it("declares the six leave types from spec §3.1", () => {
    expect(LEAVE_TYPES).toEqual([
      "ANNUAL",
      "SICK",
      "CONDOLENCE",
      "MATERNITY",
      "PATERNITY",
      "OTHER",
    ]);
  });

  it("declares the leave + payroll workflow statuses", () => {
    expect(LEAVE_STATUSES).toEqual(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);
    expect(PAYROLL_STATUSES).toEqual(["DRAFT", "CALCULATED", "PAID", "CANCELLED"]);
  });
});

describe("WI-601 — InsuranceRates is camelCase + matches deductions keys", () => {
  it("InsuranceRates accepts the canonical 5 camelCase rate keys", () => {
    const rates: InsuranceRates = {
      year: 2026,
      nationalPension: 0.045,
      healthInsurance: 0.0354,
      longTermCare: 0.004591,
      employmentInsurance: 0.009,
      industrialAccident: 0.007,
    };
    expect(rates.year).toBe(2026);
    expect(rates.nationalPension).toBeCloseTo(0.045);
  });

  it("PayrollResult.deductions uses the same camelCase rate keys (TARGET pin)", () => {
    const result: PayrollResult = {
      gross: 3_000_000,
      deductions: {
        nationalPension: 135_000,
        healthInsurance: 106_200,
        longTermCare: 13_770,
        employmentInsurance: 27_000,
        incomeTax: 89_500,
        localIncomeTax: 8_950,
        other: 0,
      },
      net: 2_619_580,
      metadata: {
        insuranceRatesYear: 2026,
        calculatedAt: new Date("2026-05-05T00:00:00Z"),
      },
    };

    // Cross-check: the rate keys in InsuranceRates appear in deductions
    // (incomeTax + localIncomeTax + other are tax-only and live only on
    // the deductions side).
    const insuranceRateKeys: Array<keyof Omit<InsuranceRates, "year" | "industrialAccident">> = [
      "nationalPension",
      "healthInsurance",
      "longTermCare",
      "employmentInsurance",
    ];
    for (const key of insuranceRateKeys) {
      expect(result.deductions).toHaveProperty(key);
    }
    expect(result.deductions.incomeTax + result.deductions.localIncomeTax).toBeCloseTo(98_450);
  });

  it("rejects the snake_case form at the type level (regression for the TARGET note)", () => {
    // The `as` cast lets us write a snake_case object and then assert that
    // accessing a snake_case key on `InsuranceRates` is a type error —
    // proves the pin holds without flooding tsc with multi-property errors.
    const snakeBag = {
      year: 2026,
      national_pension: 0.045,
    } as unknown as InsuranceRates;
    // @ts-expect-error — `national_pension` is not a key of InsuranceRates
    const value: number = snakeBag.national_pension;
    // Use the runtime read so the cast cannot be tree-shaken away.
    expect(value).toBeCloseTo(0.045);
    expect(snakeBag.nationalPension).toBeUndefined();
  });
});

describe("WI-601 — Payroll / Attendance / Leave domain shapes", () => {
  it("PayrollInput accepts the documented optional fields", () => {
    const input: PayrollInput = {
      userId: "user_1",
      orgId: "org_1",
      period: { year: 2026, month: 5 } satisfies YearMonth,
      baseSalary: 3_000_000,
      overtimeHours: 12,
      bonus: 200_000,
      allowances: [
        { type: "transportation", amount: 100_000 },
        { type: "meals", amount: 100_000 },
      ],
    };
    expect(input.allowances).toHaveLength(2);
    expect(input.period.month).toBe(5);
  });

  it("PayrollStatement bundles the result with an optional document URL", () => {
    const statement: PayrollStatement = {
      result: {
        gross: 1,
        deductions: {
          nationalPension: 0,
          healthInsurance: 0,
          longTermCare: 0,
          employmentInsurance: 0,
          incomeTax: 0,
          localIncomeTax: 0,
          other: 0,
        },
        net: 1,
        metadata: { insuranceRatesYear: 2026, calculatedAt: new Date() },
      },
      documentUrl: "https://example.invalid/payslip.pdf",
    };
    expect(statement.documentUrl).toContain("payslip");
  });

  it("AttendanceRecord uses the documented method + status enums", () => {
    const record: AttendanceRecord = {
      id: "att_1",
      userId: "user_1",
      checkInAt: new Date(),
      method: "QR" satisfies AttendanceMethod,
      status: "NORMAL",
    };
    expect(ATTENDANCE_METHODS).toContain(record.method);
  });

  it("AttendanceSummary aggregates the period stats", () => {
    const summary: AttendanceSummary = {
      period: { year: 2026, month: 5 },
      workDays: 22,
      totalHours: 176,
      overtimeHours: 12,
      lateCount: 1,
      absentCount: 0,
    };
    expect(summary.workDays).toBe(22);
  });

  it("LeaveRequestInput + LeaveBalance follow the spec shape", () => {
    const req: LeaveRequestInput = {
      userId: "user_1",
      type: "ANNUAL" satisfies LeaveType,
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-03"),
      reason: "family vacation",
    };
    const balance: LeaveBalance = {
      userId: "user_1",
      year: 2026,
      granted: 15,
      used: 3,
      remaining: 12,
      byType: {
        ANNUAL: 3,
        SICK: 0,
        CONDOLENCE: 0,
        MATERNITY: 0,
        PATERNITY: 0,
        OTHER: 0,
      },
    };
    expect(req.type).toBe("ANNUAL");
    expect(balance.byType.ANNUAL).toBe(3);
  });
});

describe("WI-601 — service interfaces forward-declared", () => {
  it("PayrollService / AttendanceService / LeaveService / NomuConsultationService are structural", () => {
    const payroll: PayrollService = {
      calculate: async () => ({
        gross: 0,
        deductions: {
          nationalPension: 0,
          healthInsurance: 0,
          longTermCare: 0,
          employmentInsurance: 0,
          incomeTax: 0,
          localIncomeTax: 0,
          other: 0,
        },
        net: 0,
        metadata: { insuranceRatesYear: 2026, calculatedAt: new Date() },
      }),
      generateStatement: async () => ({
        result: {
          gross: 0,
          deductions: {
            nationalPension: 0,
            healthInsurance: 0,
            longTermCare: 0,
            employmentInsurance: 0,
            incomeTax: 0,
            localIncomeTax: 0,
            other: 0,
          },
          net: 0,
          metadata: { insuranceRatesYear: 2026, calculatedAt: new Date() },
        },
      }),
    };
    const attendance: AttendanceService = {
      recordCheckIn: async ({ userId, method }) => ({
        id: "stub",
        userId,
        checkInAt: new Date(),
        method,
        status: "NORMAL",
      }),
      recordCheckOut: async ({ userId }) => ({
        id: "stub",
        userId,
        checkInAt: new Date(),
        method: "MANUAL",
        status: "NORMAL",
      }),
      summarize: async ({ period }) => ({
        period,
        workDays: 0,
        totalHours: 0,
        overtimeHours: 0,
        lateCount: 0,
        absentCount: 0,
      }),
    };
    const leave: LeaveService = {
      request: async () => ({ id: "stub", status: "PENDING" }),
      approve: async () => undefined,
      reject: async () => undefined,
      balance: async ({ userId, year }) => ({
        userId,
        year,
        granted: 0,
        used: 0,
        remaining: 0,
        byType: {
          ANNUAL: 0,
          SICK: 0,
          CONDOLENCE: 0,
          MATERNITY: 0,
          PATERNITY: 0,
          OTHER: 0,
        },
      }),
    };
    const nomu: NomuConsultationService = {
      ask: async () => ({ id: "stub", answer: "stub" }),
      validate: async () => ({ valid: true }),
    };

    expect(typeof payroll.calculate).toBe("function");
    expect(typeof attendance.recordCheckIn).toBe("function");
    expect(typeof leave.request).toBe("function");
    expect(typeof nomu.ask).toBe("function");
  });
});

describe("WI-601 — narrow union types compile against the constants", () => {
  it("EmploymentType / SalaryType narrow to the constant tuples", () => {
    const fullTime: EmploymentType = "FULL_TIME";
    const monthly: SalaryType = "MONTHLY";
    expect(EMPLOYMENT_TYPES).toContain(fullTime);
    expect(SALARY_TYPES).toContain(monthly);
  });
});

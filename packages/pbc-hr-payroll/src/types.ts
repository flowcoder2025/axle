/**
 * `@axle/pbc-hr-payroll` — public type contract.
 *
 * Generalizes FlowTeams' HR / payroll / attendance / leave / labor-advisory
 * domain into a render-target-agnostic PBC. WI-601 ships ONLY the type
 * surface so dependent apps (FlowTeams) can declare their dependency
 * against the contract before the per-domain implementations land:
 *
 *   - WI-602 — 4-major-insurance rates 2025/2026 + units
 *   - WI-603 — payroll calculation + 10-fixture regression
 *   - WI-604 — attendance service (QR/IP/GPS/MANUAL methods)
 *   - WI-605 — leave service + balance accounting
 *   - WI-606 — labor-advisory consultation interface
 *
 * Spec: docs/specs/meta-platform/pbc-hr-payroll.md §3.1
 *
 * **camelCase pin (WI-601 TARGET):** the 4-major-insurance rate keys on
 * `InsuranceRates` and the `PayrollResult.deductions` shape both use
 * `nationalPension`, `healthInsurance`, `longTermCare`,
 * `employmentInsurance` (camelCase). The spec's §3.1 comment ("키
 * 컨벤션: PayrollResult.deductions와 일치하는 camelCase 사용") pins this
 * — a future renamer must touch both sides intentionally.
 */

/* ------------------------------------------------------------------ */
/* Enum constants                                                      */
/* ------------------------------------------------------------------ */

export const EMPLOYMENT_TYPES = [
  "FULL_TIME",
  "CONTRACT",
  "DAILY",
  "PART_TIME",
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const SALARY_TYPES = ["MONTHLY", "HOURLY", "DAILY"] as const;
export type SalaryType = (typeof SALARY_TYPES)[number];

export const ATTENDANCE_METHODS = ["QR", "IP", "GPS", "MANUAL"] as const;
export type AttendanceMethod = (typeof ATTENDANCE_METHODS)[number];

export const ATTENDANCE_STATUSES = [
  "NORMAL",
  "LATE",
  "EARLY_LEAVE",
  "ABSENT",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const LEAVE_TYPES = [
  "ANNUAL",
  "SICK",
  "CONDOLENCE",
  "MATERNITY",
  "PATERNITY",
  "OTHER",
] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

/**
 * Leave workflow statuses. `CANCELLED` is the explicit terminal for a
 * worker who withdraws before approval — distinct from `REJECTED`.
 */
export const LEAVE_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

/**
 * Payroll workflow statuses. `DRAFT` covers an in-progress calculation;
 * `CALCULATED` is reviewable; `PAID` is post-disbursement; `CANCELLED`
 * voids a calculation that should not have been issued.
 */
export const PAYROLL_STATUSES = [
  "DRAFT",
  "CALCULATED",
  "PAID",
  "CANCELLED",
] as const;
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number];

/* ------------------------------------------------------------------ */
/* Period helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Calendar-month period used by every aggregation API
 * (`AttendanceSummary.period`, `PayrollInput.period`, `LeaveBalance.year`).
 * Month is 1..12 to match human convention; consumers do `new Date(year,
 * month - 1, 1)` when producing JS Date objects.
 */
export interface YearMonth {
  year: number;
  month: number;
}

/* ------------------------------------------------------------------ */
/* Payroll                                                             */
/* ------------------------------------------------------------------ */

export interface PayrollInput {
  userId: string;
  orgId: string;
  period: YearMonth;
  /** Base monthly salary (or hourly × hours) before deductions. */
  baseSalary: number;
  overtimeHours?: number;
  bonus?: number;
  /**
   * Free-form allowances (transportation / meals / etc.). Each entry is
   * additive on top of `baseSalary` for the gross calculation.
   */
  allowances?: Array<{ type: string; amount: number }>;

  /**
   * Optional WI-603 fields used by `calculatePayroll` to derive the
   * 가산임금 (overtime / holiday premium). They stay optional so the
   * WI-601 type contract is unchanged for consumers that only ship the
   * monthly base salary.
   */
  employmentType?: EmploymentType;
  salaryType?: SalaryType;
  /**
   * 통상시급 (ordinary hourly wage). Required for HOURLY/DAILY salary
   * types when premium hours are present; ignored for MONTHLY (the
   * calculator derives 통상시급 = baseSalary / 209 — Korean standard
   * 월 소정근로시간).
   */
  hourlyRate?: number;
  /** 공휴근로 hours (휴일근로 ≤ 8h, 가산률 1.5x — same as overtime). */
  holidayHours?: number;
}

/**
 * Result of a single payroll calculation. The `deductions` keys mirror
 * `InsuranceRates` (camelCase pin — see file header) plus three tax
 * fields and a free-form `other` bucket for org-specific deductions.
 */
export interface PayrollResult {
  gross: number;
  deductions: {
    /** 국민연금 — Korean national pension. */
    nationalPension: number;
    /** 건강보험 — Korean health insurance. */
    healthInsurance: number;
    /** 장기요양 — long-term care insurance (rides on healthInsurance). */
    longTermCare: number;
    /** 고용보험 — employment insurance. */
    employmentInsurance: number;
    /** 소득세 — income tax (간이세액표 lookup). */
    incomeTax: number;
    /** 지방소득세 — local income tax (typically 10% of incomeTax). */
    localIncomeTax: number;
    /** Org-specific deductions (uniform / loan repayment / …). */
    other: number;
  };
  net: number;
  metadata: {
    /** Year of the `InsuranceRates` row used for this calculation. */
    insuranceRatesYear: number;
    calculatedAt: Date;
  };
}

/**
 * A payroll result paired with an optional rendered statement document
 * (PDF / HWPX). The document URL is filled in once the consumer's
 * storage layer materializes the rendered statement; the PBC itself does
 * not own storage.
 */
export interface PayrollStatement {
  result: PayrollResult;
  documentUrl?: string;
}

/* ------------------------------------------------------------------ */
/* Insurance rates (camelCase TARGET pin — WI-601)                     */
/* ------------------------------------------------------------------ */

/**
 * Year-aware Korean 4-major-insurance rates plus industrial-accident.
 * The four rate keys match `PayrollResult.deductions` exactly so a
 * payroll engine can do `gross * rates[key]` without a translation
 * table. The TARGET line for WI-601 calls this pin out explicitly.
 *
 * `industrialAccident` is industry-segmented and omitted from
 * `PayrollResult.deductions` (employer-paid in Korea); it lives here
 * because every consumer that prepares 산재 reporting needs the rate.
 */
export interface InsuranceRates {
  year: number;
  /** 국민연금 fraction of gross (e.g. 0.045 for 4.5%). */
  nationalPension: number;
  /** 건강보험 fraction of gross. */
  healthInsurance: number;
  /** 장기요양 fraction (multiplied with healthInsurance base). */
  longTermCare: number;
  /** 고용보험 fraction. */
  employmentInsurance: number;
  /** 산재 — industry-segmented, employer-paid only. */
  industrialAccident: number;
}

/**
 * The concrete year-keyed `InsuranceRates` constants live under
 * `src/payroll/insuranceRates/<year>.ts` and are surfaced via the
 * package barrel (see `index.ts`). WI-602 replaced the WI-601
 * placeholders with the real 2025 / 2026 values; consumers should
 * import them from `@axle/pbc-hr-payroll`, not from this types module.
 */

/* ------------------------------------------------------------------ */
/* Attendance                                                          */
/* ------------------------------------------------------------------ */

export interface AttendanceRecord {
  id: string;
  userId: string;
  checkInAt: Date;
  /** Undefined while the worker is still on the clock. */
  checkOutAt?: Date;
  method: AttendanceMethod;
  status: AttendanceStatus;
}

export interface AttendanceSummary {
  period: YearMonth;
  workDays: number;
  totalHours: number;
  overtimeHours: number;
  lateCount: number;
  absentCount: number;
}

/* ------------------------------------------------------------------ */
/* Leave                                                               */
/* ------------------------------------------------------------------ */

export interface LeaveRequestInput {
  userId: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  reason?: string;
}

export interface LeaveBalance {
  userId: string;
  year: number;
  /** Annual leave granted at the start of the year. */
  granted: number;
  used: number;
  remaining: number;
  /** Per-leave-type usage so consumers can render a breakdown view. */
  byType: Record<LeaveType, number>;
}

/* ------------------------------------------------------------------ */
/* Service interfaces (forward declarations — WI-602..606)             */
/* ------------------------------------------------------------------ */

/**
 * Payroll service — implements the calculation + statement generation
 * defined in WI-602 / WI-603. The skeleton fixes only the surface so
 * FlowTeams can declare its dependency before the per-domain
 * implementations land.
 */
export interface PayrollService {
  calculate(input: PayrollInput): Promise<PayrollResult>;
  generateStatement(input: {
    userId: string;
    period: YearMonth;
  }): Promise<PayrollStatement>;
}

/**
 * Attendance service — WI-604.
 */
export interface AttendanceService {
  recordCheckIn(input: {
    userId: string;
    method: AttendanceMethod;
  }): Promise<AttendanceRecord>;
  recordCheckOut(input: { userId: string }): Promise<AttendanceRecord>;
  summarize(input: {
    userId: string;
    period: YearMonth;
  }): Promise<AttendanceSummary>;
}

/**
 * Leave service — WI-605. Approval / rejection notifications are wired
 * by the consumer's `NotificationService`; the PBC only owns the leave
 * accounting state machine.
 */
export interface LeaveService {
  request(input: LeaveRequestInput): Promise<{ id: string; status: "PENDING" }>;
  approve(input: { leaveId: string; approverId: string }): Promise<void>;
  reject(input: {
    leaveId: string;
    approverId: string;
    reason: string;
  }): Promise<void>;
  balance(input: { userId: string; year: number }): Promise<LeaveBalance>;
}

/**
 * Labor-advisory (노무자문) consultation surface — WI-606. The actual
 * AI call lives in `@axle/ai`; this PBC only declares the question →
 * answer + optional validation contract.
 */
export interface NomuConsultationService {
  ask(input: {
    question: string;
    orgId: string;
  }): Promise<{ id: string; answer: string }>;
  validate(input: {
    consultationId: string;
  }): Promise<{ valid: boolean; reason?: string }>;
}

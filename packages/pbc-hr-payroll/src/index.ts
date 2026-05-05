/**
 * `@axle/pbc-hr-payroll` — public entry.
 *
 * WI-601 ships the type contract only. Concrete implementations land in
 * WI-602..WI-606 (insurance rates, payroll calc, attendance, leave,
 * labor-advisory). Consumers can already import the types to declare a
 * dependency:
 *
 *   import type { PayrollService, AttendanceService } from "@axle/pbc-hr-payroll";
 *
 * Spec: docs/specs/meta-platform/pbc-hr-payroll.md
 */

export {
  ATTENDANCE_METHODS,
  ATTENDANCE_STATUSES,
  EMPLOYMENT_TYPES,
  LEAVE_STATUSES,
  LEAVE_TYPES,
  PAYROLL_STATUSES,
  SALARY_TYPES,
} from "./types.js";

export {
  KOREAN_INSURANCE_RATES_2025,
  KOREAN_INSURANCE_RATES_2026,
  getInsuranceRatesForYear,
} from "./payroll/insuranceRates/index.js";

export type {
  AttendanceMethod,
  AttendanceRecord,
  AttendanceService,
  AttendanceStatus,
  AttendanceSummary,
  EmploymentType,
  InsuranceRates,
  LeaveBalance,
  LeaveRequestInput,
  LeaveService,
  LeaveStatus,
  LeaveType,
  NomuConsultationService,
  PayrollInput,
  PayrollResult,
  PayrollService,
  PayrollStatement,
  PayrollStatus,
  SalaryType,
  YearMonth,
} from "./types.js";

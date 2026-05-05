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

export { calculatePayroll } from "./payroll/calculate.js";
export type { CalculatePayrollOptions } from "./payroll/calculate.js";
export {
  calculateInsuranceDeductions,
  calculateMonthlyIncomeTax,
  computeOrdinaryHourlyWage,
} from "./payroll/deductions.js";
export type { InsuranceDeductionBreakdown } from "./payroll/deductions.js";

export {
  verifyAttendanceContext,
  verifyGpsAttendance,
  verifyIpAttendance,
  verifyManualAttendance,
  verifyQrAttendance,
} from "./attendance/methods.js";
export type {
  AttendanceCheckInInput,
  AttendanceVerificationPolicy,
  Geofence,
  VerificationResult,
} from "./attendance/methods.js";
export {
  createAttendanceService,
} from "./attendance/service.js";
export type {
  AttendanceCheckOutInput,
  AttendanceServiceDeps,
  AttendanceServiceImpl,
} from "./attendance/service.js";
export {
  createInMemoryAttendanceStore,
} from "./attendance/store.js";
export type { AttendanceStore } from "./attendance/store.js";
export {
  FLOWTEAMS_ATTENDANCE_METHODS,
  FLOWTEAMS_ATTENDANCE_STATUSES,
  verifyDefaultFlowTeamsAttendanceEnumMapping,
  verifyFlowTeamsAttendanceEnumMapping,
} from "./attendance/enumMapping.js";
export type {
  EnumMappingResult,
  EnumMismatch,
} from "./attendance/enumMapping.js";

export { createKoreanLeavePolicy } from "./leave/policy.js";
export type { LeaveAllocationPolicy } from "./leave/policy.js";
export { createInMemoryLeaveStore } from "./leave/store.js";
export type { LeaveRecord, LeaveStore } from "./leave/store.js";
export {
  countLeaveDays,
  createLeaveService,
} from "./leave/service.js";
export type {
  LeaveServiceDeps,
  LeaveServiceImpl,
} from "./leave/service.js";

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

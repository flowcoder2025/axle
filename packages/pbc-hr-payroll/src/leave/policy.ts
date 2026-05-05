/**
 * Leave allocation policy.
 *
 * `LeaveAllocationPolicy` is the boundary the org plugs into the
 * `createLeaveService` factory; `createKoreanLeavePolicy` is the
 * default that encodes the Korean Labor Standards Act baseline.
 */

import type { LeaveType } from "../types.js";

export interface LeaveAllocationPolicy {
  /**
   * Returns the calendar-year **연차** grant for the user. Routed
   * separately from the other leave types because Korean law derives
   * it from tenure (and an org may apply a different formula).
   */
  resolveAnnualGrant(input: {
    userId: string;
    year: number;
    tenureYears: number;
  }): number;
  /** Per-LeaveType grant for non-ANNUAL types. Returns 0 for ANNUAL. */
  resolveOtherGrant(type: LeaveType, year: number): number;
}

const ANNUAL_BASE = 15;
const ANNUAL_CAP = 25;

/**
 * Korean Labor Standards Act baseline:
 *   - tenure < 1y → up to 11 days (월 1개씩 적립)
 *   - tenure ≥ 1y → 15 days, +1 day per 2 additional years, capped at 25
 *   - 출산 (MATERNITY) 90, 배우자 출산 (PATERNITY) 10 (2026 기준), 경조 5 (org default)
 *   - SICK / OTHER: 무급, org가 별도 정책으로 가산
 */
export function createKoreanLeavePolicy(): LeaveAllocationPolicy {
  return {
    resolveAnnualGrant({ tenureYears }) {
      if (tenureYears < 1) return 11;
      const bonus = Math.floor((tenureYears - 1) / 2);
      return Math.min(ANNUAL_CAP, ANNUAL_BASE + bonus);
    },
    resolveOtherGrant(type) {
      switch (type) {
        case "MATERNITY":
          return 90;
        case "PATERNITY":
          return 10;
        case "CONDOLENCE":
          return 5;
        case "SICK":
          return 0;
        case "OTHER":
          return 0;
        case "ANNUAL":
          return 0;
      }
    },
  };
}

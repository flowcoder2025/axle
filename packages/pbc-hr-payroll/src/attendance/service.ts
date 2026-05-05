/**
 * `createAttendanceService` — composes per-method verification with the
 * pluggable `AttendanceStore` to implement the `AttendanceService`
 * surface from WI-601 (extended with method-specific check-in context
 * via `AttendanceCheckInInput`).
 *
 * Status transitions:
 *   - check-in past `schedule.startAt + graceMinutes` → LATE
 *   - check-out before `schedule.endAt`               → EARLY_LEAVE
 *     (LATE precedence: a LATE check-in is not downgraded by an
 *     EARLY_LEAVE check-out — both anomalies are noted by leaving the
 *     record LATE; this matches FlowTeams' precedence rule.)
 *   - otherwise                                       → NORMAL
 *
 * `summarize` aggregates over the calendar month, treating each open
 * (still-on-the-clock) record as a work-day with 0 hours so HR can see
 * "checked in today" without inflating totalHours.
 */

import type {
  AttendanceMethod,
  AttendanceRecord,
  AttendanceStatus,
  AttendanceSummary,
  YearMonth,
} from "../types.js";
import {
  verifyAttendanceContext,
  type AttendanceCheckInInput,
  type AttendanceVerificationPolicy,
} from "./methods.js";
import type { AttendanceStore } from "./store.js";

export interface AttendanceServiceDeps {
  store: AttendanceStore;
  policy: AttendanceVerificationPolicy;
  /** Wall-clock provider — overridable in tests. */
  now?: () => Date;
  /**
   * Resolves the scheduled work window for a (user, date) pair. Return
   * `null` to skip the LATE / EARLY_LEAVE evaluation (status falls
   * through to NORMAL).
   */
  schedule?: (
    userId: string,
    date: Date,
  ) => { startAt: Date; endAt: Date } | null;
  /** Tolerance window applied to the LATE evaluation. Defaults to 0. */
  graceMinutes?: number;
}

export interface AttendanceCheckOutInput {
  userId: string;
  /** Optional override for the wall-clock used by this single call. */
  now?: Date;
}

export interface AttendanceServiceImpl {
  recordCheckIn(input: AttendanceCheckInInput): Promise<AttendanceRecord>;
  recordCheckOut(input: AttendanceCheckOutInput): Promise<AttendanceRecord>;
  summarize(input: {
    userId: string;
    period: YearMonth;
  }): Promise<AttendanceSummary>;
}

let idSeq = 0;
function nextRecordId(): string {
  idSeq += 1;
  return `att_${Date.now().toString(36)}_${idSeq.toString(36)}`;
}

export function createAttendanceService(
  deps: AttendanceServiceDeps,
): AttendanceServiceImpl {
  const now = deps.now ?? (() => new Date());
  const graceMinutes = deps.graceMinutes ?? 0;

  function evaluateCheckInStatus(
    userId: string,
    checkInAt: Date,
  ): AttendanceStatus {
    const window = deps.schedule?.(userId, checkInAt) ?? null;
    if (!window) return "NORMAL";
    const lateThreshold = new Date(
      window.startAt.getTime() + graceMinutes * 60_000,
    );
    return checkInAt > lateThreshold ? "LATE" : "NORMAL";
  }

  function evaluateCheckOutStatus(
    userId: string,
    record: AttendanceRecord,
    checkOutAt: Date,
  ): AttendanceStatus {
    // LATE on check-in takes precedence — do not downgrade.
    if (record.status === "LATE") return "LATE";
    const window = deps.schedule?.(userId, record.checkInAt) ?? null;
    if (!window) return "NORMAL";
    return checkOutAt < window.endAt ? "EARLY_LEAVE" : "NORMAL";
  }

  return {
    async recordCheckIn(input) {
      const verification = verifyAttendanceContext(input, deps.policy);
      if (!verification.ok) {
        throw new Error(
          `attendance.recordCheckIn ${input.method} failed: ${verification.reason}`,
        );
      }
      const open = await deps.store.findOpenByUser(input.userId);
      if (open) {
        throw new Error(
          `attendance.recordCheckIn: user ${input.userId} is already checked in (record ${open.id})`,
        );
      }
      const checkInAt = now();
      const record: AttendanceRecord = {
        id: nextRecordId(),
        userId: input.userId,
        checkInAt,
        method: input.method satisfies AttendanceMethod,
        status: evaluateCheckInStatus(input.userId, checkInAt),
      };
      await deps.store.insert(record);
      return { ...record };
    },

    async recordCheckOut(input) {
      const open = await deps.store.findOpenByUser(input.userId);
      if (!open) {
        throw new Error(
          `attendance.recordCheckOut: no open record for user ${input.userId}`,
        );
      }
      const checkOutAt = input.now ?? now();
      const updated: AttendanceRecord = {
        ...open,
        checkOutAt,
        status: evaluateCheckOutStatus(input.userId, open, checkOutAt),
      };
      await deps.store.update(updated);
      return { ...updated };
    },

    async summarize({ userId, period }) {
      const records = await deps.store.listByUserAndPeriod(userId, period);
      let totalHours = 0;
      let overtimeHours = 0;
      let lateCount = 0;
      const dayKeys = new Set<string>();

      for (const r of records) {
        const dayKey = `${r.checkInAt.getUTCFullYear()}-${
          r.checkInAt.getUTCMonth() + 1
        }-${r.checkInAt.getUTCDate()}`;
        dayKeys.add(dayKey);
        if (r.status === "LATE") lateCount += 1;
        if (r.checkOutAt) {
          const hours =
            (r.checkOutAt.getTime() - r.checkInAt.getTime()) / 3_600_000;
          totalHours += hours;
          overtimeHours += Math.max(0, hours - 8);
        }
      }

      return {
        period,
        workDays: dayKeys.size,
        totalHours,
        overtimeHours,
        lateCount,
        absentCount: 0,
      };
    },
  };
}

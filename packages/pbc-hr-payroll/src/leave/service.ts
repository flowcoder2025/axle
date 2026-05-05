/**
 * `createLeaveService` — implements the LeaveService surface from
 * WI-601 (request / approve / reject / balance) plus the per-LeaveType
 * balance accounting that the WI-605 title calls out.
 *
 * State machine:
 *   request → PENDING
 *   PENDING → APPROVED  (approve, stamps approverId)
 *   PENDING → REJECTED  (reject, stamps rejectionReason — non-empty)
 *
 * Balance:
 *   - granted = policy.resolveAnnualGrant({ tenureYears, year })
 *   - used    = sum(days) of APPROVED ANNUAL leaves in `year`
 *   - byType  = sum(days) of APPROVED leaves per LeaveType in `year`
 *   - remaining = max(0, granted − used)
 *
 * The non-ANNUAL grants (MATERNITY 90, PATERNITY 10, …) live on the
 * policy and are not exposed via `LeaveBalance.granted` (the WI-601
 * shape only has a single `granted` field — connoting 연차). Consumers
 * that need the per-type cap can call `policy.resolveOtherGrant` and
 * compare against `byType`.
 */

import type {
  LeaveBalance,
  LeaveRequestInput,
  LeaveStatus,
  LeaveType,
} from "../types.js";
import type { LeaveAllocationPolicy } from "./policy.js";
import type { LeaveRecord, LeaveStore } from "./store.js";

export interface LeaveServiceDeps {
  store: LeaveStore;
  policy: LeaveAllocationPolicy;
  /** Resolves tenure (in whole years) for the annual-leave grant. */
  resolveTenureYears?: (userId: string) => number;
  now?: () => Date;
}

export interface LeaveServiceImpl {
  request(input: LeaveRequestInput): Promise<{ id: string; status: "PENDING" }>;
  approve(input: { leaveId: string; approverId: string }): Promise<void>;
  reject(input: {
    leaveId: string;
    approverId: string;
    reason: string;
  }): Promise<void>;
  balance(input: { userId: string; year: number }): Promise<LeaveBalance>;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Inclusive calendar-day count between `start` and `end`. Throws when
 * `end < start` (caller bug).
 */
export function countLeaveDays(start: Date, end: Date): number {
  if (end.getTime() < start.getTime()) {
    throw new RangeError(
      `countLeaveDays: endDate ${end.toISOString()} precedes startDate ${start.toISOString()}`,
    );
  }
  // Snap to UTC midnight on both sides so DST / TZ shifts don't perturb
  // the inclusive count.
  const startMidnight = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  const endMidnight = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate(),
  );
  return Math.round((endMidnight - startMidnight) / MS_PER_DAY) + 1;
}

let idSeq = 0;
function nextLeaveId(): string {
  idSeq += 1;
  return `lv_${Date.now().toString(36)}_${idSeq.toString(36)}`;
}

const EMPTY_BY_TYPE: Record<LeaveType, number> = {
  ANNUAL: 0,
  SICK: 0,
  CONDOLENCE: 0,
  MATERNITY: 0,
  PATERNITY: 0,
  OTHER: 0,
};

const STATUSES_BLOCKING_NEW_REQUEST: ReadonlySet<LeaveStatus> = new Set([
  "PENDING",
  "APPROVED",
]);

export function createLeaveService(deps: LeaveServiceDeps): LeaveServiceImpl {
  const now = deps.now ?? (() => new Date());
  const resolveTenureYears = deps.resolveTenureYears ?? (() => 0);

  return {
    async request(input) {
      const days = countLeaveDays(input.startDate, input.endDate);

      const overlapping = await deps.store.listOverlapping({
        userId: input.userId,
        startDate: input.startDate,
        endDate: input.endDate,
      });
      const blocking = overlapping.find((r) =>
        STATUSES_BLOCKING_NEW_REQUEST.has(r.status),
      );
      if (blocking) {
        throw new Error(
          `leave.request: overlap with existing ${blocking.status} leave ${blocking.id}`,
        );
      }

      const created = now();
      const record: LeaveRecord = {
        id: nextLeaveId(),
        userId: input.userId,
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
        days,
        status: "PENDING",
        reason: input.reason,
        createdAt: created,
        updatedAt: created,
      };
      await deps.store.insert(record);
      return { id: record.id, status: "PENDING" };
    },

    async approve({ leaveId, approverId }) {
      const existing = await deps.store.findById(leaveId);
      if (!existing) {
        throw new Error(`leave.approve: leave ${leaveId} not found`);
      }
      if (existing.status !== "PENDING") {
        throw new Error(
          `leave.approve: leave ${leaveId} is ${existing.status}, expected PENDING`,
        );
      }
      await deps.store.update({
        ...existing,
        status: "APPROVED",
        approverId,
        updatedAt: now(),
      });
    },

    async reject({ leaveId, approverId, reason }) {
      if (!reason || reason.trim().length === 0) {
        throw new Error("leave.reject: a non-empty reason is required");
      }
      const existing = await deps.store.findById(leaveId);
      if (!existing) {
        throw new Error(`leave.reject: leave ${leaveId} not found`);
      }
      if (existing.status !== "PENDING") {
        throw new Error(
          `leave.reject: leave ${leaveId} is ${existing.status}, expected PENDING`,
        );
      }
      await deps.store.update({
        ...existing,
        status: "REJECTED",
        approverId,
        rejectionReason: reason,
        updatedAt: now(),
      });
    },

    async balance({ userId, year }) {
      const tenureYears = resolveTenureYears(userId);
      const granted = deps.policy.resolveAnnualGrant({
        userId,
        year,
        tenureYears,
      });

      const records = await deps.store.listByUserAndYear(userId, year);
      const byType: Record<LeaveType, number> = { ...EMPTY_BY_TYPE };
      let annualUsed = 0;
      for (const r of records) {
        if (r.status !== "APPROVED") continue;
        byType[r.type] += r.days;
        if (r.type === "ANNUAL") annualUsed += r.days;
      }

      return {
        userId,
        year,
        granted,
        used: annualUsed,
        remaining: Math.max(0, granted - annualUsed),
        byType,
      };
    },
  };
}

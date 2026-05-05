/**
 * `LeaveStore` — abstract persistence boundary for the leave service.
 * The in-memory implementation backs WI-605 tests; WI-607 swaps in a
 * Prisma adapter once FlowTeams' leave models are ported.
 */

import type { LeaveStatus, LeaveType } from "../types.js";

export interface LeaveRecord {
  id: string;
  userId: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  /** Inclusive day count (from `countLeaveDays`). */
  days: number;
  status: LeaveStatus;
  reason?: string;
  approverId?: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveStore {
  insert(record: LeaveRecord): Promise<void>;
  findById(id: string): Promise<LeaveRecord | null>;
  update(record: LeaveRecord): Promise<void>;
  /** Records whose `startDate` falls inside the calendar year. */
  listByUserAndYear(userId: string, year: number): Promise<LeaveRecord[]>;
  /**
   * Records that overlap [startDate, endDate] for the user, regardless
   * of leave type — used by `request` to refuse double-booking against
   * any APPROVED/PENDING leave.
   */
  listOverlapping(input: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<LeaveRecord[]>;
}

export function createInMemoryLeaveStore(): LeaveStore {
  const records = new Map<string, LeaveRecord>();
  const clone = (r: LeaveRecord): LeaveRecord => ({ ...r });

  return {
    async insert(record) {
      records.set(record.id, clone(record));
    },
    async findById(id) {
      const r = records.get(id);
      return r ? clone(r) : null;
    },
    async update(record) {
      records.set(record.id, clone(record));
    },
    async listByUserAndYear(userId, year) {
      return [...records.values()]
        .filter(
          (r) => r.userId === userId && r.startDate.getUTCFullYear() === year,
        )
        .map(clone)
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    },
    async listOverlapping({ userId, startDate, endDate }) {
      const start = startDate.getTime();
      const end = endDate.getTime();
      return [...records.values()]
        .filter((r) => r.userId === userId)
        .filter((r) => r.startDate.getTime() <= end && r.endDate.getTime() >= start)
        .map(clone);
    },
  };
}

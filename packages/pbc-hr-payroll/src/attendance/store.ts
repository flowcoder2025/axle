/**
 * `AttendanceStore` — abstract persistence boundary for the
 * attendance service. WI-604 ships an in-memory implementation so the
 * service can be tested hermetically; WI-607 will swap in a
 * Prisma-backed adapter once the FlowTeams schema is ported into
 * `packages/pbc-hr-payroll/prisma/`.
 */

import type { AttendanceRecord, YearMonth } from "../types.js";

export interface AttendanceStore {
  insert(record: AttendanceRecord): Promise<void>;
  /** Returns the most recent record without `checkOutAt`, or null. */
  findOpenByUser(userId: string): Promise<AttendanceRecord | null>;
  update(record: AttendanceRecord): Promise<void>;
  listByUserAndPeriod(
    userId: string,
    period: YearMonth,
  ): Promise<AttendanceRecord[]>;
}

export function createInMemoryAttendanceStore(): AttendanceStore {
  const records = new Map<string, AttendanceRecord>();

  return {
    async insert(record) {
      records.set(record.id, { ...record });
    },
    async findOpenByUser(userId) {
      const open = [...records.values()]
        .filter((r) => r.userId === userId && r.checkOutAt === undefined)
        .sort((a, b) => b.checkInAt.getTime() - a.checkInAt.getTime());
      return open[0] ? { ...open[0] } : null;
    },
    async update(record) {
      records.set(record.id, { ...record });
    },
    async listByUserAndPeriod(userId, period) {
      return [...records.values()]
        .filter((r) => r.userId === userId)
        .filter((r) => {
          const d = r.checkInAt;
          return (
            d.getUTCFullYear() === period.year &&
            d.getUTCMonth() + 1 === period.month
          );
        })
        .map((r) => ({ ...r }))
        .sort((a, b) => a.checkInAt.getTime() - b.checkInAt.getTime());
    },
  };
}

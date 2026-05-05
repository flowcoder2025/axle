/**
 * Prisma adapter for `AttendanceStore`.
 *
 * Structurally typed against `PrismaAttendanceDelegateLike` so the
 * package doesn't take a hard `@prisma/client` dependency (and avoids
 * needing `prisma generate` on its own build). The consumer wires
 * `prisma.attendance` from @prisma/client; the row shape that backs
 * this adapter lives in the new HR Payroll Domain section of
 * packages/db/prisma/schema.prisma (WI-607).
 */

import type {
  AttendanceMethod,
  AttendanceRecord,
  AttendanceStatus,
  YearMonth,
} from "../types.js";
import type { AttendanceStore } from "./store.js";

interface AttendanceRow {
  id: string;
  userId: string;
  organizationId: string;
  checkInAt: Date;
  checkOutAt: Date | null;
  method: AttendanceMethod;
  status: AttendanceStatus;
}

export interface PrismaAttendanceDelegateLike {
  create(args: { data: AttendanceRow }): Promise<AttendanceRow>;
  update(args: {
    where: { id: string };
    data: Partial<AttendanceRow>;
  }): Promise<AttendanceRow>;
  findFirst(args: {
    where: {
      userId: string;
      checkOutAt: null;
      organizationId?: string;
    };
    orderBy: { checkInAt: "desc" };
  }): Promise<AttendanceRow | null>;
  findMany(args: {
    where: {
      userId: string;
      organizationId?: string;
      checkInAt: { gte: Date; lt: Date };
    };
    orderBy?: { checkInAt: "asc" };
  }): Promise<AttendanceRow[]>;
}

export interface PrismaAttendanceStoreOptions {
  organizationId: string;
}

function rowToRecord(row: AttendanceRow): AttendanceRecord {
  return {
    id: row.id,
    userId: row.userId,
    checkInAt: row.checkInAt,
    ...(row.checkOutAt !== null && { checkOutAt: row.checkOutAt }),
    method: row.method,
    status: row.status,
  };
}

export function createPrismaAttendanceStore(
  delegate: PrismaAttendanceDelegateLike,
  opts: PrismaAttendanceStoreOptions,
): AttendanceStore {
  return {
    async insert(record) {
      await delegate.create({
        data: {
          id: record.id,
          userId: record.userId,
          organizationId: opts.organizationId,
          checkInAt: record.checkInAt,
          checkOutAt: record.checkOutAt ?? null,
          method: record.method,
          status: record.status,
        },
      });
    },

    async findOpenByUser(userId) {
      const row = await delegate.findFirst({
        where: {
          userId,
          checkOutAt: null,
          organizationId: opts.organizationId,
        },
        orderBy: { checkInAt: "desc" },
      });
      return row ? rowToRecord(row) : null;
    },

    async update(record) {
      await delegate.update({
        where: { id: record.id },
        data: {
          checkOutAt: record.checkOutAt ?? null,
          method: record.method,
          status: record.status,
        },
      });
    },

    async listByUserAndPeriod(userId, period: YearMonth) {
      // [Y-M-1, Y-(M+1)-1) UTC half-open window.
      const gte = new Date(Date.UTC(period.year, period.month - 1, 1));
      const lt = new Date(Date.UTC(period.year, period.month, 1));
      const rows = await delegate.findMany({
        where: {
          userId,
          organizationId: opts.organizationId,
          checkInAt: { gte, lt },
        },
        orderBy: { checkInAt: "asc" },
      });
      return rows.map(rowToRecord);
    },
  };
}

/**
 * Prisma adapter for `LeaveStore`. See `attendance/prismaStore.ts`
 * file header for the structural-typing rationale.
 */

import type { LeaveStatus, LeaveType } from "../types.js";
import type { LeaveRecord, LeaveStore } from "./store.js";

interface LeaveRow {
  id: string;
  userId: string;
  organizationId: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  days: number;
  status: LeaveStatus;
  reason: string | null;
  approverId: string | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrismaLeaveDelegateLike {
  create(args: { data: LeaveRow }): Promise<LeaveRow>;
  update(args: {
    where: { id: string };
    data: Partial<LeaveRow>;
  }): Promise<LeaveRow>;
  findUnique(args: { where: { id: string } }): Promise<LeaveRow | null>;
  findMany(args: {
    where: {
      userId: string;
      organizationId?: string;
    } & Record<string, unknown>;
  }): Promise<LeaveRow[]>;
}

export interface PrismaLeaveStoreOptions {
  organizationId: string;
}

function rowToRecord(row: LeaveRow): LeaveRecord {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    startDate: row.startDate,
    endDate: row.endDate,
    days: row.days,
    status: row.status,
    ...(row.reason !== null && { reason: row.reason }),
    ...(row.approverId !== null && { approverId: row.approverId }),
    ...(row.rejectionReason !== null && {
      rejectionReason: row.rejectionReason,
    }),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createPrismaLeaveStore(
  delegate: PrismaLeaveDelegateLike,
  opts: PrismaLeaveStoreOptions,
): LeaveStore {
  return {
    async insert(record) {
      await delegate.create({
        data: {
          id: record.id,
          userId: record.userId,
          organizationId: opts.organizationId,
          type: record.type,
          startDate: record.startDate,
          endDate: record.endDate,
          days: record.days,
          status: record.status,
          reason: record.reason ?? null,
          approverId: record.approverId ?? null,
          rejectionReason: record.rejectionReason ?? null,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        },
      });
    },

    async findById(id) {
      const row = await delegate.findUnique({ where: { id } });
      return row ? rowToRecord(row) : null;
    },

    async update(record) {
      await delegate.update({
        where: { id: record.id },
        data: {
          status: record.status,
          approverId: record.approverId ?? null,
          rejectionReason: record.rejectionReason ?? null,
          reason: record.reason ?? null,
          updatedAt: record.updatedAt,
        },
      });
    },

    async listByUserAndYear(userId, year) {
      const gte = new Date(Date.UTC(year, 0, 1));
      const lt = new Date(Date.UTC(year + 1, 0, 1));
      const rows = await delegate.findMany({
        where: {
          userId,
          organizationId: opts.organizationId,
          startDate: { gte, lt },
        },
      });
      return rows
        .map(rowToRecord)
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    },

    async listOverlapping({ userId, startDate, endDate }) {
      // overlap predicate: row.startDate ≤ window.end AND row.endDate ≥ window.start
      const rows = await delegate.findMany({
        where: {
          userId,
          organizationId: opts.organizationId,
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      });
      return rows.map(rowToRecord);
    },
  };
}

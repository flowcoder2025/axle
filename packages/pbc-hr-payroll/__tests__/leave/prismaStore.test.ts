/**
 * WI-607 — Prisma adapter for `LeaveStore`.
 *
 * The adapter is structurally typed against `PrismaLeaveDelegateLike`
 * so the package doesn't need a hard @prisma/client import. The tests
 * use a hand-rolled spy delegate; the schema row that backs this
 * adapter lives in the new "HR Payroll Domain" section of
 * packages/db/prisma/schema.prisma (this WI).
 */

import { describe, expect, it, vi } from "vitest";
import {
  createPrismaLeaveStore,
  type PrismaLeaveDelegateLike,
} from "../../src/index.js";

interface LeaveRow {
  id: string;
  userId: string;
  organizationId: string;
  type: "ANNUAL" | "SICK" | "CONDOLENCE" | "MATERNITY" | "PATERNITY" | "OTHER";
  startDate: Date;
  endDate: Date;
  days: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason: string | null;
  approverId: string | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function spyDelegate(initial: Map<string, LeaveRow> = new Map()) {
  const rows = new Map(initial);
  const create = vi.fn(async ({ data }: { data: LeaveRow }) => {
    rows.set(data.id, { ...data });
    return { ...data };
  });
  const update = vi.fn(
    async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<LeaveRow>;
    }) => {
      const existing = rows.get(where.id);
      if (!existing) throw new Error("not found");
      const next = { ...existing, ...data };
      rows.set(where.id, next);
      return { ...next };
    },
  );
  const findUnique = vi.fn(
    async ({ where }: { where: { id: string } }) =>
      rows.get(where.id) ?? null,
  );
  const findMany = vi.fn(
    async ({
      where,
    }: {
      where: { userId: string } & Record<string, unknown>;
    }) => {
      let filtered = [...rows.values()].filter(
        (r) => r.userId === where.userId,
      );
      const startDateFilter = where.startDate as
        | { gte?: Date; lt?: Date; lte?: Date }
        | undefined;
      const endDateFilter = where.endDate as { gte?: Date } | undefined;
      const orFilter = where.OR as Array<Record<string, unknown>> | undefined;
      if (startDateFilter?.gte) {
        filtered = filtered.filter(
          (r) => r.startDate >= startDateFilter.gte!,
        );
      }
      if (startDateFilter?.lt) {
        filtered = filtered.filter(
          (r) => r.startDate < startDateFilter.lt!,
        );
      }
      // overlap query: startDate <= window.end AND endDate >= window.start
      if (orFilter || (startDateFilter?.lte && endDateFilter?.gte)) {
        if (startDateFilter?.lte) {
          filtered = filtered.filter(
            (r) => r.startDate <= startDateFilter.lte!,
          );
        }
        if (endDateFilter?.gte) {
          filtered = filtered.filter((r) => r.endDate >= endDateFilter.gte!);
        }
      }
      return filtered;
    },
  );
  const delegate: PrismaLeaveDelegateLike = {
    create,
    update,
    findUnique,
    findMany,
  };
  return { delegate, rows, spies: { create, update, findUnique, findMany } };
}

describe("WI-607 — createPrismaLeaveStore.insert / findById / update", () => {
  it("creates with the org-scoped row and reads back via findById", async () => {
    const { delegate, spies } = spyDelegate();
    const store = createPrismaLeaveStore(delegate, {
      organizationId: "org_1",
    });
    await store.insert({
      id: "lv_1",
      userId: "u1",
      type: "ANNUAL",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-03"),
      days: 3,
      status: "PENDING",
      createdAt: new Date("2026-05-15T00:00:00Z"),
      updatedAt: new Date("2026-05-15T00:00:00Z"),
    });
    expect(spies.create).toHaveBeenCalledOnce();
    const arg = spies.create.mock.calls[0]![0] as { data: LeaveRow };
    expect(arg.data.organizationId).toBe("org_1");
    const r = await store.findById("lv_1");
    expect(r?.days).toBe(3);
    expect(r?.status).toBe("PENDING");
  });

  it("update calls prisma.leave.update with the new status", async () => {
    const { delegate, spies, rows } = spyDelegate(
      new Map([
        [
          "lv_1",
          {
            id: "lv_1",
            userId: "u1",
            organizationId: "org_1",
            type: "ANNUAL",
            startDate: new Date("2026-06-01"),
            endDate: new Date("2026-06-03"),
            days: 3,
            status: "PENDING",
            reason: null,
            approverId: null,
            rejectionReason: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      ]),
    );
    const store = createPrismaLeaveStore(delegate, {
      organizationId: "org_1",
    });
    await store.update({
      id: "lv_1",
      userId: "u1",
      type: "ANNUAL",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-03"),
      days: 3,
      status: "APPROVED",
      approverId: "manager_1",
      createdAt: rows.get("lv_1")!.createdAt,
      updatedAt: new Date("2026-05-15T01:00:00Z"),
    });
    expect(spies.update).toHaveBeenCalledOnce();
    expect(rows.get("lv_1")?.status).toBe("APPROVED");
    expect(rows.get("lv_1")?.approverId).toBe("manager_1");
  });

  it("findById returns null for an unknown id", async () => {
    const { delegate } = spyDelegate();
    const store = createPrismaLeaveStore(delegate, {
      organizationId: "org_1",
    });
    expect(await store.findById("lv_x")).toBeNull();
  });
});

describe("WI-607 — createPrismaLeaveStore.listByUserAndYear", () => {
  it("queries [Jan 1, Jan 1 of next year) of the requested year", async () => {
    const { delegate, spies } = spyDelegate();
    const store = createPrismaLeaveStore(delegate, {
      organizationId: "org_1",
    });
    await store.listByUserAndYear("u1", 2026);
    const arg = spies.findMany.mock.calls[0]![0] as {
      where: {
        userId: string;
        organizationId: string;
        startDate: { gte: Date; lt: Date };
      };
    };
    expect(arg.where.userId).toBe("u1");
    expect(arg.where.organizationId).toBe("org_1");
    expect(arg.where.startDate.gte).toEqual(new Date(Date.UTC(2026, 0, 1)));
    expect(arg.where.startDate.lt).toEqual(new Date(Date.UTC(2027, 0, 1)));
  });
});

describe("WI-607 — createPrismaLeaveStore.listOverlapping", () => {
  it("queries with overlap predicate (startDate ≤ window.end AND endDate ≥ window.start)", async () => {
    const { delegate, spies } = spyDelegate();
    const store = createPrismaLeaveStore(delegate, {
      organizationId: "org_1",
    });
    await store.listOverlapping({
      userId: "u1",
      startDate: new Date("2026-06-03"),
      endDate: new Date("2026-06-04"),
    });
    const arg = spies.findMany.mock.calls[0]![0] as {
      where: {
        userId: string;
        startDate: { lte: Date };
        endDate: { gte: Date };
      };
    };
    expect(arg.where.userId).toBe("u1");
    expect(arg.where.startDate.lte).toEqual(new Date("2026-06-04"));
    expect(arg.where.endDate.gte).toEqual(new Date("2026-06-03"));
  });
});

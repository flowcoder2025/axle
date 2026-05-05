/**
 * WI-607 — Prisma adapter for `AttendanceStore`.
 *
 * The adapter is structurally typed against a minimal `PrismaAttendanceDelegate`
 * so the package doesn't need to import @prisma/client (and run
 * `prisma generate`). The consumer wires `prisma.attendance` from
 * @prisma/client; the tests use a hand-rolled spy delegate so the
 * suite stays hermetic and the Prisma call args are pinned.
 *
 * The schema row that backs this adapter lives in the new "HR Payroll
 * Domain" section of packages/db/prisma/schema.prisma (this WI).
 */

import { describe, expect, it, vi } from "vitest";
import {
  createPrismaAttendanceStore,
  type PrismaAttendanceDelegateLike,
} from "../../src/index.js";

function spyDelegate(initial: Map<string, AttendanceRow> = new Map()): {
  delegate: PrismaAttendanceDelegateLike;
  rows: Map<string, AttendanceRow>;
  spies: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
} {
  const rows = new Map(initial);
  const create = vi.fn(async ({ data }: { data: AttendanceRow }) => {
    rows.set(data.id, { ...data });
    return { ...data };
  });
  const update = vi.fn(
    async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<AttendanceRow>;
    }) => {
      const existing = rows.get(where.id);
      if (!existing) throw new Error("not found");
      const next = { ...existing, ...data };
      rows.set(where.id, next);
      return { ...next };
    },
  );
  const findFirst = vi.fn(
    async ({
      where,
      orderBy,
    }: {
      where: { userId: string; checkOutAt: null };
      orderBy: { checkInAt: "desc" };
    }) => {
      void orderBy;
      const matching = [...rows.values()]
        .filter((r) => r.userId === where.userId && r.checkOutAt === null)
        .sort((a, b) => b.checkInAt.getTime() - a.checkInAt.getTime());
      return matching[0] ?? null;
    },
  );
  const findMany = vi.fn(
    async ({
      where,
    }: {
      where: { userId: string; checkInAt: { gte: Date; lt: Date } };
    }) => {
      return [...rows.values()].filter(
        (r) =>
          r.userId === where.userId &&
          r.checkInAt >= where.checkInAt.gte &&
          r.checkInAt < where.checkInAt.lt,
      );
    },
  );
  const delegate: PrismaAttendanceDelegateLike = {
    create,
    update,
    findFirst,
    findMany,
  };
  return { delegate, rows, spies: { create, update, findFirst, findMany } };
}

interface AttendanceRow {
  id: string;
  userId: string;
  organizationId: string;
  checkInAt: Date;
  checkOutAt: Date | null;
  method: "QR" | "IP" | "GPS" | "MANUAL";
  status: "NORMAL" | "LATE" | "EARLY_LEAVE" | "ABSENT";
}

describe("WI-607 — createPrismaAttendanceStore.insert", () => {
  it("calls prisma.attendance.create with the org-scoped row", async () => {
    const { delegate, spies, rows } = spyDelegate();
    const store = createPrismaAttendanceStore(delegate, {
      organizationId: "org_1",
    });
    await store.insert({
      id: "att_1",
      userId: "u1",
      checkInAt: new Date("2026-05-15T00:00:00Z"),
      method: "QR",
      status: "NORMAL",
    });
    expect(spies.create).toHaveBeenCalledOnce();
    const arg = spies.create.mock.calls[0]![0] as { data: AttendanceRow };
    expect(arg.data.organizationId).toBe("org_1");
    expect(arg.data.id).toBe("att_1");
    expect(arg.data.checkOutAt).toBeNull();
    expect(rows.get("att_1")?.method).toBe("QR");
  });
});

describe("WI-607 — createPrismaAttendanceStore.findOpenByUser", () => {
  it("queries WHERE userId AND checkOutAt IS NULL ORDER BY checkInAt DESC", async () => {
    const { delegate, spies } = spyDelegate(
      new Map([
        [
          "att_open",
          {
            id: "att_open",
            userId: "u1",
            organizationId: "org_1",
            checkInAt: new Date("2026-05-15T00:00:00Z"),
            checkOutAt: null,
            method: "QR",
            status: "NORMAL",
          },
        ],
      ]),
    );
    const store = createPrismaAttendanceStore(delegate, {
      organizationId: "org_1",
    });
    const open = await store.findOpenByUser("u1");
    expect(open?.id).toBe("att_open");
    expect(open?.checkOutAt).toBeUndefined();
    expect(spies.findFirst).toHaveBeenCalledOnce();
    const arg = spies.findFirst.mock.calls[0]![0] as {
      where: Record<string, unknown>;
    };
    expect(arg.where).toMatchObject({
      userId: "u1",
      checkOutAt: null,
      organizationId: "org_1",
    });
  });

  it("returns null when no open record exists", async () => {
    const { delegate } = spyDelegate();
    const store = createPrismaAttendanceStore(delegate, {
      organizationId: "org_1",
    });
    expect(await store.findOpenByUser("u1")).toBeNull();
  });
});

describe("WI-607 — createPrismaAttendanceStore.update", () => {
  it("calls prisma.attendance.update with the closing checkOutAt and status", async () => {
    const { delegate, spies, rows } = spyDelegate(
      new Map([
        [
          "att_open",
          {
            id: "att_open",
            userId: "u1",
            organizationId: "org_1",
            checkInAt: new Date("2026-05-15T00:00:00Z"),
            checkOutAt: null,
            method: "QR",
            status: "NORMAL",
          },
        ],
      ]),
    );
    const store = createPrismaAttendanceStore(delegate, {
      organizationId: "org_1",
    });
    await store.update({
      id: "att_open",
      userId: "u1",
      checkInAt: new Date("2026-05-15T00:00:00Z"),
      checkOutAt: new Date("2026-05-15T09:00:00Z"),
      method: "QR",
      status: "EARLY_LEAVE",
    });
    expect(spies.update).toHaveBeenCalledOnce();
    expect(rows.get("att_open")?.checkOutAt).toEqual(
      new Date("2026-05-15T09:00:00Z"),
    );
    expect(rows.get("att_open")?.status).toBe("EARLY_LEAVE");
  });
});

describe("WI-607 — createPrismaAttendanceStore.listByUserAndPeriod", () => {
  it("queries with [gte, lt) of the calendar month UTC", async () => {
    const { delegate, spies } = spyDelegate();
    const store = createPrismaAttendanceStore(delegate, {
      organizationId: "org_1",
    });
    await store.listByUserAndPeriod("u1", { year: 2026, month: 5 });
    const arg = spies.findMany.mock.calls[0]![0] as {
      where: { checkInAt: { gte: Date; lt: Date }; userId: string };
    };
    expect(arg.where.userId).toBe("u1");
    expect(arg.where.checkInAt.gte).toEqual(new Date(Date.UTC(2026, 4, 1)));
    // Next-month boundary (June 1 UTC) — exclusive.
    expect(arg.where.checkInAt.lt).toEqual(new Date(Date.UTC(2026, 5, 1)));
  });

  it("maps rows back into the AttendanceRecord shape (drops checkOutAt:null)", async () => {
    const { delegate } = spyDelegate(
      new Map([
        [
          "a",
          {
            id: "a",
            userId: "u1",
            organizationId: "org_1",
            checkInAt: new Date("2026-05-10T00:00:00Z"),
            checkOutAt: null,
            method: "QR",
            status: "NORMAL",
          },
        ],
        [
          "b",
          {
            id: "b",
            userId: "u1",
            organizationId: "org_1",
            checkInAt: new Date("2026-05-11T00:00:00Z"),
            checkOutAt: new Date("2026-05-11T09:00:00Z"),
            method: "QR",
            status: "NORMAL",
          },
        ],
      ]),
    );
    const store = createPrismaAttendanceStore(delegate, {
      organizationId: "org_1",
    });
    const records = await store.listByUserAndPeriod("u1", {
      year: 2026,
      month: 5,
    });
    const open = records.find((r) => r.id === "a");
    const closed = records.find((r) => r.id === "b");
    expect(open?.checkOutAt).toBeUndefined();
    expect(closed?.checkOutAt).toEqual(new Date("2026-05-11T09:00:00Z"));
  });
});

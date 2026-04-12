import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockPrismaProgram = vi.hoisted(() => ({
  create: vi.fn(),
  delete: vi.fn(),
}));

const mockPrismaSchedule = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
}));

const mockTransaction = vi.hoisted(() =>
  vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      programInfo: mockPrismaProgram,
      schedule: mockPrismaSchedule,
    };
    return fn(tx);
  })
);

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    programInfo: mockPrismaProgram,
    schedule: mockPrismaSchedule,
    $transaction: mockTransaction,
  },
}));

import {
  createProgramWithDeadlines,
  syncDeadlines,
  deleteProgramWithDeadlines,
  PROGRAM_DUE_REMINDER_DAYS,
} from "../../lib/services/program-deadline";

const ORG_ID = "org-1";

beforeEach(() => {
  vi.resetAllMocks();
  // Re-wire $transaction after reset
  mockTransaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        programInfo: mockPrismaProgram,
        schedule: mockPrismaSchedule,
      };
      return fn(tx);
    }
  );
});

// ---------------------------------------------------------------------------
// PROGRAM_DUE_REMINDER_DAYS constant
// ---------------------------------------------------------------------------

describe("PROGRAM_DUE_REMINDER_DAYS", () => {
  it("exports the expected reminder days", () => {
    expect(PROGRAM_DUE_REMINDER_DAYS).toEqual([30, 14, 7, 3, 1]);
  });
});

// ---------------------------------------------------------------------------
// createProgramWithDeadlines
// ---------------------------------------------------------------------------

describe("createProgramWithDeadlines", () => {
  it("creates program without schedule when applicationEnd is absent", async () => {
    const created = {
      id: "prog-1",
      name: "벤처 지원",
      category: "VENTURE",
      applicationEnd: null,
    };
    mockPrismaProgram.create.mockResolvedValue(created);

    const result = await createProgramWithDeadlines(ORG_ID, {
      name: "벤처 지원",
      category: "VENTURE",
    });

    expect(result).toEqual(created);
    expect(mockPrismaProgram.create).toHaveBeenCalledTimes(1);
    expect(mockPrismaSchedule.create).not.toHaveBeenCalled();
  });

  it("creates program and PROGRAM_DUE schedule when applicationEnd is provided", async () => {
    const endDate = new Date("2025-03-31T23:59:59.000Z");
    const created = {
      id: "prog-1",
      name: "R&D 과제",
      category: "RND",
      applicationEnd: endDate,
    };
    mockPrismaProgram.create.mockResolvedValue(created);
    mockPrismaSchedule.create.mockResolvedValue({ id: "sch-1" });

    const result = await createProgramWithDeadlines(ORG_ID, {
      name: "R&D 과제",
      category: "RND",
      applicationEnd: "2025-03-31T23:59:59.000Z",
    });

    expect(result).toEqual(created);
    expect(mockPrismaSchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: ORG_ID,
        programId: "prog-1",
        title: "[마감] R&D 과제",
        type: "PROGRAM_DUE",
        startDate: endDate,
        isAllDay: true,
        reminderDays: [30, 14, 7, 3, 1],
      }),
    });
  });

  it("passes optional fields through to prisma create", async () => {
    const created = {
      id: "prog-2",
      name: "수출 지원",
      category: "EXPORT",
      applicationEnd: null,
      agency: "KOTRA",
      region: "서울",
      memo: "메모",
    };
    mockPrismaProgram.create.mockResolvedValue(created);

    await createProgramWithDeadlines(ORG_ID, {
      name: "수출 지원",
      category: "EXPORT",
      agency: "KOTRA",
      region: "서울",
      memo: "메모",
    });

    expect(mockPrismaProgram.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: ORG_ID,
        name: "수출 지원",
        category: "EXPORT",
        agency: "KOTRA",
        region: "서울",
        memo: "메모",
      }),
    });
  });
});

// ---------------------------------------------------------------------------
// syncDeadlines
// ---------------------------------------------------------------------------

describe("syncDeadlines", () => {
  const tx = {
    programInfo: mockPrismaProgram,
    schedule: mockPrismaSchedule,
  };

  it("updates existing schedule when newEndDate is set", async () => {
    mockPrismaSchedule.findFirst.mockResolvedValue({ id: "sch-1" });
    mockPrismaSchedule.update.mockResolvedValue({ id: "sch-1" });

    const newDate = new Date("2025-06-30T23:59:59.000Z");
    await syncDeadlines("prog-1", ORG_ID, newDate, "R&D 과제", tx as any);

    expect(mockPrismaSchedule.update).toHaveBeenCalledWith({
      where: { id: "sch-1" },
      data: {
        startDate: newDate,
        title: "[마감] R&D 과제",
      },
    });
    expect(mockPrismaSchedule.create).not.toHaveBeenCalled();
  });

  it("creates new schedule when newEndDate is set and no schedule exists", async () => {
    mockPrismaSchedule.findFirst.mockResolvedValue(null);
    mockPrismaSchedule.create.mockResolvedValue({ id: "sch-new" });

    const newDate = new Date("2025-06-30T23:59:59.000Z");
    await syncDeadlines("prog-1", ORG_ID, newDate, "STARTUP", tx as any);

    expect(mockPrismaSchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: ORG_ID,
        programId: "prog-1",
        title: "[마감] STARTUP",
        type: "PROGRAM_DUE",
        startDate: newDate,
        isAllDay: true,
        reminderDays: [30, 14, 7, 3, 1],
      }),
    });
  });

  it("deletes schedule when newEndDate is null and schedule exists", async () => {
    mockPrismaSchedule.findFirst.mockResolvedValue({ id: "sch-1" });
    mockPrismaSchedule.delete.mockResolvedValue({ id: "sch-1" });

    await syncDeadlines("prog-1", ORG_ID, null, "RND", tx as any);

    expect(mockPrismaSchedule.delete).toHaveBeenCalledWith({
      where: { id: "sch-1" },
    });
  });

  it("does nothing when newEndDate is null and no schedule exists", async () => {
    mockPrismaSchedule.findFirst.mockResolvedValue(null);

    await syncDeadlines("prog-1", ORG_ID, null, "RND", tx as any);

    expect(mockPrismaSchedule.create).not.toHaveBeenCalled();
    expect(mockPrismaSchedule.update).not.toHaveBeenCalled();
    expect(mockPrismaSchedule.delete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// deleteProgramWithDeadlines
// ---------------------------------------------------------------------------

describe("deleteProgramWithDeadlines", () => {
  it("deletes schedules first, then program, in a transaction", async () => {
    mockPrismaSchedule.deleteMany.mockResolvedValue({ count: 2 });
    mockPrismaProgram.delete.mockResolvedValue({ id: "prog-1" });

    await deleteProgramWithDeadlines("prog-1");

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockPrismaSchedule.deleteMany).toHaveBeenCalledWith({
      where: { programId: "prog-1" },
    });
    expect(mockPrismaProgram.delete).toHaveBeenCalledWith({
      where: { id: "prog-1" },
    });
  });

  it("calls deleteMany even when no schedules exist", async () => {
    mockPrismaSchedule.deleteMany.mockResolvedValue({ count: 0 });
    mockPrismaProgram.delete.mockResolvedValue({ id: "prog-2" });

    await deleteProgramWithDeadlines("prog-2");

    expect(mockPrismaSchedule.deleteMany).toHaveBeenCalledWith({
      where: { programId: "prog-2" },
    });
    expect(mockPrismaProgram.delete).toHaveBeenCalledWith({
      where: { id: "prog-2" },
    });
  });
});

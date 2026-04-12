import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockSchedule = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    schedule: mockSchedule,
  },
}));

import {
  listSchedules,
  createSchedule,
  getSchedule,
  updateSchedule,
  deleteSchedule,
} from "../../lib/services/schedule-service";

const ORG_ID = "org-1";

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// listSchedules
// ---------------------------------------------------------------------------

describe("listSchedules", () => {
  it("queries with orgId and pagination", async () => {
    const fakeSchedules = [{ id: "s1", title: "Meeting" }];
    mockSchedule.findMany.mockResolvedValue(fakeSchedules);
    mockSchedule.count.mockResolvedValue(1);

    const result = await listSchedules(ORG_ID, {
      page: 1,
      pageSize: 20,
    });

    expect(result).toEqual({ schedules: fakeSchedules, total: 1 });
    expect(mockSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: ORG_ID },
        skip: 0,
        take: 20,
        orderBy: { startDate: "asc" },
      })
    );
    expect(mockSchedule.count).toHaveBeenCalledWith({
      where: { orgId: ORG_ID },
    });
  });

  it("applies type filter when provided", async () => {
    mockSchedule.findMany.mockResolvedValue([]);
    mockSchedule.count.mockResolvedValue(0);

    await listSchedules(ORG_ID, {
      type: "MEETING",
      page: 1,
      pageSize: 10,
    });

    expect(mockSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: ORG_ID, type: "MEETING" }),
      })
    );
  });

  it("applies date range filters when provided", async () => {
    mockSchedule.findMany.mockResolvedValue([]);
    mockSchedule.count.mockResolvedValue(0);

    const from = "2026-01-01T00:00:00.000Z";
    const to = "2026-12-31T23:59:59.999Z";

    await listSchedules(ORG_ID, {
      startDateFrom: from,
      startDateTo: to,
      page: 1,
      pageSize: 20,
    });

    expect(mockSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: ORG_ID,
          startDate: {
            gte: new Date(from),
            lte: new Date(to),
          },
        }),
      })
    );
  });

  it("calculates skip from page and pageSize", async () => {
    mockSchedule.findMany.mockResolvedValue([]);
    mockSchedule.count.mockResolvedValue(0);

    await listSchedules(ORG_ID, { page: 3, pageSize: 10 });

    expect(mockSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });
});

// ---------------------------------------------------------------------------
// createSchedule
// ---------------------------------------------------------------------------

describe("createSchedule", () => {
  it("creates schedule with parsed dates", async () => {
    const created = { id: "s1", title: "New Meeting" };
    mockSchedule.create.mockResolvedValue(created);

    const result = await createSchedule(ORG_ID, {
      title: "New Meeting",
      type: "MEETING",
      startDate: "2026-06-01T09:00:00.000Z",
    });

    expect(result).toEqual(created);
    expect(mockSchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: ORG_ID,
        title: "New Meeting",
        type: "MEETING",
        startDate: new Date("2026-06-01T09:00:00.000Z"),
      }),
    });
  });

  it("passes endDate as Date when provided", async () => {
    mockSchedule.create.mockResolvedValue({ id: "s2" });

    await createSchedule(ORG_ID, {
      title: "Deadline",
      type: "DEADLINE",
      startDate: "2026-06-01T09:00:00.000Z",
      endDate: "2026-06-02T17:00:00.000Z",
    });

    expect(mockSchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        endDate: new Date("2026-06-02T17:00:00.000Z"),
      }),
    });
  });
});

// ---------------------------------------------------------------------------
// getSchedule
// ---------------------------------------------------------------------------

describe("getSchedule", () => {
  it("returns schedule when found", async () => {
    const schedule = { id: "s1", orgId: ORG_ID, title: "Test" };
    mockSchedule.findFirst.mockResolvedValue(schedule);

    const result = await getSchedule("s1", ORG_ID);

    expect(result).toEqual(schedule);
    expect(mockSchedule.findFirst).toHaveBeenCalledWith({
      where: { id: "s1", orgId: ORG_ID },
      include: {
        client: { select: { id: true, name: true } },
        program: { select: { id: true, name: true } },
      },
    });
  });

  it("returns null when not found", async () => {
    mockSchedule.findFirst.mockResolvedValue(null);

    const result = await getSchedule("nonexistent", ORG_ID);

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateSchedule
// ---------------------------------------------------------------------------

describe("updateSchedule", () => {
  it("returns null when schedule not found", async () => {
    mockSchedule.findFirst.mockResolvedValue(null);

    const result = await updateSchedule("nonexistent", ORG_ID, { title: "Updated" });

    expect(result).toBeNull();
    expect(mockSchedule.update).not.toHaveBeenCalled();
  });

  it("updates schedule when found", async () => {
    mockSchedule.findFirst.mockResolvedValue({ id: "s1" });
    const updated = { id: "s1", title: "Updated" };
    mockSchedule.update.mockResolvedValue(updated);

    const result = await updateSchedule("s1", ORG_ID, { title: "Updated" });

    expect(result).toEqual(updated);
    expect(mockSchedule.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: expect.objectContaining({ title: "Updated" }),
    });
  });
});

// ---------------------------------------------------------------------------
// deleteSchedule
// ---------------------------------------------------------------------------

describe("deleteSchedule", () => {
  it("returns false when schedule not found", async () => {
    mockSchedule.findFirst.mockResolvedValue(null);

    const result = await deleteSchedule("nonexistent", ORG_ID);

    expect(result).toBe(false);
    expect(mockSchedule.delete).not.toHaveBeenCalled();
  });

  it("deletes and returns true when schedule exists", async () => {
    mockSchedule.findFirst.mockResolvedValue({ id: "s1" });
    mockSchedule.delete.mockResolvedValue({ id: "s1" });

    const result = await deleteSchedule("s1", ORG_ID);

    expect(result).toBe(true);
    expect(mockSchedule.delete).toHaveBeenCalledWith({
      where: { id: "s1" },
    });
  });
});

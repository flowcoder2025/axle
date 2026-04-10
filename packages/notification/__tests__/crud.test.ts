import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockNotificationOps = {
  create: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  count: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    notification: mockNotificationOps,
  },
}));

// --- Tests ---

describe("create()", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates a notification with required fields", async () => {
    const expected = {
      id: "notif-1",
      userId: "user-1",
      type: "DEADLINE",
      title: "Deadline approaching",
      body: null,
      link: null,
      isRead: false,
      createdAt: new Date(),
    };
    mockNotificationOps.create.mockResolvedValue(expected);

    const { create } = await import("../src/crud.js");
    const result = await create({
      userId: "user-1",
      type: "DEADLINE",
      title: "Deadline approaching",
    });

    expect(result).toEqual(expected);
    expect(mockNotificationOps.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        type: "DEADLINE",
        title: "Deadline approaching",
        body: null,
        link: null,
      },
    });
  });

  it("passes body and link when provided", async () => {
    mockNotificationOps.create.mockResolvedValue({ id: "notif-2" });

    const { create } = await import("../src/crud.js");
    await create({
      userId: "user-1",
      type: "ACTION_ITEM",
      title: "New action item",
      body: "Please review the document",
      link: "/projects/proj-1",
    });

    expect(mockNotificationOps.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        body: "Please review the document",
        link: "/projects/proj-1",
      }),
    });
  });
});

describe("getUnread()", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns unread notifications ordered by createdAt desc", async () => {
    const fakeNotifs = [
      { id: "n-2", isRead: false, createdAt: new Date("2025-01-02") },
      { id: "n-1", isRead: false, createdAt: new Date("2025-01-01") },
    ];
    mockNotificationOps.findMany.mockResolvedValue(fakeNotifs);

    const { getUnread } = await import("../src/crud.js");
    const result = await getUnread("user-1");

    expect(result).toEqual(fakeNotifs);
    expect(mockNotificationOps.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", isRead: false },
      orderBy: { createdAt: "desc" },
    });
  });

  it("returns empty array when no unread notifications", async () => {
    mockNotificationOps.findMany.mockResolvedValue([]);

    const { getUnread } = await import("../src/crud.js");
    const result = await getUnread("user-2");

    expect(result).toEqual([]);
  });
});

describe("markRead()", () => {
  beforeEach(() => vi.resetAllMocks());

  it("marks notification as read when it belongs to user", async () => {
    mockNotificationOps.findFirst.mockResolvedValue({ id: "notif-1" });
    const updated = { id: "notif-1", isRead: true };
    mockNotificationOps.update.mockResolvedValue(updated);

    const { markRead } = await import("../src/crud.js");
    const result = await markRead("notif-1", "user-1");

    expect(result).toEqual(updated);
    expect(mockNotificationOps.update).toHaveBeenCalledWith({
      where: { id: "notif-1" },
      data: { isRead: true },
    });
  });

  it("returns null when notification does not belong to user", async () => {
    mockNotificationOps.findFirst.mockResolvedValue(null);

    const { markRead } = await import("../src/crud.js");
    const result = await markRead("notif-999", "user-1");

    expect(result).toBeNull();
    expect(mockNotificationOps.update).not.toHaveBeenCalled();
  });
});

describe("markAllRead()", () => {
  beforeEach(() => vi.resetAllMocks());

  it("bulk-updates all unread notifications for user", async () => {
    mockNotificationOps.updateMany.mockResolvedValue({ count: 5 });

    const { markAllRead } = await import("../src/crud.js");
    const count = await markAllRead("user-1");

    expect(count).toBe(5);
    expect(mockNotificationOps.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", isRead: false },
      data: { isRead: true },
    });
  });

  it("returns 0 when there are no unread notifications", async () => {
    mockNotificationOps.updateMany.mockResolvedValue({ count: 0 });

    const { markAllRead } = await import("../src/crud.js");
    const count = await markAllRead("user-2");

    expect(count).toBe(0);
  });
});

describe("getByUser()", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns paginated notifications with unreadCount", async () => {
    const fakeNotifs = [{ id: "n-1", isRead: false }];
    mockNotificationOps.findMany.mockResolvedValue(fakeNotifs);
    mockNotificationOps.count
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(3); // unreadCount

    const { getByUser } = await import("../src/crud.js");
    const result = await getByUser("user-1", { page: 1, pageSize: 20 });

    expect(result).toMatchObject({
      notifications: fakeNotifs,
      total: 10,
      page: 1,
      pageSize: 20,
      unreadCount: 3,
    });
  });

  it("applies type filter when provided", async () => {
    mockNotificationOps.findMany.mockResolvedValue([]);
    mockNotificationOps.count.mockResolvedValue(0);

    const { getByUser } = await import("../src/crud.js");
    await getByUser("user-1", { type: "DEADLINE" });

    expect(mockNotificationOps.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "DEADLINE" }),
      })
    );
  });

  it("applies isRead filter when provided", async () => {
    mockNotificationOps.findMany.mockResolvedValue([]);
    mockNotificationOps.count.mockResolvedValue(0);

    const { getByUser } = await import("../src/crud.js");
    await getByUser("user-1", { isRead: false });

    expect(mockNotificationOps.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isRead: false }),
      })
    );
  });

  it("uses defaults when no options provided", async () => {
    mockNotificationOps.findMany.mockResolvedValue([]);
    mockNotificationOps.count.mockResolvedValue(0);

    const { getByUser } = await import("../src/crud.js");
    const result = await getByUser("user-1");

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });
});

describe("deleteOne()", () => {
  beforeEach(() => vi.resetAllMocks());

  it("deletes notification when it belongs to user", async () => {
    mockNotificationOps.findFirst.mockResolvedValue({ id: "notif-1" });
    mockNotificationOps.delete.mockResolvedValue({ id: "notif-1" });

    const { deleteOne } = await import("../src/crud.js");
    const result = await deleteOne("notif-1", "user-1");

    expect(result).toEqual({ deleted: true });
    expect(mockNotificationOps.delete).toHaveBeenCalledWith({
      where: { id: "notif-1" },
    });
  });

  it("returns null when notification does not belong to user", async () => {
    mockNotificationOps.findFirst.mockResolvedValue(null);

    const { deleteOne } = await import("../src/crud.js");
    const result = await deleteOne("notif-999", "user-1");

    expect(result).toBeNull();
    expect(mockNotificationOps.delete).not.toHaveBeenCalled();
  });
});

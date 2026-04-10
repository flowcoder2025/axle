import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockGetByUser = vi.fn();
const mockMarkAllRead = vi.fn();
const mockMarkRead = vi.fn();
const mockDeleteOne = vi.fn();

vi.mock("@axle/notification", () => ({
  NOTIFICATION_PACKAGE: "@axle/notification",
  getByUser: mockGetByUser,
  markAllRead: mockMarkAllRead,
  markRead: mockMarkRead,
  deleteOne: mockDeleteOne,
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
}));

// --- Helpers ---

import { getCurrentUser } from "@axle/auth";

const authedUser = { id: "user-1", orgId: "org-1", email: "a@test.com" };

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

// --- Validation schema tests ---

describe("notificationQuerySchema", () => {
  it("applies defaults when params are absent", async () => {
    const { notificationQuerySchema } = await import(
      "../../lib/validations/notification"
    );
    const result = notificationQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("coerces string page/pageSize", async () => {
    const { notificationQuerySchema } = await import(
      "../../lib/validations/notification"
    );
    const result = notificationQuerySchema.safeParse({ page: "2", pageSize: "10" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.pageSize).toBe(10);
    }
  });

  it("transforms isRead string to boolean", async () => {
    const { notificationQuerySchema } = await import(
      "../../lib/validations/notification"
    );
    const result = notificationQuerySchema.safeParse({ isRead: "false" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isRead).toBe(false);
    }
  });

  it("rejects invalid type", async () => {
    const { notificationQuerySchema } = await import(
      "../../lib/validations/notification"
    );
    const result = notificationQuerySchema.safeParse({ type: "INVALID_TYPE" });
    expect(result.success).toBe(false);
  });
});

describe("notificationCreateSchema", () => {
  it("accepts valid create input", async () => {
    const { notificationCreateSchema } = await import(
      "../../lib/validations/notification"
    );
    const result = notificationCreateSchema.safeParse({
      userId: "user-1",
      type: "DEADLINE",
      title: "Deadline approaching",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing userId", async () => {
    const { notificationCreateSchema } = await import(
      "../../lib/validations/notification"
    );
    const result = notificationCreateSchema.safeParse({
      type: "DEADLINE",
      title: "Test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing title", async () => {
    const { notificationCreateSchema } = await import(
      "../../lib/validations/notification"
    );
    const result = notificationCreateSchema.safeParse({
      userId: "user-1",
      type: "DEADLINE",
    });
    expect(result.success).toBe(false);
  });
});

// --- GET /api/notifications ---

describe("GET /api/notifications", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import("../../app/api/notifications/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/notifications") as never
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns paginated notifications with unreadCount", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const fakeResult = {
      notifications: [{ id: "n-1", type: "DEADLINE", isRead: false }],
      total: 1,
      page: 1,
      pageSize: 20,
      unreadCount: 1,
    };
    mockGetByUser.mockResolvedValue(fakeResult);

    const { GET } = await import("../../app/api/notifications/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/notifications") as never
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      data: fakeResult.notifications,
      total: 1,
      page: 1,
      pageSize: 20,
      unreadCount: 1,
    });
  });

  it("passes type filter to getByUser", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockGetByUser.mockResolvedValue({
      notifications: [],
      total: 0,
      page: 1,
      pageSize: 20,
      unreadCount: 0,
    });

    const { GET } = await import("../../app/api/notifications/route");
    await GET(
      makeRequest(
        "GET",
        "http://localhost/api/notifications?type=DEADLINE"
      ) as never
    );

    expect(mockGetByUser).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ type: "DEADLINE" })
    );
  });

  it("passes isRead=false filter to getByUser", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockGetByUser.mockResolvedValue({
      notifications: [],
      total: 0,
      page: 1,
      pageSize: 20,
      unreadCount: 0,
    });

    const { GET } = await import("../../app/api/notifications/route");
    await GET(
      makeRequest(
        "GET",
        "http://localhost/api/notifications?isRead=false"
      ) as never
    );

    expect(mockGetByUser).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ isRead: false })
    );
  });

  it("returns 400 on invalid query params", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);

    const { GET } = await import("../../app/api/notifications/route");
    const res = await GET(
      makeRequest(
        "GET",
        "http://localhost/api/notifications?type=NONEXISTENT"
      ) as never
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

// --- PATCH /api/notifications (mark all read) ---

describe("PATCH /api/notifications", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { PATCH } = await import("../../app/api/notifications/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/notifications") as never
    );
    expect(res.status).toBe(401);
  });

  it("marks all as read and returns updated count", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockMarkAllRead.mockResolvedValue(7);

    const { PATCH } = await import("../../app/api/notifications/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/notifications") as never
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.updated).toBe(7);
    expect(mockMarkAllRead).toHaveBeenCalledWith("user-1");
  });
});

// --- PATCH /api/notifications/[notificationId] (mark single read) ---

describe("PATCH /api/notifications/[notificationId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { PATCH } = await import(
      "../../app/api/notifications/[notificationId]/route"
    );
    const res = await PATCH(
      makeRequest(
        "PATCH",
        "http://localhost/api/notifications/notif-1"
      ) as never,
      { params: Promise.resolve({ notificationId: "notif-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when notification does not belong to user", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockMarkRead.mockResolvedValue(null);

    const { PATCH } = await import(
      "../../app/api/notifications/[notificationId]/route"
    );
    const res = await PATCH(
      makeRequest(
        "PATCH",
        "http://localhost/api/notifications/notif-999"
      ) as never,
      { params: Promise.resolve({ notificationId: "notif-999" }) }
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("marks notification as read and returns updated record", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const updated = { id: "notif-1", isRead: true };
    mockMarkRead.mockResolvedValue(updated);

    const { PATCH } = await import(
      "../../app/api/notifications/[notificationId]/route"
    );
    const res = await PATCH(
      makeRequest(
        "PATCH",
        "http://localhost/api/notifications/notif-1"
      ) as never,
      { params: Promise.resolve({ notificationId: "notif-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(updated);
    expect(mockMarkRead).toHaveBeenCalledWith("notif-1", "user-1");
  });
});

// --- DELETE /api/notifications/[notificationId] ---

describe("DELETE /api/notifications/[notificationId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { DELETE } = await import(
      "../../app/api/notifications/[notificationId]/route"
    );
    const res = await DELETE(
      makeRequest(
        "DELETE",
        "http://localhost/api/notifications/notif-1"
      ) as never,
      { params: Promise.resolve({ notificationId: "notif-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when notification does not belong to user", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockDeleteOne.mockResolvedValue(null);

    const { DELETE } = await import(
      "../../app/api/notifications/[notificationId]/route"
    );
    const res = await DELETE(
      makeRequest(
        "DELETE",
        "http://localhost/api/notifications/notif-999"
      ) as never,
      { params: Promise.resolve({ notificationId: "notif-999" }) }
    );
    expect(res.status).toBe(404);
  });

  it("deletes notification and returns deleted:true", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockDeleteOne.mockResolvedValue({ deleted: true });

    const { DELETE } = await import(
      "../../app/api/notifications/[notificationId]/route"
    );
    const res = await DELETE(
      makeRequest(
        "DELETE",
        "http://localhost/api/notifications/notif-1"
      ) as never,
      { params: Promise.resolve({ notificationId: "notif-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deleted).toBe(true);
    expect(mockDeleteOne).toHaveBeenCalledWith("notif-1", "user-1");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockActionItem = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockMeeting = {
  findFirst: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    meeting: mockMeeting,
    actionItem: mockActionItem,
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
}));

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

describe("actionItemCreateSchema", () => {
  it("accepts minimal valid input", async () => {
    const { actionItemCreateSchema } = await import("../../lib/validations/action-item");
    const result = actionItemCreateSchema.safeParse({ description: "Follow up on proposal" });
    expect(result.success).toBe(true);
  });

  it("rejects missing description", async () => {
    const { actionItemCreateSchema } = await import("../../lib/validations/action-item");
    const result = actionItemCreateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts optional assigneeUserId and dueDate", async () => {
    const { actionItemCreateSchema } = await import("../../lib/validations/action-item");
    const result = actionItemCreateSchema.safeParse({
      description: "Send report",
      assigneeUserId: "user-2",
      dueDate: "2025-01-15T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid dueDate format", async () => {
    const { actionItemCreateSchema } = await import("../../lib/validations/action-item");
    const result = actionItemCreateSchema.safeParse({
      description: "Send report",
      dueDate: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});

describe("actionItemUpdateSchema", () => {
  it("accepts empty update (all optional)", async () => {
    const { actionItemUpdateSchema } = await import("../../lib/validations/action-item");
    const result = actionItemUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid status transition", async () => {
    const { actionItemUpdateSchema } = await import("../../lib/validations/action-item");
    const result = actionItemUpdateSchema.safeParse({ status: "IN_PROGRESS" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status value", async () => {
    const { actionItemUpdateSchema } = await import("../../lib/validations/action-item");
    const result = actionItemUpdateSchema.safeParse({ status: "CLOSED" });
    expect(result.success).toBe(false);
  });

  it("accepts linkedChecklistId update", async () => {
    const { actionItemUpdateSchema } = await import("../../lib/validations/action-item");
    const result = actionItemUpdateSchema.safeParse({ linkedChecklistId: "cl-1" });
    expect(result.success).toBe(true);
  });
});

// --- GET /api/meetings/[meetingId]/actions ---

describe("GET /api/meetings/[meetingId]/actions", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import("../../app/api/meetings/[meetingId]/actions/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/meetings/m-1/actions") as never,
      { params: Promise.resolve({ meetingId: "m-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no orgId", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1", orgId: null, email: "a@test.com" });
    const { GET } = await import("../../app/api/meetings/[meetingId]/actions/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/meetings/m-1/actions") as never,
      { params: Promise.resolve({ meetingId: "m-1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when meeting not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockMeeting.findFirst.mockResolvedValue(null);
    const { GET } = await import("../../app/api/meetings/[meetingId]/actions/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/meetings/m-999/actions") as never,
      { params: Promise.resolve({ meetingId: "m-999" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns action items list", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockMeeting.findFirst.mockResolvedValue({ id: "m-1" });
    const fakeItems = [
      { id: "ai-1", meetingId: "m-1", description: "Follow up", status: "OPEN" },
    ];
    mockActionItem.findMany.mockResolvedValue(fakeItems);

    const { GET } = await import("../../app/api/meetings/[meetingId]/actions/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/meetings/m-1/actions") as never,
      { params: Promise.resolve({ meetingId: "m-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].description).toBe("Follow up");
  });
});

// --- POST /api/meetings/[meetingId]/actions ---

describe("POST /api/meetings/[meetingId]/actions", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 on missing description", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockMeeting.findFirst.mockResolvedValue({ id: "m-1" });
    const { POST } = await import("../../app/api/meetings/[meetingId]/actions/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m-1/actions", {}) as never,
      { params: Promise.resolve({ meetingId: "m-1" }) }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("creates action item and returns 201", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockMeeting.findFirst.mockResolvedValue({ id: "m-1" });
    const created = { id: "ai-1", meetingId: "m-1", description: "Send proposal", status: "OPEN" };
    mockActionItem.create.mockResolvedValue(created);

    const { POST } = await import("../../app/api/meetings/[meetingId]/actions/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m-1/actions", {
        description: "Send proposal",
      }) as never,
      { params: Promise.resolve({ meetingId: "m-1" }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.description).toBe("Send proposal");
  });
});

// --- PATCH /api/meetings/[meetingId]/actions/[actionId] ---

describe("PATCH /api/meetings/[meetingId]/actions/[actionId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 when action item not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockActionItem.findFirst.mockResolvedValue(null);
    const { PATCH } = await import("../../app/api/meetings/[meetingId]/actions/[actionId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/meetings/m-1/actions/ai-999", {
        status: "DONE",
      }) as never,
      { params: Promise.resolve({ meetingId: "m-1", actionId: "ai-999" }) }
    );
    expect(res.status).toBe(404);
  });

  it("updates action item status and returns 200", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockActionItem.findFirst.mockResolvedValue({ id: "ai-1" });
    const updated = { id: "ai-1", status: "IN_PROGRESS" };
    mockActionItem.update.mockResolvedValue(updated);

    const { PATCH } = await import("../../app/api/meetings/[meetingId]/actions/[actionId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/meetings/m-1/actions/ai-1", {
        status: "IN_PROGRESS",
      }) as never,
      { params: Promise.resolve({ meetingId: "m-1", actionId: "ai-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("IN_PROGRESS");
  });

  it("rejects invalid status value", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockActionItem.findFirst.mockResolvedValue({ id: "ai-1" });
    const { PATCH } = await import("../../app/api/meetings/[meetingId]/actions/[actionId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/meetings/m-1/actions/ai-1", {
        status: "INVALID",
      }) as never,
      { params: Promise.resolve({ meetingId: "m-1", actionId: "ai-1" }) }
    );
    expect(res.status).toBe(400);
  });
});

// --- DELETE /api/meetings/[meetingId]/actions/[actionId] ---

describe("DELETE /api/meetings/[meetingId]/actions/[actionId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 when action item not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockActionItem.findFirst.mockResolvedValue(null);
    const { DELETE } = await import("../../app/api/meetings/[meetingId]/actions/[actionId]/route");
    const res = await DELETE(
      makeRequest("DELETE", "http://localhost/api/meetings/m-1/actions/ai-999") as never,
      { params: Promise.resolve({ meetingId: "m-1", actionId: "ai-999" }) }
    );
    expect(res.status).toBe(404);
  });

  it("deletes action item and returns deleted: true", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockActionItem.findFirst.mockResolvedValue({ id: "ai-1" });
    mockActionItem.delete.mockResolvedValue({ id: "ai-1" });

    const { DELETE } = await import("../../app/api/meetings/[meetingId]/actions/[actionId]/route");
    const res = await DELETE(
      makeRequest("DELETE", "http://localhost/api/meetings/m-1/actions/ai-1") as never,
      { params: Promise.resolve({ meetingId: "m-1", actionId: "ai-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deleted).toBe(true);
    expect(mockActionItem.delete).toHaveBeenCalledWith({ where: { id: "ai-1" } });
  });
});

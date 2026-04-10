import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockPrismaSchedule = {
  findMany: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    schedule: mockPrismaSchedule,
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

describe("scheduleCreateSchema", () => {
  it("accepts minimal valid input", async () => {
    const { scheduleCreateSchema } = await import("../../lib/validations/schedule");
    const result = scheduleCreateSchema.safeParse({
      title: "Q3 Deadline",
      type: "DEADLINE",
      startDate: "2024-09-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reminderDays).toEqual([7, 3, 1]);
      expect(result.data.isAllDay).toBe(false);
    }
  });

  it("rejects missing title", async () => {
    const { scheduleCreateSchema } = await import("../../lib/validations/schedule");
    const result = scheduleCreateSchema.safeParse({
      type: "DEADLINE",
      startDate: "2024-09-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing type", async () => {
    const { scheduleCreateSchema } = await import("../../lib/validations/schedule");
    const result = scheduleCreateSchema.safeParse({
      title: "Meeting",
      startDate: "2024-09-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", async () => {
    const { scheduleCreateSchema } = await import("../../lib/validations/schedule");
    const result = scheduleCreateSchema.safeParse({
      title: "Meeting",
      type: "INVALID",
      startDate: "2024-09-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid types", async () => {
    const { scheduleCreateSchema } = await import("../../lib/validations/schedule");
    for (const type of ["DEADLINE", "MEETING", "REMINDER", "PROGRAM_DUE"]) {
      const result = scheduleCreateSchema.safeParse({
        title: "Test",
        type,
        startDate: "2024-09-01T00:00:00.000Z",
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts optional fields", async () => {
    const { scheduleCreateSchema } = await import("../../lib/validations/schedule");
    const result = scheduleCreateSchema.safeParse({
      title: "Q3 Review",
      type: "MEETING",
      startDate: "2024-09-01T10:00:00.000Z",
      endDate: "2024-09-01T11:00:00.000Z",
      isAllDay: true,
      reminderDays: [1, 3],
      clientId: "c-1",
      projectId: "p-1",
    });
    expect(result.success).toBe(true);
  });
});

describe("scheduleQuerySchema", () => {
  it("accepts empty params with defaults", async () => {
    const { scheduleQuerySchema } = await import("../../lib/validations/schedule");
    const result = scheduleQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("accepts valid filter params", async () => {
    const { scheduleQuerySchema } = await import("../../lib/validations/schedule");
    const result = scheduleQuerySchema.safeParse({
      type: "DEADLINE",
      clientId: "c-1",
      startDateFrom: "2024-01-01T00:00:00.000Z",
      startDateTo: "2024-12-31T23:59:59.000Z",
    });
    expect(result.success).toBe(true);
  });
});

// --- GET /api/schedules ---

describe("GET /api/schedules", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import("../../app/api/schedules/route");
    const res = await GET(makeRequest("GET", "http://localhost/api/schedules") as never);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no orgId", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1", orgId: null, email: "a@test.com" });
    const { GET } = await import("../../app/api/schedules/route");
    const res = await GET(makeRequest("GET", "http://localhost/api/schedules") as never);
    expect(res.status).toBe(403);
  });

  it("returns paginated schedule list", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const fakeSchedules = [{ id: "s-1", title: "Deadline A", type: "DEADLINE" }];
    mockPrismaSchedule.findMany.mockResolvedValue(fakeSchedules);
    mockPrismaSchedule.count.mockResolvedValue(1);

    const { GET } = await import("../../app/api/schedules/route");
    const res = await GET(makeRequest("GET", "http://localhost/api/schedules") as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ data: fakeSchedules, total: 1, page: 1, pageSize: 20 });
  });

  it("filters by type and clientId", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaSchedule.findMany.mockResolvedValue([]);
    mockPrismaSchedule.count.mockResolvedValue(0);

    const { GET } = await import("../../app/api/schedules/route");
    const res = await GET(
      makeRequest(
        "GET",
        "http://localhost/api/schedules?type=DEADLINE&clientId=c-1"
      ) as never
    );
    expect(res.status).toBe(200);
    expect(mockPrismaSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: "org-1",
          type: "DEADLINE",
          clientId: "c-1",
        }),
      })
    );
  });
});

// --- POST /api/schedules ---

describe("POST /api/schedules", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import("../../app/api/schedules/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/schedules", {
        title: "Test",
        type: "DEADLINE",
        startDate: "2024-09-01T00:00:00.000Z",
      }) as never
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 on missing required fields", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const { POST } = await import("../../app/api/schedules/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/schedules", { type: "DEADLINE" }) as never
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("creates schedule and returns 201", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const created = {
      id: "s-1",
      orgId: "org-1",
      title: "Q3 Deadline",
      type: "DEADLINE",
      startDate: new Date("2024-09-01T00:00:00.000Z"),
      isAllDay: false,
      reminderDays: [7, 3, 1],
    };
    mockPrismaSchedule.create.mockResolvedValue(created);

    const { POST } = await import("../../app/api/schedules/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/schedules", {
        title: "Q3 Deadline",
        type: "DEADLINE",
        startDate: "2024-09-01T00:00:00.000Z",
      }) as never
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toMatchObject({ id: "s-1", title: "Q3 Deadline" });
  });
});

// --- GET /api/schedules/[scheduleId] ---

describe("GET /api/schedules/[scheduleId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 when schedule not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaSchedule.findFirst.mockResolvedValue(null);

    const { GET } = await import("../../app/api/schedules/[scheduleId]/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/schedules/s-999") as never,
      { params: Promise.resolve({ scheduleId: "s-999" }) }
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns schedule with relations", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const fakeSchedule = {
      id: "s-1",
      title: "Q3 Deadline",
      type: "DEADLINE",
      client: { id: "c-1", name: "ACME Corp" },
      program: null,
    };
    mockPrismaSchedule.findFirst.mockResolvedValue(fakeSchedule);

    const { GET } = await import("../../app/api/schedules/[scheduleId]/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/schedules/s-1") as never,
      { params: Promise.resolve({ scheduleId: "s-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.client.name).toBe("ACME Corp");
  });
});

// --- PATCH /api/schedules/[scheduleId] ---

describe("PATCH /api/schedules/[scheduleId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 if schedule not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaSchedule.findFirst.mockResolvedValue(null);

    const { PATCH } = await import("../../app/api/schedules/[scheduleId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/schedules/s-x", { title: "Updated" }) as never,
      { params: Promise.resolve({ scheduleId: "s-x" }) }
    );
    expect(res.status).toBe(404);
  });

  it("updates schedule and returns 200", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaSchedule.findFirst.mockResolvedValue({ id: "s-1" });
    const updated = { id: "s-1", title: "Updated Title" };
    mockPrismaSchedule.update.mockResolvedValue(updated);

    const { PATCH } = await import("../../app/api/schedules/[scheduleId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/schedules/s-1", { title: "Updated Title" }) as never,
      { params: Promise.resolve({ scheduleId: "s-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.title).toBe("Updated Title");
  });
});

// --- DELETE /api/schedules/[scheduleId] ---

describe("DELETE /api/schedules/[scheduleId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 if schedule not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaSchedule.findFirst.mockResolvedValue(null);

    const { DELETE } = await import("../../app/api/schedules/[scheduleId]/route");
    const res = await DELETE(
      makeRequest("DELETE", "http://localhost/api/schedules/s-x") as never,
      { params: Promise.resolve({ scheduleId: "s-x" }) }
    );
    expect(res.status).toBe(404);
  });

  it("deletes schedule and returns deleted: true", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaSchedule.findFirst.mockResolvedValue({ id: "s-1" });
    mockPrismaSchedule.delete.mockResolvedValue({ id: "s-1" });

    const { DELETE } = await import("../../app/api/schedules/[scheduleId]/route");
    const res = await DELETE(
      makeRequest("DELETE", "http://localhost/api/schedules/s-1") as never,
      { params: Promise.resolve({ scheduleId: "s-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deleted).toBe(true);
    expect(mockPrismaSchedule.delete).toHaveBeenCalled();
  });
});

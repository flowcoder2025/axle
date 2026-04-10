import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockMeetingOps = {
  findMany: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockAttendeeOps = {
  create: vi.fn(),
  findFirst: vi.fn(),
  delete: vi.fn(),
};

const mockClientOps = {
  findFirst: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    meeting: mockMeetingOps,
    meetingAttendee: mockAttendeeOps,
    client: mockClientOps,
  },
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

describe("meetingCreateSchema", () => {
  it("accepts minimal valid input", async () => {
    const { meetingCreateSchema } = await import("../../lib/validations/meeting");
    const result = meetingCreateSchema.safeParse({
      title: "Kick-off Meeting",
      clientId: "client-1",
      date: "2025-03-01T10:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing title", async () => {
    const { meetingCreateSchema } = await import("../../lib/validations/meeting");
    const result = meetingCreateSchema.safeParse({
      clientId: "client-1",
      date: "2025-03-01T10:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing clientId", async () => {
    const { meetingCreateSchema } = await import("../../lib/validations/meeting");
    const result = meetingCreateSchema.safeParse({
      title: "Meeting",
      date: "2025-03-01T10:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format", async () => {
    const { meetingCreateSchema } = await import("../../lib/validations/meeting");
    const result = meetingCreateSchema.safeParse({
      title: "Meeting",
      clientId: "client-1",
      date: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional projectId and location", async () => {
    const { meetingCreateSchema } = await import("../../lib/validations/meeting");
    const result = meetingCreateSchema.safeParse({
      title: "Meeting",
      clientId: "client-1",
      date: "2025-03-01T10:00:00.000Z",
      projectId: "proj-1",
      location: "Conference Room A",
    });
    expect(result.success).toBe(true);
  });

  it("accepts attendees array", async () => {
    const { meetingCreateSchema } = await import("../../lib/validations/meeting");
    const result = meetingCreateSchema.safeParse({
      title: "Meeting",
      clientId: "client-1",
      date: "2025-03-01T10:00:00.000Z",
      attendees: [{ name: "Alice", role: "Host" }],
    });
    expect(result.success).toBe(true);
  });
});

describe("meetingQuerySchema", () => {
  it("applies defaults when params are absent", async () => {
    const { meetingQuerySchema } = await import("../../lib/validations/meeting");
    const result = meetingQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("coerces string page/pageSize", async () => {
    const { meetingQuerySchema } = await import("../../lib/validations/meeting");
    const result = meetingQuerySchema.safeParse({ page: "3", pageSize: "10" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.pageSize).toBe(10);
    }
  });
});

describe("attendeeSchema", () => {
  it("accepts minimal attendee (name only)", async () => {
    const { attendeeSchema } = await import("../../lib/validations/meeting");
    const result = attendeeSchema.safeParse({ name: "Bob" });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", async () => {
    const { attendeeSchema } = await import("../../lib/validations/meeting");
    const result = attendeeSchema.safeParse({ role: "Guest" });
    expect(result.success).toBe(false);
  });
});

// --- GET /api/meetings ---

describe("GET /api/meetings", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import("../../app/api/meetings/route");
    const res = await GET(makeRequest("GET", "http://localhost/api/meetings") as never);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no orgId", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1", orgId: null, email: "a@test.com" } as never);
    const { GET } = await import("../../app/api/meetings/route");
    const res = await GET(makeRequest("GET", "http://localhost/api/meetings") as never);
    expect(res.status).toBe(403);
  });

  it("returns paginated meetings", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findMany.mockResolvedValue([
      { id: "m1", title: "Meeting 1", date: new Date("2025-03-01"), _count: { attendees: 2 } },
    ]);
    mockMeetingOps.count.mockResolvedValue(1);

    const { GET } = await import("../../app/api/meetings/route");
    const res = await GET(makeRequest("GET", "http://localhost/api/meetings") as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// --- POST /api/meetings ---

describe("POST /api/meetings", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import("../../app/api/meetings/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings", {
        title: "Meeting",
        clientId: "c1",
        date: "2025-03-01T10:00:00.000Z",
      }) as never
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 on missing required fields", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    const { POST } = await import("../../app/api/meetings/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings", { title: "Meeting" }) as never
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when client not in org", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockClientOps.findFirst.mockResolvedValue(null);
    const { POST } = await import("../../app/api/meetings/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings", {
        title: "Meeting",
        clientId: "c-other",
        date: "2025-03-01T10:00:00.000Z",
      }) as never
    );
    expect(res.status).toBe(404);
  });

  it("creates meeting and returns 201", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockClientOps.findFirst.mockResolvedValue({ id: "c1" });
    const created = {
      id: "m1",
      title: "Meeting",
      date: new Date("2025-03-01T10:00:00.000Z"),
      attendees: [],
      _count: { attendees: 0 },
    };
    mockMeetingOps.create.mockResolvedValue(created);
    const { POST } = await import("../../app/api/meetings/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings", {
        title: "Meeting",
        clientId: "c1",
        date: "2025-03-01T10:00:00.000Z",
      }) as never
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("m1");
  });
});

// --- GET /api/meetings/[meetingId] ---

describe("GET /api/meetings/[meetingId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import("../../app/api/meetings/[meetingId]/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/meetings/m1") as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when meeting not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue(null);
    const { GET } = await import("../../app/api/meetings/[meetingId]/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/meetings/m1") as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns meeting with attendees, transcript, actionItems", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue({
      id: "m1",
      title: "Meeting",
      attendees: [],
      transcript: null,
      actionItems: [],
    });
    const { GET } = await import("../../app/api/meetings/[meetingId]/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/meetings/m1") as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("m1");
  });
});

// --- PATCH /api/meetings/[meetingId] ---

describe("PATCH /api/meetings/[meetingId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 when meeting not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue(null);
    const { PATCH } = await import("../../app/api/meetings/[meetingId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/meetings/m1", { title: "Updated" }) as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("updates meeting and returns 200", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue({ id: "m1" });
    mockMeetingOps.update.mockResolvedValue({ id: "m1", title: "Updated" });
    const { PATCH } = await import("../../app/api/meetings/[meetingId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/meetings/m1", { title: "Updated" }) as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(200);
  });
});

// --- DELETE /api/meetings/[meetingId] ---

describe("DELETE /api/meetings/[meetingId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 when meeting not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue(null);
    const { DELETE } = await import("../../app/api/meetings/[meetingId]/route");
    const res = await DELETE(
      makeRequest("DELETE", "http://localhost/api/meetings/m1") as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("deletes meeting and returns 200", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue({ id: "m1" });
    mockMeetingOps.delete.mockResolvedValue({ id: "m1" });
    const { DELETE } = await import("../../app/api/meetings/[meetingId]/route");
    const res = await DELETE(
      makeRequest("DELETE", "http://localhost/api/meetings/m1") as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deleted).toBe(true);
  });
});

// --- POST /api/meetings/[meetingId]/attendees ---

describe("POST /api/meetings/[meetingId]/attendees", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import("../../app/api/meetings/[meetingId]/attendees/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m1/attendees", { name: "Alice" }) as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when meeting not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue(null);
    const { POST } = await import("../../app/api/meetings/[meetingId]/attendees/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m1/attendees", { name: "Alice" }) as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when name is missing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue({ id: "m1" });
    const { POST } = await import("../../app/api/meetings/[meetingId]/attendees/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m1/attendees", { role: "Guest" }) as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("creates attendee and returns 201", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue({ id: "m1" });
    mockAttendeeOps.create.mockResolvedValue({ id: "a1", meetingId: "m1", name: "Alice" });
    const { POST } = await import("../../app/api/meetings/[meetingId]/attendees/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m1/attendees", { name: "Alice" }) as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe("Alice");
  });
});

// --- DELETE /api/meetings/[meetingId]/attendees ---

describe("DELETE /api/meetings/[meetingId]/attendees", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 when attendeeId missing from body", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue({ id: "m1" });
    const { DELETE } = await import("../../app/api/meetings/[meetingId]/attendees/route");
    const res = await DELETE(
      makeRequest("DELETE", "http://localhost/api/meetings/m1/attendees", {}) as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when attendee not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue({ id: "m1" });
    mockAttendeeOps.findFirst.mockResolvedValue(null);
    const { DELETE } = await import("../../app/api/meetings/[meetingId]/attendees/route");
    const res = await DELETE(
      makeRequest("DELETE", "http://localhost/api/meetings/m1/attendees", { attendeeId: "a99" }) as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("deletes attendee and returns 200", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue({ id: "m1" });
    mockAttendeeOps.findFirst.mockResolvedValue({ id: "a1" });
    mockAttendeeOps.delete.mockResolvedValue({ id: "a1" });
    const { DELETE } = await import("../../app/api/meetings/[meetingId]/attendees/route");
    const res = await DELETE(
      makeRequest("DELETE", "http://localhost/api/meetings/m1/attendees", { attendeeId: "a1" }) as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deleted).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockPrismaProgram = {
  findMany: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockPrismaSchedule = {
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    programInfo: mockPrismaProgram,
    schedule: mockPrismaSchedule,
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        programInfo: mockPrismaProgram,
        schedule: mockPrismaSchedule,
      };
      return fn(tx);
    }),
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

describe("programCreateSchema", () => {
  it("accepts minimal valid input", async () => {
    const { programCreateSchema } = await import("../../lib/validations/program");
    const result = programCreateSchema.safeParse({ name: "청년 창업 지원", category: "STARTUP" });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", async () => {
    const { programCreateSchema } = await import("../../lib/validations/program");
    const result = programCreateSchema.safeParse({ category: "STARTUP" });
    expect(result.success).toBe(false);
  });

  it("rejects missing category", async () => {
    const { programCreateSchema } = await import("../../lib/validations/program");
    const result = programCreateSchema.safeParse({ name: "Some Program" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid category", async () => {
    const { programCreateSchema } = await import("../../lib/validations/program");
    const result = programCreateSchema.safeParse({ name: "Program", category: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("accepts all optional fields", async () => {
    const { programCreateSchema } = await import("../../lib/validations/program");
    const result = programCreateSchema.safeParse({
      name: "R&D 과제",
      category: "RND",
      agency: "중소벤처기업부",
      announcementUrl: "https://example.com/notice",
      applicationStart: "2025-01-01T00:00:00.000Z",
      applicationEnd: "2025-03-31T23:59:59.000Z",
      maxFunding: 100000000,
      region: "서울",
      memo: "중요한 과제",
    });
    expect(result.success).toBe(true);
  });
});

describe("programQuerySchema", () => {
  it("accepts empty params with defaults", async () => {
    const { programQuerySchema } = await import("../../lib/validations/program");
    const result = programQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("transforms hasDeadline string to boolean", async () => {
    const { programQuerySchema } = await import("../../lib/validations/program");
    const result = programQuerySchema.safeParse({ hasDeadline: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hasDeadline).toBe(true);
    }
  });

  it("accepts category and region filters", async () => {
    const { programQuerySchema } = await import("../../lib/validations/program");
    const result = programQuerySchema.safeParse({ category: "STARTUP", region: "서울" });
    expect(result.success).toBe(true);
  });
});

// --- GET /api/programs ---

describe("GET /api/programs", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import("../../app/api/programs/route");
    const res = await GET(makeRequest("GET", "http://localhost/api/programs") as never);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no orgId", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1", orgId: null, email: "a@test.com" });
    const { GET } = await import("../../app/api/programs/route");
    const res = await GET(makeRequest("GET", "http://localhost/api/programs") as never);
    expect(res.status).toBe(403);
  });

  it("returns paginated program list", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const fakePrograms = [{ id: "prog-1", name: "청년 창업", category: "STARTUP" }];
    mockPrismaProgram.findMany.mockResolvedValue(fakePrograms);
    mockPrismaProgram.count.mockResolvedValue(1);

    const { GET } = await import("../../app/api/programs/route");
    const res = await GET(makeRequest("GET", "http://localhost/api/programs") as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ data: fakePrograms, total: 1, page: 1, pageSize: 20 });
  });

  it("filters by category", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProgram.findMany.mockResolvedValue([]);
    mockPrismaProgram.count.mockResolvedValue(0);

    const { GET } = await import("../../app/api/programs/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/programs?category=STARTUP") as never
    );
    expect(res.status).toBe(200);
    expect(mockPrismaProgram.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: "STARTUP" }),
      })
    );
  });

  it("filters by hasDeadline=true", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProgram.findMany.mockResolvedValue([]);
    mockPrismaProgram.count.mockResolvedValue(0);

    const { GET } = await import("../../app/api/programs/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/programs?hasDeadline=true") as never
    );
    expect(res.status).toBe(200);
    expect(mockPrismaProgram.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ applicationEnd: { not: null } }),
      })
    );
  });

  it("includes crawled platform programs (orgId=null) alongside org programs", async () => {
    // WI-229 regression: before this, crawled programs were invisible because
    // the filter was strict orgId=user.orgId. They should now match via OR.
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProgram.findMany.mockResolvedValue([]);
    mockPrismaProgram.count.mockResolvedValue(0);

    const { GET } = await import("../../app/api/programs/route");
    await GET(makeRequest("GET", "http://localhost/api/programs") as never);

    expect(mockPrismaProgram.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ orgId: "org-1" }, { orgId: null }],
        }),
      })
    );
  });
});

// --- POST /api/programs ---

describe("POST /api/programs", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import("../../app/api/programs/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/programs", {
        name: "청년 창업",
        category: "STARTUP",
      }) as never
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 on missing required fields", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const { POST } = await import("../../app/api/programs/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/programs", { category: "STARTUP" }) as never
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("creates program without applicationEnd and no schedule", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const created = { id: "prog-1", name: "벤처 지원", category: "VENTURE", applicationEnd: null };
    mockPrismaProgram.create.mockResolvedValue(created);

    const { POST } = await import("../../app/api/programs/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/programs", {
        name: "벤처 지원",
        category: "VENTURE",
      }) as never
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toMatchObject(created);
    expect(mockPrismaSchedule.create).not.toHaveBeenCalled();
  });

  it("creates program with applicationEnd and auto-creates PROGRAM_DUE schedule", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const created = {
      id: "prog-1",
      name: "R&D 과제",
      category: "RND",
      applicationEnd: new Date("2025-03-31T23:59:59.000Z"),
    };
    mockPrismaProgram.create.mockResolvedValue(created);
    mockPrismaSchedule.create.mockResolvedValue({ id: "sch-1" });

    const { POST } = await import("../../app/api/programs/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/programs", {
        name: "R&D 과제",
        category: "RND",
        applicationEnd: "2025-03-31T23:59:59.000Z",
      }) as never
    );
    expect(res.status).toBe(201);
    expect(mockPrismaSchedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId: "org-1",
          programId: "prog-1",
          type: "PROGRAM_DUE",
          reminderDays: [30, 14, 7, 3, 1],
        }),
      })
    );
  });
});

// --- GET /api/programs/[programId] ---

describe("GET /api/programs/[programId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 when program not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProgram.findFirst.mockResolvedValue(null);

    const { GET } = await import("../../app/api/programs/[programId]/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/programs/prog-999") as never,
      { params: Promise.resolve({ programId: "prog-999" }) }
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns program with schedules and matchingResults count", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const fakeProgram = {
      id: "prog-1",
      name: "청년 창업",
      category: "STARTUP",
      schedules: [{ id: "sch-1", type: "PROGRAM_DUE", startDate: new Date("2025-03-31") }],
      _count: { matchingResults: 5 },
    };
    mockPrismaProgram.findFirst.mockResolvedValue(fakeProgram);

    const { GET } = await import("../../app/api/programs/[programId]/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/programs/prog-1") as never,
      { params: Promise.resolve({ programId: "prog-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data._count.matchingResults).toBe(5);
    expect(body.data.schedules).toHaveLength(1);
  });
});

// --- PATCH /api/programs/[programId] ---

describe("PATCH /api/programs/[programId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 if program not in org", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProgram.findFirst.mockResolvedValue(null);

    const { PATCH } = await import("../../app/api/programs/[programId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/programs/prog-x", { name: "Updated" }) as never,
      { params: Promise.resolve({ programId: "prog-x" }) }
    );
    expect(res.status).toBe(404);
  });

  it("updates program without applicationEnd change — no schedule sync", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProgram.findFirst.mockResolvedValue({
      id: "prog-1",
      name: "Old Name",
      applicationEnd: null,
    });
    const updated = { id: "prog-1", name: "New Name" };
    mockPrismaProgram.update.mockResolvedValue(updated);

    const { PATCH } = await import("../../app/api/programs/[programId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/programs/prog-1", { name: "New Name" }) as never,
      { params: Promise.resolve({ programId: "prog-1" }) }
    );
    expect(res.status).toBe(200);
    expect(mockPrismaSchedule.create).not.toHaveBeenCalled();
    expect(mockPrismaSchedule.update).not.toHaveBeenCalled();
  });

  it("updates schedule when applicationEnd is provided and schedule exists", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProgram.findFirst.mockResolvedValue({
      id: "prog-1",
      name: "R&D",
      applicationEnd: new Date("2025-01-31"),
    });
    mockPrismaProgram.update.mockResolvedValue({ id: "prog-1", name: "R&D" });
    mockPrismaSchedule.findFirst.mockResolvedValue({ id: "sch-1" });
    mockPrismaSchedule.update.mockResolvedValue({ id: "sch-1" });

    const { PATCH } = await import("../../app/api/programs/[programId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/programs/prog-1", {
        applicationEnd: "2025-03-31T23:59:59.000Z",
      }) as never,
      { params: Promise.resolve({ programId: "prog-1" }) }
    );
    expect(res.status).toBe(200);
    expect(mockPrismaSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sch-1" },
        data: expect.objectContaining({ startDate: new Date("2025-03-31T23:59:59.000Z") }),
      })
    );
  });

  it("creates schedule when applicationEnd is set and no schedule exists", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProgram.findFirst.mockResolvedValue({
      id: "prog-1",
      name: "STARTUP",
      applicationEnd: null,
    });
    mockPrismaProgram.update.mockResolvedValue({ id: "prog-1", name: "STARTUP" });
    mockPrismaSchedule.findFirst.mockResolvedValue(null);
    mockPrismaSchedule.create.mockResolvedValue({ id: "sch-new" });

    const { PATCH } = await import("../../app/api/programs/[programId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/programs/prog-1", {
        applicationEnd: "2025-06-30T23:59:59.000Z",
      }) as never,
      { params: Promise.resolve({ programId: "prog-1" }) }
    );
    expect(res.status).toBe(200);
    expect(mockPrismaSchedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "PROGRAM_DUE",
          reminderDays: [30, 14, 7, 3, 1],
        }),
      })
    );
  });

  it("deletes schedule when applicationEnd is set to null", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProgram.findFirst.mockResolvedValue({
      id: "prog-1",
      name: "RND",
      applicationEnd: new Date("2025-03-31"),
    });
    mockPrismaProgram.update.mockResolvedValue({ id: "prog-1", name: "RND" });
    mockPrismaSchedule.findFirst.mockResolvedValue({ id: "sch-1" });
    mockPrismaSchedule.delete.mockResolvedValue({ id: "sch-1" });

    const { PATCH } = await import("../../app/api/programs/[programId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/programs/prog-1", {
        applicationEnd: null,
      }) as never,
      { params: Promise.resolve({ programId: "prog-1" }) }
    );
    expect(res.status).toBe(200);
    expect(mockPrismaSchedule.delete).toHaveBeenCalledWith({ where: { id: "sch-1" } });
  });
});

// --- DELETE /api/programs/[programId] ---

describe("DELETE /api/programs/[programId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 if program not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProgram.findFirst.mockResolvedValue(null);

    const { DELETE } = await import("../../app/api/programs/[programId]/route");
    const res = await DELETE(
      makeRequest("DELETE", "http://localhost/api/programs/prog-x") as never,
      { params: Promise.resolve({ programId: "prog-x" }) }
    );
    expect(res.status).toBe(404);
  });

  it("deletes program and associated schedules, returns deleted: true", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProgram.findFirst.mockResolvedValue({ id: "prog-1" });
    mockPrismaSchedule.deleteMany.mockResolvedValue({ count: 1 });
    mockPrismaProgram.delete.mockResolvedValue({ id: "prog-1" });

    const { DELETE } = await import("../../app/api/programs/[programId]/route");
    const res = await DELETE(
      makeRequest("DELETE", "http://localhost/api/programs/prog-1") as never,
      { params: Promise.resolve({ programId: "prog-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deleted).toBe(true);
    expect(mockPrismaSchedule.deleteMany).toHaveBeenCalledWith({ where: { programId: "prog-1" } });
    expect(mockPrismaProgram.delete).toHaveBeenCalledWith({ where: { id: "prog-1" } });
  });
});

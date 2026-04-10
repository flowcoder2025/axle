import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockPrismaProject = {
  findMany: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockPrismaClient = {
  findFirst: vi.fn(),
};

const mockPrismaChecklistTemplate = {
  findMany: vi.fn(),
};

const mockPrismaChecklistItem = {
  createMany: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    project: mockPrismaProject,
    client: mockPrismaClient,
    checklistTemplate: mockPrismaChecklistTemplate,
    checklistItem: mockPrismaChecklistItem,
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        project: mockPrismaProject,
        client: mockPrismaClient,
        checklistTemplate: mockPrismaChecklistTemplate,
        checklistItem: mockPrismaChecklistItem,
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

describe("projectCreateSchema", () => {
  it("accepts minimal valid input", async () => {
    const { projectCreateSchema } = await import("../../lib/validations/project");
    const result = projectCreateSchema.safeParse({
      clientId: "client-1",
      type: "BUSINESS_PLAN",
      title: "My Project",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing clientId", async () => {
    const { projectCreateSchema } = await import("../../lib/validations/project");
    const result = projectCreateSchema.safeParse({
      type: "BUSINESS_PLAN",
      title: "My Project",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing title", async () => {
    const { projectCreateSchema } = await import("../../lib/validations/project");
    const result = projectCreateSchema.safeParse({
      clientId: "client-1",
      type: "BUSINESS_PLAN",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid project type", async () => {
    const { projectCreateSchema } = await import("../../lib/validations/project");
    const result = projectCreateSchema.safeParse({
      clientId: "client-1",
      type: "INVALID_TYPE",
      title: "My Project",
    });
    expect(result.success).toBe(false);
  });

  it("accepts fee fields", async () => {
    const { projectCreateSchema } = await import("../../lib/validations/project");
    const result = projectCreateSchema.safeParse({
      clientId: "client-1",
      type: "BUSINESS_PLAN",
      title: "My Project",
      feeType: "FIXED",
      feeAmount: 1000000,
      successRate: 30,
      isPaid: false,
    });
    expect(result.success).toBe(true);
  });
});

describe("projectSearchSchema", () => {
  it("accepts empty params with defaults", async () => {
    const { projectSearchSchema } = await import("../../lib/validations/project");
    const result = projectSearchSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("accepts valid filter params", async () => {
    const { projectSearchSchema } = await import("../../lib/validations/project");
    const result = projectSearchSchema.safeParse({
      clientId: "client-1",
      type: "BUSINESS_PLAN",
      status: "IN_PROGRESS",
    });
    expect(result.success).toBe(true);
  });
});

// --- GET /api/projects ---

describe("GET /api/projects", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import("../../app/api/projects/route");
    const res = await GET(makeRequest("GET", "http://localhost/api/projects") as never);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no orgId", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1", orgId: null, email: "a@test.com" });
    const { GET } = await import("../../app/api/projects/route");
    const res = await GET(makeRequest("GET", "http://localhost/api/projects") as never);
    expect(res.status).toBe(403);
  });

  it("returns paginated project list", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const fakeProjects = [{ id: "p-1", title: "Project A" }];
    mockPrismaProject.findMany.mockResolvedValue(fakeProjects);
    mockPrismaProject.count.mockResolvedValue(1);

    const { GET } = await import("../../app/api/projects/route");
    const res = await GET(makeRequest("GET", "http://localhost/api/projects") as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ data: fakeProjects, total: 1, page: 1, pageSize: 20 });
  });

  it("filters by clientId, type, status, assignedTo", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findMany.mockResolvedValue([]);
    mockPrismaProject.count.mockResolvedValue(0);

    const { GET } = await import("../../app/api/projects/route");
    const res = await GET(
      makeRequest(
        "GET",
        "http://localhost/api/projects?clientId=c-1&type=BUSINESS_PLAN&status=IN_PROGRESS&assignedTo=user-2"
      ) as never
    );
    expect(res.status).toBe(200);
    expect(mockPrismaProject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clientId: "c-1",
          type: "BUSINESS_PLAN",
          status: "IN_PROGRESS",
          assignedTo: "user-2",
        }),
      })
    );
  });
});

// --- POST /api/projects ---

describe("POST /api/projects", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import("../../app/api/projects/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/projects", {
        clientId: "c-1",
        type: "BUSINESS_PLAN",
        title: "Test",
      }) as never
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 on missing required fields", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const { POST } = await import("../../app/api/projects/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/projects", { type: "BUSINESS_PLAN" }) as never
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 if client not found in org", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaClient.findFirst.mockResolvedValue(null);

    const { POST } = await import("../../app/api/projects/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/projects", {
        clientId: "c-unknown",
        type: "BUSINESS_PLAN",
        title: "Test Project",
      }) as never
    );
    expect(res.status).toBe(404);
  });

  it("creates project and returns 201", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaClient.findFirst.mockResolvedValue({ id: "c-1" });
    const created = { id: "p-1", title: "Test Project", type: "BUSINESS_PLAN" };
    mockPrismaProject.create.mockResolvedValue(created);
    mockPrismaChecklistTemplate.findMany.mockResolvedValue([]);

    const { POST } = await import("../../app/api/projects/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/projects", {
        clientId: "c-1",
        type: "BUSINESS_PLAN",
        title: "Test Project",
      }) as never
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toMatchObject(created);
  });

  it("auto-applies checklist templates on project creation", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaClient.findFirst.mockResolvedValue({ id: "c-1" });
    const created = { id: "p-1", title: "Test Project", type: "BUSINESS_PLAN" };
    mockPrismaProject.create.mockResolvedValue(created);

    const templates = [
      { id: "tpl-1", name: "사업계획서 초안", description: null, isRequired: true, sortOrder: 0 },
      { id: "tpl-2", name: "법인등기부등본", description: "최근 3개월", isRequired: true, sortOrder: 1 },
    ];
    mockPrismaChecklistTemplate.findMany.mockResolvedValue(templates);
    mockPrismaChecklistItem.createMany.mockResolvedValue({ count: 2 });

    const { POST } = await import("../../app/api/projects/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/projects", {
        clientId: "c-1",
        type: "BUSINESS_PLAN",
        title: "Test Project",
      }) as never
    );
    expect(res.status).toBe(201);
    expect(mockPrismaChecklistItem.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ projectId: "p-1", name: "사업계획서 초안" }),
        expect.objectContaining({ projectId: "p-1", name: "법인등기부등본" }),
      ]),
    });
  });

  it("creates project with fee fields", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaClient.findFirst.mockResolvedValue({ id: "c-1" });
    const created = {
      id: "p-1",
      title: "Fee Project",
      type: "BUSINESS_PLAN",
      feeType: "FIXED",
      feeAmount: 5000000,
      successRate: null,
      isPaid: false,
    };
    mockPrismaProject.create.mockResolvedValue(created);
    mockPrismaChecklistTemplate.findMany.mockResolvedValue([]);

    const { POST } = await import("../../app/api/projects/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/projects", {
        clientId: "c-1",
        type: "BUSINESS_PLAN",
        title: "Fee Project",
        feeType: "FIXED",
        feeAmount: 5000000,
        isPaid: false,
      }) as never
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.feeType).toBe("FIXED");
    expect(body.data.feeAmount).toBe(5000000);
  });
});

// --- GET /api/projects/[projectId] ---

describe("GET /api/projects/[projectId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 when project not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue(null);

    const { GET } = await import("../../app/api/projects/[projectId]/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/projects/p-999") as never,
      { params: Promise.resolve({ projectId: "p-999" }) }
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns project with members, checklist count, documents count, and client name", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const fakeProject = {
      id: "p-1",
      title: "Test",
      status: "INTAKE",
      client: { id: "c-1", name: "ACME Corp" },
      members: [{ id: "pm-1", userId: "user-2", role: "MEMBER" }],
      _count: { checklist: 3, documents: 2 },
    };
    mockPrismaProject.findFirst.mockResolvedValue(fakeProject);

    const { GET } = await import("../../app/api/projects/[projectId]/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/projects/p-1") as never,
      { params: Promise.resolve({ projectId: "p-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.client.name).toBe("ACME Corp");
    expect(body.data.members).toHaveLength(1);
    expect(body.data._count.checklist).toBe(3);
    expect(body.data._count.documents).toBe(2);
  });
});

// --- PATCH /api/projects/[projectId] ---

describe("PATCH /api/projects/[projectId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 if project not in org", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue(null);

    const { PATCH } = await import("../../app/api/projects/[projectId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/projects/p-x", { title: "Updated" }) as never,
      { params: Promise.resolve({ projectId: "p-x" }) }
    );
    expect(res.status).toBe(404);
  });

  it("updates project and returns 200", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue({ id: "p-1", clientId: "c-1" });
    const updated = { id: "p-1", title: "Updated Title" };
    mockPrismaProject.update.mockResolvedValue(updated);

    const { PATCH } = await import("../../app/api/projects/[projectId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/projects/p-1", { title: "Updated Title" }) as never,
      { params: Promise.resolve({ projectId: "p-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.title).toBe("Updated Title");
  });
});

// --- DELETE /api/projects/[projectId] ---

describe("DELETE /api/projects/[projectId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 if project not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue(null);

    const { DELETE } = await import("../../app/api/projects/[projectId]/route");
    const res = await DELETE(
      makeRequest("DELETE", "http://localhost/api/projects/p-x") as never,
      { params: Promise.resolve({ projectId: "p-x" }) }
    );
    expect(res.status).toBe(404);
  });

  it("deletes project and returns deleted: true", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue({ id: "p-1", clientId: "c-1" });
    mockPrismaProject.delete.mockResolvedValue({ id: "p-1" });

    const { DELETE } = await import("../../app/api/projects/[projectId]/route");
    const res = await DELETE(
      makeRequest("DELETE", "http://localhost/api/projects/p-1") as never,
      { params: Promise.resolve({ projectId: "p-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deleted).toBe(true);
    expect(mockPrismaProject.delete).toHaveBeenCalled();
  });
});

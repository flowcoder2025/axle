import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockPrismaClient = {
  findMany: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    client: mockPrismaClient,
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
}));

// Stub out the profile-generation side effect so it does not interfere with
// route tests. The service is tested separately in client-profile.test.ts.
vi.mock("../../lib/services/client-profile", () => ({
  generateMasterProfile: vi.fn().mockResolvedValue(undefined),
}));

// --- Helpers ---

import { getCurrentUser } from "@axle/auth";

const authedUser = { id: "user-1", orgId: "org-1", email: "a@test.com" };

function makeRequest(
  method: string,
  url: string,
  body?: unknown
): Request {
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

// --- Validation schema tests ---

describe("clientCreateSchema", () => {
  it("accepts minimal valid input (name only)", async () => {
    const { clientCreateSchema } = await import(
      "../../lib/validations/client"
    );
    const result = clientCreateSchema.safeParse({ name: "ACME Corp" });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", async () => {
    const { clientCreateSchema } = await import(
      "../../lib/validations/client"
    );
    const result = clientCreateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", async () => {
    const { clientCreateSchema } = await import(
      "../../lib/validations/client"
    );
    const result = clientCreateSchema.safeParse({
      name: "ACME",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty string for optional email (blank)", async () => {
    const { clientCreateSchema } = await import(
      "../../lib/validations/client"
    );
    const result = clientCreateSchema.safeParse({ name: "ACME", email: "" });
    expect(result.success).toBe(true);
  });
});

describe("clientSearchSchema", () => {
  it("coerces string page/pageSize to numbers", async () => {
    const { clientSearchSchema } = await import(
      "../../lib/validations/client"
    );
    const result = clientSearchSchema.safeParse({ page: "2", pageSize: "10" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.pageSize).toBe(10);
    }
  });

  it("applies defaults when params are absent", async () => {
    const { clientSearchSchema } = await import(
      "../../lib/validations/client"
    );
    const result = clientSearchSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
      expect(result.data.sortBy).toBe("createdAt");
      expect(result.data.sortOrder).toBe("desc");
    }
  });
});

// --- Route handler tests ---

describe("GET /api/clients", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import("../../app/api/clients/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/clients") as never
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 when user has no orgId", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      orgId: null,
      email: "a@test.com",
    });
    const { GET } = await import("../../app/api/clients/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/clients") as never
    );
    expect(res.status).toBe(403);
  });

  it("returns list response in correct shape", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const fakeClients = [{ id: "c-1", name: "ACME" }];
    mockPrismaClient.findMany.mockResolvedValue(fakeClients);
    mockPrismaClient.count.mockResolvedValue(1);

    const { GET } = await import("../../app/api/clients/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/clients") as never
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      data: fakeClients,
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });
});

describe("POST /api/clients", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 on missing name", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const { POST } = await import("../../app/api/clients/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/clients", {
        businessNumber: "123",
      }) as never
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("creates a client and returns 201", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const created = { id: "c-1", name: "ACME Corp", orgId: "org-1" };
    mockPrismaClient.create.mockResolvedValue(created);

    const { POST } = await import("../../app/api/clients/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/clients", {
        name: "ACME Corp",
      }) as never
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toMatchObject(created);
  });
});

describe("GET /api/clients/[clientId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 when client not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaClient.findFirst.mockResolvedValue(null);

    const { GET } = await import("../../app/api/clients/[clientId]/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/clients/c-999") as never,
      { params: Promise.resolve({ clientId: "c-999" }) }
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns client with contacts and project count", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const fakeClient = {
      id: "c-1",
      name: "ACME",
      contacts: [],
      _count: { projects: 3 },
    };
    mockPrismaClient.findFirst.mockResolvedValue(fakeClient);

    const { GET } = await import("../../app/api/clients/[clientId]/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/clients/c-1") as never,
      { params: Promise.resolve({ clientId: "c-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data._count.projects).toBe(3);
  });
});

describe("PATCH /api/clients/[clientId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 if client does not belong to org", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaClient.findFirst.mockResolvedValue(null);

    const { PATCH } = await import("../../app/api/clients/[clientId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/clients/c-x", {
        name: "Updated",
      }) as never,
      { params: Promise.resolve({ clientId: "c-x" }) }
    );
    expect(res.status).toBe(404);
  });

  it("updates client and returns 200 with data", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaClient.findFirst.mockResolvedValue({ id: "c-1" });
    const updated = { id: "c-1", name: "ACME Updated" };
    mockPrismaClient.update.mockResolvedValue(updated);

    const { PATCH } = await import("../../app/api/clients/[clientId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/clients/c-1", {
        name: "ACME Updated",
      }) as never,
      { params: Promise.resolve({ clientId: "c-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("ACME Updated");
  });
});

describe("DELETE /api/clients/[clientId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("soft-deletes by setting status to INACTIVE", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaClient.findFirst.mockResolvedValue({ id: "c-1" });
    const softDeleted = { id: "c-1", status: "INACTIVE" };
    mockPrismaClient.update.mockResolvedValue(softDeleted);

    const { DELETE } = await import("../../app/api/clients/[clientId]/route");
    const res = await DELETE(
      makeRequest("DELETE", "http://localhost/api/clients/c-1") as never,
      { params: Promise.resolve({ clientId: "c-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("INACTIVE");
    expect(mockPrismaClient.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "INACTIVE" } })
    );
  });

  it("hard-deletes when ?hard=true", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaClient.findFirst.mockResolvedValue({ id: "c-1" });
    mockPrismaClient.delete.mockResolvedValue({ id: "c-1" });

    const { DELETE } = await import("../../app/api/clients/[clientId]/route");
    const res = await DELETE(
      makeRequest(
        "DELETE",
        "http://localhost/api/clients/c-1?hard=true"
      ) as never,
      { params: Promise.resolve({ clientId: "c-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deleted).toBe(true);
    expect(mockPrismaClient.delete).toHaveBeenCalled();
  });
});

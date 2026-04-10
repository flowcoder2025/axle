/**
 * Tests for ClientAchievement CRUD API (WI-102)
 * /api/clients/[clientId]/achievements (GET, POST)
 * /api/clients/[clientId]/achievements/[achievementId] (GET, PATCH, DELETE)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockPrismaAchievement = {
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

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    client: mockPrismaClient,
    clientAchievement: mockPrismaAchievement,
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from "@axle/auth";

const authedUser = { id: "user-1", orgId: "org-1" };
const ACHIEVEMENT = {
  id: "ach-1",
  clientId: "client-1",
  type: "PATENT",
  title: "특허 등록",
  date: new Date("2024-03-01T00:00:00.000Z"),
  amount: null,
  description: "AI 기술 특허",
  documentId: null,
};

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
  mockPrismaClient.findFirst.mockResolvedValue({ id: "client-1" });
});

// ==========================================
// Validation schema tests
// ==========================================

describe("clientAchievementCreateSchema", () => {
  it("rejects missing type", async () => {
    const { clientAchievementCreateSchema } = await import(
      "../../lib/validations/achievement"
    );
    const result = clientAchievementCreateSchema.safeParse({ title: "특허" });
    expect(result.success).toBe(false);
  });

  it("rejects missing title", async () => {
    const { clientAchievementCreateSchema } = await import(
      "../../lib/validations/achievement"
    );
    const result = clientAchievementCreateSchema.safeParse({ type: "PATENT" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", async () => {
    const { clientAchievementCreateSchema } = await import(
      "../../lib/validations/achievement"
    );
    const result = clientAchievementCreateSchema.safeParse({
      type: "UNKNOWN",
      title: "test",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid types", async () => {
    const { clientAchievementCreateSchema } = await import(
      "../../lib/validations/achievement"
    );
    for (const type of ["PATENT", "AWARD", "CONTRACT", "INVESTMENT", "CERTIFICATION"]) {
      const result = clientAchievementCreateSchema.safeParse({ type, title: "test" });
      expect(result.success).toBe(true);
    }
  });
});

// ==========================================
// Collection routes
// ==========================================

describe("GET /api/clients/[clientId]/achievements", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/achievements/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/clients/client-1/achievements"
    );
    const res = await GET(req as never, {
      params: Promise.resolve({ clientId: "client-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns paginated achievements", async () => {
    mockPrismaAchievement.findMany.mockResolvedValue([ACHIEVEMENT]);
    mockPrismaAchievement.count.mockResolvedValue(1);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/achievements/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/clients/client-1/achievements"
    );
    const res = await GET(req as never, {
      params: Promise.resolve({ clientId: "client-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it("filters by type query param", async () => {
    mockPrismaAchievement.findMany.mockResolvedValue([ACHIEVEMENT]);
    mockPrismaAchievement.count.mockResolvedValue(1);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/achievements/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/clients/client-1/achievements?type=PATENT"
    );
    await GET(req as never, {
      params: Promise.resolve({ clientId: "client-1" }),
    });
    expect(mockPrismaAchievement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: "client-1", type: "PATENT" } })
    );
  });
});

describe("POST /api/clients/[clientId]/achievements", () => {
  it("returns 400 for missing required fields", async () => {
    const { POST } = await import(
      "../../app/api/clients/[clientId]/achievements/route"
    );
    const req = makeRequest(
      "POST",
      "http://localhost/api/clients/client-1/achievements",
      { type: "PATENT" }
    );
    const res = await POST(req as never, {
      params: Promise.resolve({ clientId: "client-1" }),
    });
    expect(res.status).toBe(400);
  });

  it("creates achievement and returns 201", async () => {
    mockPrismaAchievement.create.mockResolvedValue(ACHIEVEMENT);
    const { POST } = await import(
      "../../app/api/clients/[clientId]/achievements/route"
    );
    const req = makeRequest(
      "POST",
      "http://localhost/api/clients/client-1/achievements",
      { type: "PATENT", title: "특허 등록" }
    );
    const res = await POST(req as never, {
      params: Promise.resolve({ clientId: "client-1" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.type).toBe("PATENT");
  });
});

// ==========================================
// Item routes
// ==========================================

describe("GET /api/clients/[clientId]/achievements/[achievementId]", () => {
  it("returns single achievement", async () => {
    mockPrismaAchievement.findFirst.mockResolvedValue(ACHIEVEMENT);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/achievements/[achievementId]/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/clients/client-1/achievements/ach-1"
    );
    const res = await GET(req as never, {
      params: Promise.resolve({ clientId: "client-1", achievementId: "ach-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("ach-1");
  });

  it("returns 404 when not found", async () => {
    mockPrismaAchievement.findFirst.mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/achievements/[achievementId]/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/clients/client-1/achievements/ghost"
    );
    const res = await GET(req as never, {
      params: Promise.resolve({ clientId: "client-1", achievementId: "ghost" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/clients/[clientId]/achievements/[achievementId]", () => {
  it("updates and returns achievement", async () => {
    const updated = { ...ACHIEVEMENT, title: "특허 업데이트" };
    mockPrismaAchievement.findFirst.mockResolvedValue(ACHIEVEMENT);
    mockPrismaAchievement.update.mockResolvedValue(updated);
    const { PATCH } = await import(
      "../../app/api/clients/[clientId]/achievements/[achievementId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/clients/client-1/achievements/ach-1",
      { title: "특허 업데이트" }
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ clientId: "client-1", achievementId: "ach-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.title).toBe("특허 업데이트");
  });
});

describe("DELETE /api/clients/[clientId]/achievements/[achievementId]", () => {
  it("deletes achievement and returns 204", async () => {
    mockPrismaAchievement.findFirst.mockResolvedValue(ACHIEVEMENT);
    mockPrismaAchievement.delete.mockResolvedValue(ACHIEVEMENT);
    const { DELETE } = await import(
      "../../app/api/clients/[clientId]/achievements/[achievementId]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/clients/client-1/achievements/ach-1"
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({ clientId: "client-1", achievementId: "ach-1" }),
    });
    expect(res.status).toBe(204);
    expect(mockPrismaAchievement.delete).toHaveBeenCalledWith({
      where: { id: "ach-1" },
    });
  });

  it("returns 404 when not found", async () => {
    mockPrismaAchievement.findFirst.mockResolvedValue(null);
    const { DELETE } = await import(
      "../../app/api/clients/[clientId]/achievements/[achievementId]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/clients/client-1/achievements/ghost"
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({ clientId: "client-1", achievementId: "ghost" }),
    });
    expect(res.status).toBe(404);
  });
});

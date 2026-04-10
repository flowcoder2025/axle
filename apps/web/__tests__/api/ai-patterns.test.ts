import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockSkillPattern = {
  findMany: vi.fn(),
  count: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    skillPattern: mockSkillPattern,
  },
}));

vi.mock("@axle/auth", () => ({
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from "@axle/auth";

const authedUser = { id: "user-1", orgId: "org-1", email: "a@test.com" };

function makeRequest(method: string, url: string): Request {
  return new Request(url, { method });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ==================== GET /api/ai/patterns ====================

describe("GET /api/ai/patterns", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import("../../app/api/ai/patterns/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/ai/patterns") as any
    );
    expect(res.status).toBe(401);
  });

  it("returns pattern list with pagination and candidateCount", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);

    const fakePatterns = [
      {
        id: "pat-1",
        name: "Auto:SUMMARY",
        taskType: "SUMMARY",
        successCount: 12,
        lastUsedAt: null,
        isFineTuned: false,
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    ];

    // count is called twice: total + candidateCount
    mockSkillPattern.findMany.mockResolvedValue(fakePatterns);
    mockSkillPattern.count
      .mockResolvedValueOnce(1)   // total
      .mockResolvedValueOnce(1);  // candidateCount

    const { GET } = await import("../../app/api/ai/patterns/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/ai/patterns") as any
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(fakePatterns);
    expect(json.total).toBe(1);
    expect(json.candidateCount).toBe(1);
    expect(json.page).toBe(1);
    expect(json.pageSize).toBe(20);
  });

  it("filters by taskType when provided", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);
    mockSkillPattern.findMany.mockResolvedValue([]);
    mockSkillPattern.count.mockResolvedValue(0);

    const { GET } = await import("../../app/api/ai/patterns/route");
    await GET(
      makeRequest(
        "GET",
        "http://localhost/api/ai/patterns?taskType=OCR"
      ) as any
    );

    expect(mockSkillPattern.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ taskType: "OCR" }),
      })
    );
  });

  it("filters by isFineTuned=true when provided", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);
    mockSkillPattern.findMany.mockResolvedValue([]);
    mockSkillPattern.count.mockResolvedValue(0);

    const { GET } = await import("../../app/api/ai/patterns/route");
    await GET(
      makeRequest(
        "GET",
        "http://localhost/api/ai/patterns?isFineTuned=true"
      ) as any
    );

    expect(mockSkillPattern.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isFineTuned: true }),
      })
    );
  });

  it("sorts by successCount descending", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);
    mockSkillPattern.findMany.mockResolvedValue([]);
    mockSkillPattern.count.mockResolvedValue(0);

    const { GET } = await import("../../app/api/ai/patterns/route");
    await GET(
      makeRequest("GET", "http://localhost/api/ai/patterns") as any
    );

    expect(mockSkillPattern.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { successCount: "desc" },
      })
    );
  });

  it("respects page and pageSize query params", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);
    mockSkillPattern.findMany.mockResolvedValue([]);
    mockSkillPattern.count.mockResolvedValue(0);

    const { GET } = await import("../../app/api/ai/patterns/route");
    await GET(
      makeRequest(
        "GET",
        "http://localhost/api/ai/patterns?page=2&pageSize=10"
      ) as any
    );

    expect(mockSkillPattern.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10, // (page-1) * pageSize = 1 * 10
        take: 10,
      })
    );
  });

  it("returns 400 for pageSize > 100", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);

    const { GET } = await import("../../app/api/ai/patterns/route");
    const res = await GET(
      makeRequest(
        "GET",
        "http://localhost/api/ai/patterns?pageSize=200"
      ) as any
    );

    expect(res.status).toBe(400);
  });

  it("returns empty data when no patterns exist", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);
    mockSkillPattern.findMany.mockResolvedValue([]);
    mockSkillPattern.count.mockResolvedValue(0);

    const { GET } = await import("../../app/api/ai/patterns/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/ai/patterns") as any
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([]);
    expect(json.total).toBe(0);
    expect(json.candidateCount).toBe(0);
  });
});

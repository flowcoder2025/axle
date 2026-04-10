import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockPrismaMatchingResult = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  deleteMany: vi.fn(),
  createMany: vi.fn(),
  update: vi.fn(),
};

const mockPrismaClient = {
  findFirst: vi.fn(),
};

const mockPrismaProgram = {
  findMany: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    client: mockPrismaClient,
    programInfo: mockPrismaProgram,
    matchingResult: mockPrismaMatchingResult,
    $transaction: vi.fn(async (ops: unknown) => {
      // Handle array-style transaction
      if (Array.isArray(ops)) return Promise.all(ops);
      // Handle callback-style transaction
      if (typeof ops === "function") return (ops as (tx: unknown) => Promise<unknown>)({});
      return ops;
    }),
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
}));

vi.mock("@axle/matching", () => ({
  matchClientToPrograms: vi.fn(),
}));

import { getCurrentUser } from "@axle/auth";
import { matchClientToPrograms } from "@axle/matching";

const authedUser = { id: "user-1", orgId: "org-1", email: "a@test.com" };

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

// --- Validation tests ---

describe("matchingRunSchema", () => {
  it("accepts valid clientId", async () => {
    const { matchingRunSchema } = await import("../../lib/validations/matching");
    const result = matchingRunSchema.safeParse({ clientId: "client-1" });
    expect(result.success).toBe(true);
  });

  it("rejects missing clientId", async () => {
    const { matchingRunSchema } = await import("../../lib/validations/matching");
    const result = matchingRunSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts optional programIds array", async () => {
    const { matchingRunSchema } = await import("../../lib/validations/matching");
    const result = matchingRunSchema.safeParse({
      clientId: "client-1",
      programIds: ["prog-1", "prog-2"],
    });
    expect(result.success).toBe(true);
  });
});

describe("feedbackSchema", () => {
  it("accepts isRelevant=true", async () => {
    const { feedbackSchema } = await import("../../lib/validations/matching");
    const result = feedbackSchema.safeParse({ isRelevant: true });
    expect(result.success).toBe(true);
  });

  it("accepts isRelevant with optional note", async () => {
    const { feedbackSchema } = await import("../../lib/validations/matching");
    const result = feedbackSchema.safeParse({ isRelevant: false, feedbackNote: "틀린 매칭" });
    expect(result.success).toBe(true);
  });

  it("rejects missing isRelevant", async () => {
    const { feedbackSchema } = await import("../../lib/validations/matching");
    const result = feedbackSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// --- POST /api/matching ---

describe("POST /api/matching", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null as never);
    const { POST } = await import("../../app/api/matching/route");
    const res = await POST(makeRequest("POST", "http://localhost/api/matching", { clientId: "c-1" }) as never);
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing clientId", async () => {
    const { POST } = await import("../../app/api/matching/route");
    const res = await POST(makeRequest("POST", "http://localhost/api/matching", {}) as never);
    expect(res.status).toBe(400);
  });

  it("returns 404 when client not found", async () => {
    mockPrismaClient.findFirst.mockResolvedValue(null);
    const { POST } = await import("../../app/api/matching/route");
    const res = await POST(makeRequest("POST", "http://localhost/api/matching", { clientId: "c-missing" }) as never);
    expect(res.status).toBe(404);
  });

  it("returns 200 with empty data when no programs found", async () => {
    mockPrismaClient.findFirst.mockResolvedValue({
      id: "c-1",
      name: "테스트",
      industry: "IT",
      region: "서울",
      employeeCount: 50,
      isVenture: false,
      isInnoBiz: false,
      certificates: [],
      financials: [],
    });
    mockPrismaProgram.findMany.mockResolvedValue([]);

    const { POST } = await import("../../app/api/matching/route");
    const res = await POST(makeRequest("POST", "http://localhost/api/matching", { clientId: "c-1" }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(0);
  });

  it("runs matching pipeline and returns results", async () => {
    mockPrismaClient.findFirst.mockResolvedValue({
      id: "c-1",
      name: "테스트 기업",
      industry: "IT",
      region: "서울",
      employeeCount: 50,
      isVenture: true,
      isInnoBiz: false,
      certificates: [{ certType: "ISO9001" }],
      financials: [{ revenue: 500000000, year: 2024 }],
    });
    mockPrismaProgram.findMany.mockResolvedValue([
      { id: "p-1", name: "스타트업 지원", category: "STARTUP", region: null, maxFunding: null, requirements: null, eligibility: null },
    ]);

    const mockMatchResult = [
      {
        programId: "p-1",
        programName: "스타트업 지원",
        score: 75,
        isDisqualified: false,
        disqualifyReasons: [],
        penalties: [],
        matchReasons: ["지역 일치: 서울 (+15점)"],
      },
    ];
    vi.mocked(matchClientToPrograms).mockReturnValue(mockMatchResult as never);

    mockPrismaMatchingResult.deleteMany.mockResolvedValue({ count: 0 });
    mockPrismaMatchingResult.createMany.mockResolvedValue({ count: 1 });
    mockPrismaMatchingResult.findMany.mockResolvedValue([
      { id: "mr-1", programId: "p-1", createdAt: new Date("2024-01-01") },
    ]);

    const { POST } = await import("../../app/api/matching/route");
    const res = await POST(makeRequest("POST", "http://localhost/api/matching", { clientId: "c-1" }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].score).toBe(75);
    expect(body.data[0].programId).toBe("p-1");
  });
});

// --- GET /api/matching ---

describe("GET /api/matching", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null as never);
    const { GET } = await import("../../app/api/matching/route");
    const res = await GET(makeRequest("GET", "http://localhost/api/matching?clientId=c-1") as never);
    expect(res.status).toBe(401);
  });

  it("returns 400 when clientId is missing", async () => {
    const { GET } = await import("../../app/api/matching/route");
    const res = await GET(makeRequest("GET", "http://localhost/api/matching") as never);
    expect(res.status).toBe(400);
  });

  it("returns 404 when client not found", async () => {
    mockPrismaClient.findFirst.mockResolvedValue(null);
    const { GET } = await import("../../app/api/matching/route");
    const res = await GET(makeRequest("GET", "http://localhost/api/matching?clientId=missing") as never);
    expect(res.status).toBe(404);
  });

  it("returns existing matching results", async () => {
    mockPrismaClient.findFirst.mockResolvedValue({ id: "c-1" });
    mockPrismaMatchingResult.findMany.mockResolvedValue([
      {
        id: "mr-1",
        programId: "p-1",
        score: 75,
        matchReasons: ["지역 일치"],
        disqualifyReasons: [],
        isRelevant: null,
        feedbackNote: null,
        createdAt: new Date("2024-01-01"),
        program: { id: "p-1", name: "스타트업 지원", category: "STARTUP", region: null, maxFunding: null },
      },
    ]);

    const { GET } = await import("../../app/api/matching/route");
    const res = await GET(makeRequest("GET", "http://localhost/api/matching?clientId=c-1") as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].score).toBe(75);
    expect(body.data[0].isDisqualified).toBe(false);
  });
});

// --- PATCH /api/matching/[matchId]/feedback ---

describe("PATCH /api/matching/[matchId]/feedback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null as never);
    const { PATCH } = await import("../../app/api/matching/[matchId]/feedback/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/matching/mr-1/feedback", { isRelevant: true }) as never,
      { params: Promise.resolve({ matchId: "mr-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when match result not found", async () => {
    mockPrismaMatchingResult.findFirst.mockResolvedValue(null);
    const { PATCH } = await import("../../app/api/matching/[matchId]/feedback/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/matching/missing/feedback", { isRelevant: true }) as never,
      { params: Promise.resolve({ matchId: "missing" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid feedback body", async () => {
    const { PATCH } = await import("../../app/api/matching/[matchId]/feedback/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/matching/mr-1/feedback", { isRelevant: "yes" }) as never,
      { params: Promise.resolve({ matchId: "mr-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("saves feedback and returns updated record", async () => {
    mockPrismaMatchingResult.findFirst.mockResolvedValue({
      id: "mr-1",
      program: { orgId: "org-1" },
    });
    mockPrismaMatchingResult.update.mockResolvedValue({
      id: "mr-1",
      isRelevant: true,
      feedbackNote: "좋은 매칭",
      createdAt: new Date("2024-01-01"),
    });

    const { PATCH } = await import("../../app/api/matching/[matchId]/feedback/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/matching/mr-1/feedback", {
        isRelevant: true,
        feedbackNote: "좋은 매칭",
      }) as never,
      { params: Promise.resolve({ matchId: "mr-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.isRelevant).toBe(true);
    expect(body.data.feedbackNote).toBe("좋은 매칭");
  });
});

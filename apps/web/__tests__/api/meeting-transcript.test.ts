import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockMeetingOps = {
  findFirst: vi.fn(),
};

const mockTranscriptOps = {
  findUnique: vi.fn(),
  upsert: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    meeting: mockMeetingOps,
    meetingTranscript: mockTranscriptOps,
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
}));

// Stub summary generation so it doesn't interfere with transcript tests
vi.mock("../../lib/services/meeting-summary", () => ({
  generateSummary: vi.fn().mockResolvedValue(undefined),
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

// --- GET /api/meetings/[meetingId]/transcript ---

describe("GET /api/meetings/[meetingId]/transcript", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/meetings/[meetingId]/transcript/route"
    );
    const res = await GET(
      makeRequest("GET", "http://localhost/api/meetings/m1/transcript") as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when meeting not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/meetings/[meetingId]/transcript/route"
    );
    const res = await GET(
      makeRequest("GET", "http://localhost/api/meetings/m1/transcript") as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when transcript not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue({ id: "m1" });
    mockTranscriptOps.findUnique.mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/meetings/[meetingId]/transcript/route"
    );
    const res = await GET(
      makeRequest("GET", "http://localhost/api/meetings/m1/transcript") as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns transcript when found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue({ id: "m1" });
    mockTranscriptOps.findUnique.mockResolvedValue({
      id: "t1",
      meetingId: "m1",
      rawTranscript: "Hello world",
      summary: "Brief summary",
      keyDecisions: null,
      sentiment: null,
      aiJobId: null,
    });
    const { GET } = await import(
      "../../app/api/meetings/[meetingId]/transcript/route"
    );
    const res = await GET(
      makeRequest("GET", "http://localhost/api/meetings/m1/transcript") as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.rawTranscript).toBe("Hello world");
    expect(body.data.summary).toBe("Brief summary");
  });
});

// --- POST /api/meetings/[meetingId]/transcript ---

describe("POST /api/meetings/[meetingId]/transcript", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/meetings/[meetingId]/transcript/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m1/transcript", {
        rawTranscript: "Some text",
      }) as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when meeting not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/meetings/[meetingId]/transcript/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m1/transcript", {
        rawTranscript: "Some text",
      }) as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when rawTranscript is missing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue({ id: "m1" });
    const { POST } = await import(
      "../../app/api/meetings/[meetingId]/transcript/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m1/transcript", {}) as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when rawTranscript is empty string", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue({ id: "m1" });
    const { POST } = await import(
      "../../app/api/meetings/[meetingId]/transcript/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m1/transcript", {
        rawTranscript: "   ",
      }) as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("upserts transcript and returns 201, triggers summary generation", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockMeetingOps.findFirst.mockResolvedValue({ id: "m1" });
    const saved = {
      id: "t1",
      meetingId: "m1",
      rawTranscript: "Discussion notes from the meeting.",
      summary: null,
      keyDecisions: null,
      aiJobId: null,
    };
    mockTranscriptOps.upsert.mockResolvedValue(saved);

    const { POST } = await import(
      "../../app/api/meetings/[meetingId]/transcript/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m1/transcript", {
        rawTranscript: "Discussion notes from the meeting.",
      }) as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.rawTranscript).toBe("Discussion notes from the meeting.");

    // Verify generateSummary was triggered
    const { generateSummary } = await import("../../lib/services/meeting-summary");
    expect(generateSummary).toHaveBeenCalledWith("m1");
  });

  it("returns 403 when user has no orgId", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "u1", orgId: null, email: "a@test.com" } as never);
    const { POST } = await import(
      "../../app/api/meetings/[meetingId]/transcript/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/meetings/m1/transcript", {
        rawTranscript: "text",
      }) as never,
      { params: Promise.resolve({ meetingId: "m1" }) }
    );
    expect(res.status).toBe(403);
  });
});

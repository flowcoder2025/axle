/**
 * Tests for Activity Timeline API routes
 * GET  /api/projects/[projectId]/activity  — list timeline events
 * POST /api/projects/[projectId]/activity  — add a comment
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — vi.hoisted ensures these are initialized before vi.mock runs
// ---------------------------------------------------------------------------

const {
  mockDocument,
  mockProjectMember,
  mockMeeting,
  mockProjectComment,
  mockUser,
  mockGetCurrentUser,
  mockResolveProject,
  mockCreateNotification,
} = vi.hoisted(() => ({
  mockDocument: { findMany: vi.fn() },
  mockProjectMember: { findMany: vi.fn() },
  mockMeeting: { findMany: vi.fn() },
  mockProjectComment: { findMany: vi.fn(), create: vi.fn() },
  mockUser: { findMany: vi.fn() },
  mockGetCurrentUser: vi.fn(),
  mockResolveProject: vi.fn(),
  mockCreateNotification: vi.fn(),
}));

vi.mock("@axle/db", () => ({
  prisma: {
    document: mockDocument,
    projectMember: mockProjectMember,
    meeting: mockMeeting,
    projectComment: mockProjectComment,
    user: mockUser,
  },
}));

vi.mock("@axle/auth", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@axle/notification", () => ({
  create: mockCreateNotification,
}));

vi.mock("@/lib/utils/resolve-project", () => ({
  resolveProject: mockResolveProject,
}));

import { GET, POST } from "@/app/api/projects/[projectId]/activity/route";

const authedUser = { id: "user-1", orgId: "org-1", email: "a@test.com" };

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

const CTX = { params: Promise.resolve({ projectId: "proj-1" }) };

beforeEach(() => {
  vi.resetAllMocks();
  mockGetCurrentUser.mockResolvedValue(authedUser);
  mockResolveProject.mockResolvedValue({ ok: true, project: { id: "proj-1", clientId: "client-1" } });
  mockDocument.findMany.mockResolvedValue([]);
  mockProjectMember.findMany.mockResolvedValue([]);
  mockMeeting.findMany.mockResolvedValue([]);
  mockProjectComment.findMany.mockResolvedValue([]);
  mockUser.findMany.mockResolvedValue([]);
});

describe("GET /api/projects/[projectId]/activity", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeRequest("GET", "http://test/api/projects/proj-1/activity") as never, CTX);
    expect(res.status).toBe(401);
  });

  it("returns empty timeline when no events", async () => {
    const res = await GET(makeRequest("GET", "http://test/api/projects/proj-1/activity") as never, CTX);
    const json = await res.json() as { data: unknown[] };
    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(0);
  });

  it("aggregates document events into timeline", async () => {
    mockDocument.findMany.mockResolvedValue([
      { id: "doc-1", name: "사업계획서.pdf", category: "CONTRACT", createdAt: new Date("2024-01-02") },
    ]);
    const res = await GET(makeRequest("GET", "http://test/api/projects/proj-1/activity") as never, CTX);
    const json = await res.json() as { data: { type: string; payload: { name: string } }[] };
    expect(res.status).toBe(200);
    expect(json.data[0]?.type).toBe("DOCUMENT_ADDED");
    expect(json.data[0]?.payload.name).toBe("사업계획서.pdf");
  });

  it("aggregates comment events into timeline", async () => {
    mockProjectComment.findMany.mockResolvedValue([
      { id: "cmt-1", authorId: "user-2", body: "안녕하세요", mentions: [], createdAt: new Date("2024-01-03"), updatedAt: new Date() },
    ]);
    mockUser.findMany.mockResolvedValue([{ id: "user-2", name: "테스터", email: "test@test.com" }]);
    const res = await GET(makeRequest("GET", "http://test/api/projects/proj-1/activity") as never, CTX);
    const json = await res.json() as { data: { type: string }[] };
    expect(res.status).toBe(200);
    expect(json.data.some((e) => e.type === "COMMENT")).toBe(true);
  });

  it("sorts events newest-first", async () => {
    mockDocument.findMany.mockResolvedValue([
      { id: "doc-1", name: "오래된.pdf", category: "CONTRACT", createdAt: new Date("2024-01-01") },
    ]);
    mockProjectComment.findMany.mockResolvedValue([
      { id: "cmt-1", authorId: "user-1", body: "최신 댓글", mentions: [], createdAt: new Date("2024-06-01"), updatedAt: new Date() },
    ]);
    mockUser.findMany.mockResolvedValue([]);
    const res = await GET(makeRequest("GET", "http://test/api/projects/proj-1/activity") as never, CTX);
    const json = await res.json() as { data: { type: string; timestamp: string }[] };
    expect(new Date(json.data[0]!.timestamp) > new Date(json.data[1]!.timestamp)).toBe(true);
  });
});

describe("POST /api/projects/[projectId]/activity", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest("POST", "http://test/", { body: "hi" }) as never, CTX);
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is missing", async () => {
    const res = await POST(makeRequest("POST", "http://test/", { body: "" }) as never, CTX);
    expect(res.status).toBe(400);
  });

  it("creates a comment successfully", async () => {
    const comment = { id: "cmt-1", projectId: "proj-1", authorId: "user-1", body: "좋아요!", mentions: [], createdAt: new Date(), updatedAt: new Date() };
    mockProjectComment.create.mockResolvedValue(comment);
    mockUser.findMany.mockResolvedValue([]);

    const res = await POST(
      makeRequest("POST", "http://test/", { body: "좋아요!" }) as never,
      CTX,
    );
    const json = await res.json() as { data: { body: string } };
    expect(res.status).toBe(201);
    expect(json.data.body).toBe("좋아요!");
  });

  it("creates MENTION notifications for mentioned users", async () => {
    const comment = { id: "cmt-1", projectId: "proj-1", authorId: "user-1", body: "@user-2 안녕!", mentions: ["user-2"], createdAt: new Date(), updatedAt: new Date() };
    mockProjectComment.create.mockResolvedValue(comment);
    mockUser.findMany.mockResolvedValue([{ id: "user-2" }]);

    await POST(
      makeRequest("POST", "http://test/", { body: "@user-2 안녕!" }) as never,
      CTX,
    );

    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-2", type: "MENTION" }),
    );
  });

  it("does not notify the author when they mention themselves", async () => {
    const comment = { id: "cmt-1", projectId: "proj-1", authorId: "user-1", body: "@user-1 자기 자신", mentions: ["user-1"], createdAt: new Date(), updatedAt: new Date() };
    mockProjectComment.create.mockResolvedValue(comment);
    mockUser.findMany.mockResolvedValue([{ id: "user-1" }]);

    await POST(
      makeRequest("POST", "http://test/", { body: "@user-1 자기 자신" }) as never,
      CTX,
    );

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});

/**
 * Tests for WI-106 Handoff API route and service
 * POST /api/projects/[projectId]/handoff
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockProject,
  mockUser,
  mockProjectMember,
  mockGetCurrentUser,
  mockCreateNotification,
  mockSend,
} = vi.hoisted(() => ({
  mockProject: { findFirst: vi.fn(), update: vi.fn() },
  mockUser: { findFirst: vi.fn(), findUnique: vi.fn() },
  mockProjectMember: { upsert: vi.fn() },
  mockGetCurrentUser: vi.fn(),
  mockCreateNotification: vi.fn(),
  mockSend: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@axle/db", () => ({
  prisma: {
    project: mockProject,
    user: mockUser,
    projectMember: mockProjectMember,
  },
}));

vi.mock("@axle/auth", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@axle/notification", () => ({
  create: mockCreateNotification,
}));

vi.mock("@axle/email", () => ({
  send: mockSend,
}));

import { POST } from "@/app/api/projects/[projectId]/handoff/route";

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
  mockCreateNotification.mockResolvedValue(undefined);
  mockSend.mockResolvedValue(undefined);
});

describe("POST /api/projects/[projectId]/handoff", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest("POST", "http://test/", { newAssigneeId: "user-2" }) as never, CTX);
    expect(res.status).toBe(401);
  });

  it("returns 400 when newAssigneeId is missing", async () => {
    const res = await POST(makeRequest("POST", "http://test/", {}) as never, CTX);
    expect(res.status).toBe(400);
  });

  it("returns 404 when project not found", async () => {
    mockProject.findFirst.mockResolvedValue(null);
    const res = await POST(makeRequest("POST", "http://test/", { newAssigneeId: "user-2" }) as never, CTX);
    expect(res.status).toBe(404);
  });

  it("returns 404 when new assignee not in org", async () => {
    mockProject.findFirst.mockResolvedValue({ id: "proj-1", title: "테스트", status: "IN_PROGRESS", dueDate: null });
    mockUser.findFirst.mockResolvedValue(null);
    const res = await POST(makeRequest("POST", "http://test/", { newAssigneeId: "user-99" }) as never, CTX);
    expect(res.status).toBe(404);
  });

  it("successfully hands off a project", async () => {
    mockProject.findFirst.mockResolvedValue({ id: "proj-1", title: "테스트 프로젝트", status: "IN_PROGRESS", dueDate: null });
    mockUser.findFirst.mockResolvedValue({ id: "user-2", name: "김철수", email: "kim@test.com" });
    mockUser.findUnique.mockResolvedValue({ name: "이영희", email: "lee@test.com" });
    mockProject.update.mockResolvedValue({});
    mockProjectMember.upsert.mockResolvedValue({});

    const res = await POST(
      makeRequest("POST", "http://test/", { newAssigneeId: "user-2", reason: "업무 이관" }) as never,
      CTX,
    );

    const json = await res.json() as { data: { newAssigneeId: string } };
    expect(res.status).toBe(200);
    expect(json.data.newAssigneeId).toBe("user-2");
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-2", type: "HANDOFF" }),
    );
  });
});

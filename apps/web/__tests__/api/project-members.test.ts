/**
 * Tests for ProjectMember API routes
 * GET    /api/projects/[projectId]/members
 * POST   /api/projects/[projectId]/members
 * PATCH  /api/projects/[projectId]/members/[memberId]
 * DELETE /api/projects/[projectId]/members/[memberId]
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockProject = {
  findFirst: vi.fn(),
};

const mockProjectMember = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockUser = {
  findMany: vi.fn(),
};

const mockGrant = vi.fn();
const mockRevoke = vi.fn();

vi.mock("@axle/db", () => ({
  prisma: {
    project: mockProject,
    projectMember: mockProjectMember,
    user: mockUser,
  },
  grant: mockGrant,
  revoke: mockRevoke,
}));

vi.mock("@axle/auth", () => ({
  getCurrentUser: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { getCurrentUser } from "@axle/auth";

const authedUser = { id: "user-1", orgId: "org-1" };

const PROJECT = { id: "proj-1" };

const MEMBER = {
  id: "member-1",
  projectId: "proj-1",
  userId: "user-2",
  role: "MEMBER",
};

const USER_RECORD = { id: "user-2", name: "Jane Doe", email: "jane@example.com" };

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
  mockProject.findFirst.mockResolvedValue(PROJECT);
  mockGrant.mockResolvedValue(undefined);
  mockRevoke.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Validation schema tests
// ---------------------------------------------------------------------------

describe("projectMemberAddSchema", () => {
  it("rejects missing userId", async () => {
    const { projectMemberAddSchema } = await import(
      "../../lib/validations/project-member"
    );
    expect(projectMemberAddSchema.safeParse({}).success).toBe(false);
    expect(projectMemberAddSchema.safeParse({ userId: "" }).success).toBe(false);
  });

  it("defaults role to MEMBER when omitted", async () => {
    const { projectMemberAddSchema } = await import(
      "../../lib/validations/project-member"
    );
    const result = projectMemberAddSchema.safeParse({ userId: "user-2" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("MEMBER");
    }
  });

  it("accepts all valid role values", async () => {
    const { projectMemberAddSchema } = await import(
      "../../lib/validations/project-member"
    );
    for (const role of ["LEAD", "MEMBER", "VIEWER"]) {
      const result = projectMemberAddSchema.safeParse({ userId: "user-2", role });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid role", async () => {
    const { projectMemberAddSchema } = await import(
      "../../lib/validations/project-member"
    );
    expect(
      projectMemberAddSchema.safeParse({ userId: "user-2", role: "ADMIN" }).success,
    ).toBe(false);
  });
});

describe("projectMemberUpdateSchema", () => {
  it("requires role", async () => {
    const { projectMemberUpdateSchema } = await import(
      "../../lib/validations/project-member"
    );
    expect(projectMemberUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("accepts all valid role values", async () => {
    const { projectMemberUpdateSchema } = await import(
      "../../lib/validations/project-member"
    );
    for (const role of ["LEAD", "MEMBER", "VIEWER"]) {
      expect(projectMemberUpdateSchema.safeParse({ role }).success).toBe(true);
    }
  });

  it("rejects invalid role", async () => {
    const { projectMemberUpdateSchema } = await import(
      "../../lib/validations/project-member"
    );
    expect(
      projectMemberUpdateSchema.safeParse({ role: "OWNER" }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/projects/[projectId]/members
// ---------------------------------------------------------------------------

describe("GET /api/projects/[projectId]/members", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/projects/[projectId]/members/route"
    );
    const req = makeRequest("GET", "http://localhost/api/projects/proj-1/members");
    const res = await GET(req as never, {
      params: Promise.resolve({ projectId: "proj-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when project not in org", async () => {
    mockProject.findFirst.mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/projects/[projectId]/members/route"
    );
    const req = makeRequest("GET", "http://localhost/api/projects/ghost/members");
    const res = await GET(req as never, {
      params: Promise.resolve({ projectId: "ghost" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns enriched member list with user info", async () => {
    mockProjectMember.findMany.mockResolvedValue([MEMBER]);
    mockUser.findMany.mockResolvedValue([USER_RECORD]);
    const { GET } = await import(
      "../../app/api/projects/[projectId]/members/route"
    );
    const req = makeRequest("GET", "http://localhost/api/projects/proj-1/members");
    const res = await GET(req as never, {
      params: Promise.resolve({ projectId: "proj-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("member-1");
    expect(body.data[0].user).toMatchObject({
      id: "user-2",
      name: "Jane Doe",
      email: "jane@example.com",
    });
  });

  it("returns null user when user record is missing", async () => {
    mockProjectMember.findMany.mockResolvedValue([MEMBER]);
    mockUser.findMany.mockResolvedValue([]);
    const { GET } = await import(
      "../../app/api/projects/[projectId]/members/route"
    );
    const req = makeRequest("GET", "http://localhost/api/projects/proj-1/members");
    const res = await GET(req as never, {
      params: Promise.resolve({ projectId: "proj-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].user).toBeNull();
  });

  it("skips user query when there are no members", async () => {
    mockProjectMember.findMany.mockResolvedValue([]);
    const { GET } = await import(
      "../../app/api/projects/[projectId]/members/route"
    );
    const req = makeRequest("GET", "http://localhost/api/projects/proj-1/members");
    const res = await GET(req as never, {
      params: Promise.resolve({ projectId: "proj-1" }),
    });
    expect(res.status).toBe(200);
    expect(mockUser.findMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST /api/projects/[projectId]/members
// ---------------------------------------------------------------------------

describe("POST /api/projects/[projectId]/members", () => {
  beforeEach(() => {
    mockProjectMember.findUnique.mockResolvedValue(null);
    mockProjectMember.create.mockResolvedValue(MEMBER);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/projects/[projectId]/members/route"
    );
    const req = makeRequest("POST", "http://localhost/api/projects/proj-1/members", {
      userId: "user-2",
    });
    const res = await POST(req as never, {
      params: Promise.resolve({ projectId: "proj-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when project not in org", async () => {
    mockProject.findFirst.mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/projects/[projectId]/members/route"
    );
    const req = makeRequest("POST", "http://localhost/api/projects/ghost/members", {
      userId: "user-2",
    });
    const res = await POST(req as never, {
      params: Promise.resolve({ projectId: "ghost" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for missing userId", async () => {
    const { POST } = await import(
      "../../app/api/projects/[projectId]/members/route"
    );
    const req = makeRequest("POST", "http://localhost/api/projects/proj-1/members", {
      role: "MEMBER",
    });
    const res = await POST(req as never, {
      params: Promise.resolve({ projectId: "proj-1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid JSON body", async () => {
    const { POST } = await import(
      "../../app/api/projects/[projectId]/members/route"
    );
    const req = new Request("http://localhost/api/projects/proj-1/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req as never, {
      params: Promise.resolve({ projectId: "proj-1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("returns 409 when user is already a member", async () => {
    mockProjectMember.findUnique.mockResolvedValue(MEMBER);
    const { POST } = await import(
      "../../app/api/projects/[projectId]/members/route"
    );
    const req = makeRequest("POST", "http://localhost/api/projects/proj-1/members", {
      userId: "user-2",
    });
    const res = await POST(req as never, {
      params: Promise.resolve({ projectId: "proj-1" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("CONFLICT");
  });

  it("creates member and returns 201", async () => {
    const { POST } = await import(
      "../../app/api/projects/[projectId]/members/route"
    );
    const req = makeRequest("POST", "http://localhost/api/projects/proj-1/members", {
      userId: "user-2",
      role: "LEAD",
    });
    const res = await POST(req as never, {
      params: Promise.resolve({ projectId: "proj-1" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("member-1");
  });

  it("grants ReBAC tuple with lowercase role on add", async () => {
    const { POST } = await import(
      "../../app/api/projects/[projectId]/members/route"
    );
    const req = makeRequest("POST", "http://localhost/api/projects/proj-1/members", {
      userId: "user-2",
      role: "LEAD",
    });
    await POST(req as never, {
      params: Promise.resolve({ projectId: "proj-1" }),
    });
    expect(mockGrant).toHaveBeenCalledWith(
      "project",
      "proj-1",
      "lead",
      "user",
      "user-2",
    );
  });

  it("uses default MEMBER role and grants 'member' tuple", async () => {
    const { POST } = await import(
      "../../app/api/projects/[projectId]/members/route"
    );
    const req = makeRequest("POST", "http://localhost/api/projects/proj-1/members", {
      userId: "user-2",
    });
    await POST(req as never, {
      params: Promise.resolve({ projectId: "proj-1" }),
    });
    expect(mockGrant).toHaveBeenCalledWith(
      "project",
      "proj-1",
      "member",
      "user",
      "user-2",
    );
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/projects/[projectId]/members/[memberId]
// ---------------------------------------------------------------------------

describe("PATCH /api/projects/[projectId]/members/[memberId]", () => {
  beforeEach(() => {
    mockProjectMember.findFirst.mockResolvedValue(MEMBER);
    mockProjectMember.update.mockResolvedValue({ ...MEMBER, role: "LEAD" });
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/members/[memberId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/projects/proj-1/members/member-1",
      { role: "LEAD" },
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ projectId: "proj-1", memberId: "member-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when project not in org", async () => {
    mockProject.findFirst.mockResolvedValue(null);
    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/members/[memberId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/projects/ghost/members/member-1",
      { role: "LEAD" },
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ projectId: "ghost", memberId: "member-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when member not found", async () => {
    mockProjectMember.findFirst.mockResolvedValue(null);
    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/members/[memberId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/projects/proj-1/members/ghost",
      { role: "LEAD" },
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ projectId: "proj-1", memberId: "ghost" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for missing role", async () => {
    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/members/[memberId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/projects/proj-1/members/member-1",
      {},
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ projectId: "proj-1", memberId: "member-1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid JSON body", async () => {
    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/members/[memberId]/route"
    );
    const req = new Request(
      "http://localhost/api/projects/proj-1/members/member-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      },
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ projectId: "proj-1", memberId: "member-1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("updates role and returns 200", async () => {
    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/members/[memberId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/projects/proj-1/members/member-1",
      { role: "LEAD" },
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ projectId: "proj-1", memberId: "member-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.role).toBe("LEAD");
  });

  it("revokes old tuple and grants new tuple on role change", async () => {
    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/members/[memberId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/projects/proj-1/members/member-1",
      { role: "LEAD" },
    );
    await PATCH(req as never, {
      params: Promise.resolve({ projectId: "proj-1", memberId: "member-1" }),
    });
    // Old role is MEMBER → revoke 'member', grant 'lead'
    expect(mockRevoke).toHaveBeenCalledWith(
      "project",
      "proj-1",
      "member",
      "user",
      "user-2",
    );
    expect(mockGrant).toHaveBeenCalledWith(
      "project",
      "proj-1",
      "lead",
      "user",
      "user-2",
    );
  });

  it("does not revoke or grant when role is unchanged", async () => {
    // Same role: MEMBER → MEMBER
    mockProjectMember.update.mockResolvedValue(MEMBER);
    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/members/[memberId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/projects/proj-1/members/member-1",
      { role: "MEMBER" },
    );
    await PATCH(req as never, {
      params: Promise.resolve({ projectId: "proj-1", memberId: "member-1" }),
    });
    expect(mockRevoke).not.toHaveBeenCalled();
    expect(mockGrant).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/projects/[projectId]/members/[memberId]
// ---------------------------------------------------------------------------

describe("DELETE /api/projects/[projectId]/members/[memberId]", () => {
  beforeEach(() => {
    mockProjectMember.findFirst.mockResolvedValue(MEMBER);
    mockProjectMember.delete.mockResolvedValue(MEMBER);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { DELETE } = await import(
      "../../app/api/projects/[projectId]/members/[memberId]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/projects/proj-1/members/member-1",
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({ projectId: "proj-1", memberId: "member-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when project not in org", async () => {
    mockProject.findFirst.mockResolvedValue(null);
    const { DELETE } = await import(
      "../../app/api/projects/[projectId]/members/[memberId]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/projects/ghost/members/member-1",
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({ projectId: "ghost", memberId: "member-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when member not found", async () => {
    mockProjectMember.findFirst.mockResolvedValue(null);
    const { DELETE } = await import(
      "../../app/api/projects/[projectId]/members/[memberId]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/projects/proj-1/members/ghost",
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({ projectId: "proj-1", memberId: "ghost" }),
    });
    expect(res.status).toBe(404);
  });

  it("deletes member and returns 204", async () => {
    const { DELETE } = await import(
      "../../app/api/projects/[projectId]/members/[memberId]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/projects/proj-1/members/member-1",
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({ projectId: "proj-1", memberId: "member-1" }),
    });
    expect(res.status).toBe(204);
    expect(mockProjectMember.delete).toHaveBeenCalledWith({
      where: { id: "member-1" },
    });
  });

  it("revokes ReBAC tuple with lowercase role on delete", async () => {
    const { DELETE } = await import(
      "../../app/api/projects/[projectId]/members/[memberId]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/projects/proj-1/members/member-1",
    );
    await DELETE(req as never, {
      params: Promise.resolve({ projectId: "proj-1", memberId: "member-1" }),
    });
    expect(mockRevoke).toHaveBeenCalledWith(
      "project",
      "proj-1",
      "member",
      "user",
      "user-2",
    );
  });

  it("does not delete when org boundary check fails", async () => {
    mockProject.findFirst.mockResolvedValue(null);
    const { DELETE } = await import(
      "../../app/api/projects/[projectId]/members/[memberId]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/projects/other-proj/members/member-1",
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({
        projectId: "other-proj",
        memberId: "member-1",
      }),
    });
    expect(res.status).toBe(404);
    expect(mockProjectMember.delete).not.toHaveBeenCalled();
    expect(mockRevoke).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockPrismaClient = {
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
};
const mockPrismaChecklistItem = {
  findMany: vi.fn(),
};
const mockPrismaPortalToken = {
  findMany: vi.fn(),
  create: vi.fn(),
};
const mockSendOnboardingChecklist = vi.fn().mockResolvedValue(undefined);
const mockGenerateMasterProfile = vi.fn().mockResolvedValue(undefined);

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    client: mockPrismaClient,
    checklistItem: mockPrismaChecklistItem,
    portalToken: mockPrismaPortalToken,
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
}));

vi.mock("../../lib/services/client-onboarding", () => ({
  sendOnboardingChecklist: mockSendOnboardingChecklist,
}));

vi.mock("../../lib/services/client-profile", () => ({
  generateMasterProfile: mockGenerateMasterProfile,
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

function paramsOf<T>(value: T) {
  return { params: Promise.resolve(value) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
});

// ---------------------------------------------------------------------------
// GET /api/clients/[clientId]/checklist
// ---------------------------------------------------------------------------
describe("GET /api/clients/[clientId]/checklist", () => {
  it("aggregates checklist items across all projects of the client", async () => {
    mockPrismaClient.findFirst.mockResolvedValue({ id: "c-1" });
    mockPrismaChecklistItem.findMany.mockResolvedValue([
      { id: "i-1", projectId: "p-1", name: "NDA", status: "PENDING" },
      { id: "i-2", projectId: "p-2", name: "사업자등록증", status: "UPLOADED" },
    ]);

    const { GET } = await import(
      "../../app/api/clients/[clientId]/checklist/route"
    );
    const req = makeRequest("GET", "http://x/api/clients/c-1/checklist");
    const res = await GET(req as never, paramsOf({ clientId: "c-1" }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(2);
    expect(mockPrismaChecklistItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { project: { clientId: "c-1" } },
      }),
    );
  });

  it("returns 404 when the client is not in the user's org", async () => {
    mockPrismaClient.findFirst.mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/checklist/route"
    );
    const req = makeRequest("GET", "http://x/api/clients/other/checklist");
    const res = await GET(req as never, paramsOf({ clientId: "other" }));
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/clients/[clientId]/portal-tokens
// ---------------------------------------------------------------------------
describe("POST /api/clients/[clientId]/portal-tokens", () => {
  it("creates a client-level portal token (projectId = null)", async () => {
    mockPrismaClient.findFirst.mockResolvedValue({ id: "c-1" });
    mockPrismaPortalToken.create.mockResolvedValue({
      id: "t-1",
      token: "abc",
      scope: "UPLOAD",
      expiresAt: null,
      createdBy: "user-1",
      createdAt: new Date(),
      projectId: null,
    });

    const { POST } = await import(
      "../../app/api/clients/[clientId]/portal-tokens/route"
    );
    const req = makeRequest(
      "POST",
      "http://x/api/clients/c-1/portal-tokens",
      { scope: "UPLOAD" },
    );
    const res = await POST(req as never, paramsOf({ clientId: "c-1" }));

    expect(res.status).toBe(201);
    expect(mockPrismaPortalToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: "c-1",
          scope: "UPLOAD",
          createdBy: "user-1",
        }),
      }),
    );
    // projectId MUST not be set — this is what makes it a client-level token.
    const callArgs = mockPrismaPortalToken.create.mock.calls[0][0];
    expect(callArgs.data.projectId).toBeUndefined();
  });

  it("rejects invalid scope", async () => {
    mockPrismaClient.findFirst.mockResolvedValue({ id: "c-1" });
    const { POST } = await import(
      "../../app/api/clients/[clientId]/portal-tokens/route"
    );
    const req = makeRequest(
      "POST",
      "http://x/api/clients/c-1/portal-tokens",
      { scope: "ADMIN" },
    );
    const res = await POST(req as never, paramsOf({ clientId: "c-1" }));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/clients/[clientId]/onboard
// ---------------------------------------------------------------------------
describe("POST /api/clients/[clientId]/onboard", () => {
  it("stamps onboardedAt and dispatches the onboarding checklist", async () => {
    mockPrismaClient.findFirst.mockResolvedValue({
      id: "c-1",
      orgId: "org-1",
    });
    const stampedAt = new Date("2026-04-21T00:00:00Z");
    mockPrismaClient.update.mockResolvedValue({
      id: "c-1",
      onboardedAt: stampedAt,
    });

    const { POST } = await import(
      "../../app/api/clients/[clientId]/onboard/route"
    );
    const req = makeRequest("POST", "http://x/api/clients/c-1/onboard");
    const res = await POST(req as never, paramsOf({ clientId: "c-1" }));

    expect(res.status).toBe(200);
    expect(mockSendOnboardingChecklist).toHaveBeenCalledWith("c-1", "org-1");
    expect(mockPrismaClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c-1" },
        data: expect.objectContaining({ onboardedAt: expect.any(Date) }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/clients/[clientId]/profile
// ---------------------------------------------------------------------------
describe("PATCH /api/clients/[clientId]/profile", () => {
  it("persists the masterProfile JSON blob", async () => {
    mockPrismaClient.findFirst.mockResolvedValue({
      id: "c-1",
      masterProfile: null,
      profileBlocks: null,
    });
    mockPrismaClient.update.mockResolvedValue({
      id: "c-1",
      masterProfile: { summary: "edited" },
      profileBlocks: null,
    });

    const { PATCH } = await import(
      "../../app/api/clients/[clientId]/profile/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://x/api/clients/c-1/profile",
      { masterProfile: { summary: "edited" } },
    );
    const res = await PATCH(req as never, paramsOf({ clientId: "c-1" }));

    expect(res.status).toBe(200);
    expect(mockPrismaClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c-1" },
        data: expect.objectContaining({
          masterProfile: { summary: "edited" },
        }),
      }),
    );
  });

  it("regenerates the masterProfile via AI service on POST", async () => {
    mockPrismaClient.findFirst.mockResolvedValue({
      id: "c-1",
      masterProfile: null,
      profileBlocks: null,
    });
    mockPrismaClient.findUnique.mockResolvedValue({
      masterProfile: { summary: "regenerated" },
      profileBlocks: [],
    });

    const { POST } = await import(
      "../../app/api/clients/[clientId]/profile/route"
    );
    const req = makeRequest("POST", "http://x/api/clients/c-1/profile");
    const res = await POST(req as never, paramsOf({ clientId: "c-1" }));

    expect(res.status).toBe(200);
    expect(mockGenerateMasterProfile).toHaveBeenCalledWith("c-1");
    const json = await res.json();
    expect(json.data.masterProfile).toEqual({ summary: "regenerated" });
  });
});

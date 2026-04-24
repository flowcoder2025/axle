import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockPrismaProject = {
  findFirst: vi.fn(),
  update: vi.fn(),
};

const mockAutoCertificate = vi.fn();
const mockEmit = vi.fn();

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    project: mockPrismaProject,
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
}));

vi.mock("../../lib/services/project-certificate-auto", () => ({
  autoCreateCertificateFromProject: (...args: unknown[]) =>
    mockAutoCertificate(...args),
}));

vi.mock("../../lib/events/event-bus", () => ({
  eventBus: {
    emit: (...args: unknown[]) => {
      mockEmit(...args);
      return Promise.resolve();
    },
  },
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

describe("PATCH /api/projects/[projectId]/status", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/status/route"
    );
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/projects/p-1/status", {
        status: "DOC_COLLECTING",
      }) as never,
      { params: Promise.resolve({ projectId: "p-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no orgId", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      orgId: null,
      email: "a@test.com",
    });
    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/status/route"
    );
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/projects/p-1/status", {
        status: "DOC_COLLECTING",
      }) as never,
      { params: Promise.resolve({ projectId: "p-1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when project not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue(null);

    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/status/route"
    );
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/projects/p-999/status", {
        status: "DOC_COLLECTING",
      }) as never,
      { params: Promise.resolve({ projectId: "p-999" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid status value", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue({ id: "p-1", status: "INTAKE" });

    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/status/route"
    );
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/projects/p-1/status", {
        status: "NONEXISTENT_STATUS",
      }) as never,
      { params: Promise.resolve({ projectId: "p-1" }) }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid transition (INTAKE → IN_PROGRESS)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue({ id: "p-1", status: "INTAKE" });

    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/status/route"
    );
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/projects/p-1/status", {
        status: "IN_PROGRESS",
      }) as never,
      { params: Promise.resolve({ projectId: "p-1" }) }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_TRANSITION");
    expect(body.error.message).toContain("INTAKE");
    expect(body.error.message).toContain("IN_PROGRESS");
  });

  it("successfully transitions INTAKE → DOC_COLLECTING", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue({ id: "p-1", status: "INTAKE" });
    const updated = { id: "p-1", status: "DOC_COLLECTING", updatedAt: new Date() };
    mockPrismaProject.update.mockResolvedValue(updated);

    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/status/route"
    );
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/projects/p-1/status", {
        status: "DOC_COLLECTING",
      }) as never,
      { params: Promise.resolve({ projectId: "p-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("DOC_COLLECTING");
    expect(mockPrismaProject.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "DOC_COLLECTING" } })
    );
  });

  it("successfully transitions SUBMITTED → APPROVED", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue({ id: "p-1", status: "SUBMITTED" });
    const updated = { id: "p-1", status: "APPROVED", updatedAt: new Date() };
    mockPrismaProject.update.mockResolvedValue(updated);

    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/status/route"
    );
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/projects/p-1/status", {
        status: "APPROVED",
      }) as never,
      { params: Promise.resolve({ projectId: "p-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("APPROVED");
  });

  it("successfully transitions SUBMITTED → REJECTED", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue({ id: "p-1", status: "SUBMITTED" });
    const updated = { id: "p-1", status: "REJECTED", updatedAt: new Date() };
    mockPrismaProject.update.mockResolvedValue(updated);

    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/status/route"
    );
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/projects/p-1/status", {
        status: "REJECTED",
      }) as never,
      { params: Promise.resolve({ projectId: "p-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("REJECTED");
  });

  it("allows REJECTED → IN_PROGRESS (retry path)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue({ id: "p-1", status: "REJECTED" });
    const updated = { id: "p-1", status: "IN_PROGRESS", updatedAt: new Date() };
    mockPrismaProject.update.mockResolvedValue(updated);

    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/status/route"
    );
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/projects/p-1/status", {
        status: "IN_PROGRESS",
      }) as never,
      { params: Promise.resolve({ projectId: "p-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("IN_PROGRESS");
  });

  it("blocks any transition from COMPLETED (terminal state)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue({ id: "p-1", status: "COMPLETED" });

    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/status/route"
    );
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/projects/p-1/status", {
        status: "APPROVED",
      }) as never,
      { params: Promise.resolve({ projectId: "p-1" }) }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_TRANSITION");
  });
});

// ─── WI-325: certificate auto-issue on COMPLETED ───────────────────────────

describe("PATCH .../status — WI-325 certificate auto-issue hook", () => {
  beforeEach(() => vi.resetAllMocks());

  it("invokes autoCreateCertificateFromProject when entering COMPLETED", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue({
      id: "p-1",
      status: "APPROVED",
      type: "VENTURE_CERT",
      clientId: "c-1",
      title: "2026 벤처 확인",
    });
    mockPrismaProject.update.mockResolvedValue({
      id: "p-1",
      status: "COMPLETED",
      updatedAt: new Date(),
    });
    mockAutoCertificate.mockResolvedValue({
      created: true,
      certificateId: "cert-42",
    });

    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/status/route"
    );
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/projects/p-1/status", {
        status: "COMPLETED",
      }) as never,
      { params: Promise.resolve({ projectId: "p-1" }) },
    );
    expect(res.status).toBe(200);

    expect(mockAutoCertificate).toHaveBeenCalledWith({
      id: "p-1",
      type: "VENTURE_CERT",
      clientId: "c-1",
      title: "2026 벤처 확인",
    });
    expect(mockEmit).toHaveBeenCalledWith(
      "PROJECT_COMPLETED",
      expect.objectContaining({
        projectId: "p-1",
        projectType: "VENTURE_CERT",
        clientId: "c-1",
        certificateCreated: true,
        certificateId: "cert-42",
      }),
    );
  });

  it("does NOT invoke the hook on non-COMPLETED transitions", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue({
      id: "p-1",
      status: "INTAKE",
      type: "VENTURE_CERT",
      clientId: "c-1",
      title: "n",
    });
    mockPrismaProject.update.mockResolvedValue({
      id: "p-1",
      status: "DOC_COLLECTING",
      updatedAt: new Date(),
    });

    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/status/route"
    );
    await PATCH(
      makeRequest("PATCH", "http://localhost/api/projects/p-1/status", {
        status: "DOC_COLLECTING",
      }) as never,
      { params: Promise.resolve({ projectId: "p-1" }) },
    );

    expect(mockAutoCertificate).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("still returns 200 even when the cert service rejects", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue({
      id: "p-1",
      status: "APPROVED",
      type: "RESEARCH_INSTITUTE",
      clientId: "c-1",
      title: "n",
    });
    mockPrismaProject.update.mockResolvedValue({
      id: "p-1",
      status: "COMPLETED",
      updatedAt: new Date(),
    });
    mockAutoCertificate.mockRejectedValue(new Error("DB down"));

    const { PATCH } = await import(
      "../../app/api/projects/[projectId]/status/route"
    );
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/projects/p-1/status", {
        status: "COMPLETED",
      }) as never,
      { params: Promise.resolve({ projectId: "p-1" }) },
    );
    // Status transition succeeds even though cert creation failed.
    expect(res.status).toBe(200);
    // Event still emitted with certificateCreated=false so consumers see the failure.
    expect(mockEmit).toHaveBeenCalledWith(
      "PROJECT_COMPLETED",
      expect.objectContaining({ certificateCreated: false }),
    );
  });
});

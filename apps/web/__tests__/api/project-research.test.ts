import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockPrismaProject = {
  findFirst: vi.fn(),
  findUnique: vi.fn(),
};

const mockPrismaAiJob = {
  create: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
};

const mockPrismaDocument = {
  create: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    project: mockPrismaProject,
    aiJob: mockPrismaAiJob,
    document: mockPrismaDocument,
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
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

const baseProject = {
  id: "proj-1",
  type: "RESEARCH_TASK" as const,
  clientId: "client-1",
  metadata: {
    investigationItems: [
      { topic: "Market Analysis", priority: "HIGH", description: "Analyze target market" },
      { topic: "Competitor Research", priority: "MEDIUM" },
    ],
    clientContext: { industry: "SaaS" },
  },
};

// ---- POST /api/projects/[projectId]/research ----

describe("POST /api/projects/[projectId]/research", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/projects/[projectId]/research/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/projects/proj-1/research") as never,
      { params: Promise.resolve({ projectId: "proj-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no orgId", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1", orgId: null, email: "a@test.com" });
    const { POST } = await import(
      "../../app/api/projects/[projectId]/research/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/projects/proj-1/research") as never,
      { params: Promise.resolve({ projectId: "proj-1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when project not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue(null);

    const { POST } = await import(
      "../../app/api/projects/[projectId]/research/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/projects/proj-999/research") as never,
      { params: Promise.resolve({ projectId: "proj-999" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when project type is not RESEARCH_TASK", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue({
      ...baseProject,
      type: "BUSINESS_PLAN",
    });

    const { POST } = await import(
      "../../app/api/projects/[projectId]/research/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/projects/proj-1/research") as never,
      { params: Promise.resolve({ projectId: "proj-1" }) }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_PROJECT_TYPE");
  });

  it("creates AiJob and returns 201 with aiJobId and QUEUED status", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue(baseProject);
    mockPrismaAiJob.create.mockResolvedValue({ id: "job-1", status: "QUEUED" });

    const { POST } = await import(
      "../../app/api/projects/[projectId]/research/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/projects/proj-1/research") as never,
      { params: Promise.resolve({ projectId: "proj-1" }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toMatchObject({ aiJobId: "job-1", status: "QUEUED" });
  });

  it("creates AiJob with correct type=RESEARCH and tier=CLI_CLAUDE", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue(baseProject);
    mockPrismaAiJob.create.mockResolvedValue({ id: "job-2", status: "QUEUED" });

    const { POST } = await import(
      "../../app/api/projects/[projectId]/research/route"
    );
    await POST(
      makeRequest("POST", "http://localhost/api/projects/proj-1/research") as never,
      { params: Promise.resolve({ projectId: "proj-1" }) }
    );

    expect(mockPrismaAiJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "proj-1",
          type: "RESEARCH",
          tier: "CLI_CLAUDE",
          status: "QUEUED",
          input: expect.objectContaining({
            investigationItems: baseProject.metadata.investigationItems,
          }),
        }),
      })
    );
  });

  it("handles project with no investigationItems in metadata gracefully", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue({
      ...baseProject,
      metadata: {},
    });
    mockPrismaAiJob.create.mockResolvedValue({ id: "job-3", status: "QUEUED" });

    const { POST } = await import(
      "../../app/api/projects/[projectId]/research/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/projects/proj-1/research") as never,
      { params: Promise.resolve({ projectId: "proj-1" }) }
    );
    // Still creates job with empty array
    expect(res.status).toBe(201);
    expect(mockPrismaAiJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ input: { investigationItems: [], clientContext: null } }),
      })
    );
  });
});

// ---- GET /api/projects/[projectId]/research ----

describe("GET /api/projects/[projectId]/research", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/projects/[projectId]/research/route"
    );
    const res = await GET(
      makeRequest("GET", "http://localhost/api/projects/proj-1/research") as never,
      { params: Promise.resolve({ projectId: "proj-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when project not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue(null);

    const { GET } = await import(
      "../../app/api/projects/[projectId]/research/route"
    );
    const res = await GET(
      makeRequest("GET", "http://localhost/api/projects/proj-999/research") as never,
      { params: Promise.resolve({ projectId: "proj-999" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when no AiJob exists for project", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue({ id: "proj-1" });
    mockPrismaAiJob.findFirst.mockResolvedValue(null);

    const { GET } = await import(
      "../../app/api/projects/[projectId]/research/route"
    );
    const res = await GET(
      makeRequest("GET", "http://localhost/api/projects/proj-1/research") as never,
      { params: Promise.resolve({ projectId: "proj-1" }) }
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns latest AiJob status and output", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue({ id: "proj-1" });

    const fakeJob = {
      id: "job-1",
      status: "COMPLETED",
      output: { reportDocumentId: "doc-1", report: { summary: "Done" } },
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-02"),
    };
    mockPrismaAiJob.findFirst.mockResolvedValue(fakeJob);

    const { GET } = await import(
      "../../app/api/projects/[projectId]/research/route"
    );
    const res = await GET(
      makeRequest("GET", "http://localhost/api/projects/proj-1/research") as never,
      { params: Promise.resolve({ projectId: "proj-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({
      aiJobId: "job-1",
      status: "COMPLETED",
      reportDocumentId: "doc-1",
    });
  });

  it("returns null reportDocumentId when output is null", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockPrismaProject.findFirst.mockResolvedValue({ id: "proj-1" });
    mockPrismaAiJob.findFirst.mockResolvedValue({
      id: "job-2",
      status: "QUEUED",
      output: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { GET } = await import(
      "../../app/api/projects/[projectId]/research/route"
    );
    const res = await GET(
      makeRequest("GET", "http://localhost/api/projects/proj-1/research") as never,
      { params: Promise.resolve({ projectId: "proj-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.reportDocumentId).toBeNull();
    expect(body.data.status).toBe("QUEUED");
  });
});

// ---- research-task service: buildResearchPrompt ----

describe("buildResearchPrompt", () => {
  it("builds a prompt with investigation items", async () => {
    const { buildResearchPrompt } = await import("../../lib/services/research-task");
    const prompt = buildResearchPrompt({
      investigationItems: [
        { topic: "Market Size", priority: "HIGH", description: "TAM/SAM/SOM" },
        { topic: "Competitors" },
      ],
    });
    expect(prompt).toContain("Market Size");
    expect(prompt).toContain("[HIGH]");
    expect(prompt).toContain("TAM/SAM/SOM");
    expect(prompt).toContain("Competitors");
  });

  it("includes clientContext when provided", async () => {
    const { buildResearchPrompt } = await import("../../lib/services/research-task");
    const prompt = buildResearchPrompt({
      investigationItems: [{ topic: "Topic A" }],
      clientContext: { industry: "FinTech" },
    });
    expect(prompt).toContain("Client Context");
    expect(prompt).toContain("FinTech");
  });

  it("omits clientContext section when not provided", async () => {
    const { buildResearchPrompt } = await import("../../lib/services/research-task");
    const prompt = buildResearchPrompt({
      investigationItems: [{ topic: "Topic A" }],
    });
    expect(prompt).not.toContain("Client Context");
  });
});

// ---- research-task service: executeResearchTask ----

describe("executeResearchTask", () => {
  beforeEach(() => vi.resetAllMocks());

  it("skips if AiJob not found", async () => {
    mockPrismaAiJob.findUnique.mockResolvedValue(null);
    const { executeResearchTask } = await import("../../lib/services/research-task");
    await expect(executeResearchTask("nonexistent")).resolves.toBeUndefined();
    expect(mockPrismaAiJob.update).not.toHaveBeenCalled();
  });

  it("skips if AiJob is not QUEUED", async () => {
    mockPrismaAiJob.findUnique.mockResolvedValue({
      id: "job-1",
      projectId: "proj-1",
      input: { investigationItems: [] },
      status: "RUNNING",
    });
    const { executeResearchTask } = await import("../../lib/services/research-task");
    await expect(executeResearchTask("job-1")).resolves.toBeUndefined();
    expect(mockPrismaAiJob.update).not.toHaveBeenCalled();
  });

  it("updates status to FAILED when projectId is missing", async () => {
    mockPrismaAiJob.findUnique.mockResolvedValue({
      id: "job-1",
      projectId: null,
      input: { investigationItems: [] },
      status: "QUEUED",
    });
    mockPrismaAiJob.update.mockResolvedValue({});

    const { executeResearchTask } = await import("../../lib/services/research-task");
    await executeResearchTask("job-1");

    expect(mockPrismaAiJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      })
    );
  });

  it("completes successfully: sets RUNNING, creates Document, sets COMPLETED", async () => {
    mockPrismaAiJob.findUnique.mockResolvedValue({
      id: "job-1",
      projectId: "proj-1",
      input: {
        investigationItems: [{ topic: "Market Size", priority: "HIGH" }],
        clientContext: { industry: "SaaS" },
      },
      status: "QUEUED",
    });
    mockPrismaAiJob.update.mockResolvedValue({});
    mockPrismaProject.findUnique.mockResolvedValue({ id: "proj-1", clientId: "client-1" });
    mockPrismaDocument.create.mockResolvedValue({ id: "doc-1" });

    const { executeResearchTask } = await import("../../lib/services/research-task");
    await executeResearchTask("job-1");

    // First update: RUNNING
    expect(mockPrismaAiJob.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: { status: "RUNNING" } })
    );

    // Document created with OUTPUT category
    expect(mockPrismaDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: "OUTPUT",
          projectId: "proj-1",
          clientId: "client-1",
        }),
      })
    );

    // Second update: COMPLETED with output
    expect(mockPrismaAiJob.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED",
          output: expect.objectContaining({ reportDocumentId: "doc-1" }),
        }),
      })
    );
  });

  it("sets FAILED status when Document creation throws", async () => {
    mockPrismaAiJob.findUnique.mockResolvedValue({
      id: "job-1",
      projectId: "proj-1",
      input: { investigationItems: [] },
      status: "QUEUED",
    });
    mockPrismaAiJob.update.mockResolvedValue({});
    mockPrismaProject.findUnique.mockResolvedValue({ id: "proj-1", clientId: "client-1" });
    mockPrismaDocument.create.mockRejectedValue(new Error("DB write error"));

    const { executeResearchTask } = await import("../../lib/services/research-task");
    await executeResearchTask("job-1");

    const lastCall = mockPrismaAiJob.update.mock.calls.at(-1);
    expect(lastCall?.[0]).toMatchObject({
      data: expect.objectContaining({ status: "FAILED", errorMessage: "DB write error" }),
    });
  });
});

// ---- Validation: researchTaskMetadataSchema ----

describe("researchTaskMetadataSchema", () => {
  it("accepts valid metadata with one item", async () => {
    const { researchTaskMetadataSchema } = await import("../../lib/validations/project");
    const result = researchTaskMetadataSchema.safeParse({
      investigationItems: [{ topic: "Market Analysis", priority: "HIGH" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty investigationItems array", async () => {
    const { researchTaskMetadataSchema } = await import("../../lib/validations/project");
    const result = researchTaskMetadataSchema.safeParse({
      investigationItems: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects items missing topic", async () => {
    const { researchTaskMetadataSchema } = await import("../../lib/validations/project");
    const result = researchTaskMetadataSchema.safeParse({
      investigationItems: [{ description: "no topic here" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid priority value", async () => {
    const { researchTaskMetadataSchema } = await import("../../lib/validations/project");
    const result = researchTaskMetadataSchema.safeParse({
      investigationItems: [{ topic: "Topic", priority: "CRITICAL" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields: description, clientContext", async () => {
    const { researchTaskMetadataSchema } = await import("../../lib/validations/project");
    const result = researchTaskMetadataSchema.safeParse({
      investigationItems: [
        { topic: "Topic A", description: "Detailed desc", priority: "LOW" },
      ],
      clientContext: { note: "anything" },
    });
    expect(result.success).toBe(true);
  });
});

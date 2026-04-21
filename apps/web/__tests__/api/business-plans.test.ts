/**
 * WI-202 — unit tests for POST /api/business-plans,
 * GET /api/business-plans/[jobId], and the underlying pipeline service.
 *
 * The docgen engines and the Supabase upload helper are mocked so this runs
 * without any network / DB dependency.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Prisma mock ---
const mockAiJob = {
  create: vi.fn(),
  update: vi.fn().mockResolvedValue({}),
  findFirst: vi.fn(),
};
const mockProject = {
  findFirst: vi.fn(),
};
const mockDocument = {
  create: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    aiJob: mockAiJob,
    project: mockProject,
    document: mockDocument,
  },
}));

vi.mock("@axle/auth", () => ({
  getCurrentUser: vi.fn(),
}));

// --- Docgen mocks ---
const mockGenerateRagDraft = vi.fn();
const mockGeneratePrecisionDocx = vi.fn();
const mockVerify = vi.fn();

vi.mock("@axle/docgen", () => ({
  generateRagDraft: (input: unknown) => mockGenerateRagDraft(input),
  generatePrecisionDocx: (input: unknown) => mockGeneratePrecisionDocx(input),
  verify: (input: unknown) => mockVerify(input),
  REQUIRED_SECTIONS: [
    "사업 개요",
    "기술 설명",
    "시장 분석",
    "실행 계획",
    "기대 효과",
  ],
}));

// --- Storage mock ---
const mockUploadFile = vi.fn();
vi.mock("@axle/storage", () => ({
  uploadFile: (...args: unknown[]) => mockUploadFile(...args),
}));

// --- Event bus mock ---
const mockEmit = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/events/event-bus", () => ({
  eventBus: {
    emit: (...args: unknown[]) => mockEmit(...args),
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

beforeEach(() => {
  vi.clearAllMocks();
});

// ==================== Zod schema ====================

describe("businessPlanCreateSchema", () => {
  it("accepts minimal valid input and applies default engine", async () => {
    const { businessPlanCreateSchema } = await import(
      "../../lib/validations/business-plan"
    );
    const result = businessPlanCreateSchema.safeParse({ projectId: "p-1" });
    expect(result.success).toBe(true);
    expect(result.data?.engine).toBe("both");
  });

  it("rejects missing projectId", async () => {
    const { businessPlanCreateSchema } = await import(
      "../../lib/validations/business-plan"
    );
    const result = businessPlanCreateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects unknown engine value", async () => {
    const { businessPlanCreateSchema } = await import(
      "../../lib/validations/business-plan"
    );
    const result = businessPlanCreateSchema.safeParse({
      projectId: "p-1",
      engine: "turbo",
    });
    expect(result.success).toBe(false);
  });

  it("accepts sections array override", async () => {
    const { businessPlanCreateSchema } = await import(
      "../../lib/validations/business-plan"
    );
    const result = businessPlanCreateSchema.safeParse({
      projectId: "p-1",
      sections: ["사업 개요"],
      engine: "rag",
    });
    expect(result.success).toBe(true);
    expect(result.data?.sections).toEqual(["사업 개요"]);
  });
});

// ==================== POST /api/business-plans ====================

describe("POST /api/business-plans", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import("../../app/api/business-plans/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/business-plans", {
        projectId: "p-1",
      }) as any
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no active organization", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      orgId: null,
    } as any);
    const { POST } = await import("../../app/api/business-plans/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/business-plans", {
        projectId: "p-1",
      }) as any
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when body fails Zod validation", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);
    const { POST } = await import("../../app/api/business-plans/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/business-plans", {
        engine: "both",
      }) as any
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when project does not belong to caller's org", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);
    mockProject.findFirst.mockResolvedValue(null);

    const { POST } = await import("../../app/api/business-plans/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/business-plans", {
        projectId: "foreign-project",
      }) as any
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when neither programId is provided nor stored on project", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);
    mockProject.findFirst.mockResolvedValue({
      id: "p-1",
      clientId: "c-1",
      programId: null,
      assignedToId: null,
      client: { orgId: "org-1" },
    });

    const { POST } = await import("../../app/api/business-plans/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/business-plans", {
        projectId: "p-1",
      }) as any
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("PROGRAM_ID_REQUIRED");
  });

  it("queues an AiJob and returns 201 with jobId", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);
    mockProject.findFirst.mockResolvedValue({
      id: "p-1",
      clientId: "c-1",
      programId: "prog-1",
      assignedToId: "user-2",
      client: { orgId: "org-1" },
    });
    mockAiJob.create.mockResolvedValue({ id: "job-1", status: "QUEUED" });
    // Keep the fire-and-forget pipeline quiet: return a non-pending promise so
    // the test completes without unhandled rejections.
    mockGenerateRagDraft.mockResolvedValue({
      sections: [{ title: "사업 개요", content: "x".repeat(600) }],
      metadata: { sourceDocs: [] },
    });
    mockGeneratePrecisionDocx.mockResolvedValue({
      docxBuffer: Buffer.from("docx"),
      fileName: "plan.docx",
    });
    mockVerify.mockResolvedValue({
      isComplete: true,
      completenessScore: 100,
      missingItems: [],
      formatIssues: [],
    });
    mockUploadFile.mockResolvedValue({
      path: "org-1/exports/uuid-plan.docx",
      url: "https://storage/plan.docx",
      size: 4,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    mockDocument.create.mockResolvedValue({ id: "doc-1" });

    const { POST } = await import("../../app/api/business-plans/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/business-plans", {
        projectId: "p-1",
        engine: "both",
      }) as any
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data).toEqual({ jobId: "job-1", status: "QUEUED" });
    expect(mockAiJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId: "org-1",
          projectId: "p-1",
          type: "BUSINESS_PLAN",
          tier: "CLI_CLAUDE",
          status: "QUEUED",
        }),
      })
    );
  });
});

// ==================== GET /api/business-plans/[jobId] ====================

describe("GET /api/business-plans/[jobId]", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import("../../app/api/business-plans/[jobId]/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/business-plans/job-1") as any,
      { params: Promise.resolve({ jobId: "job-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns job status for owning org", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);
    mockAiJob.findFirst.mockResolvedValue({
      id: "job-1",
      status: "COMPLETED",
      output: { documentId: "doc-1" },
      errorMessage: null,
      durationMs: 1234,
      createdAt: new Date("2026-04-21T00:00:00Z"),
    });

    const { GET } = await import("../../app/api/business-plans/[jobId]/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/business-plans/job-1") as any,
      { params: Promise.resolve({ jobId: "job-1" }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.jobId).toBe("job-1");
    expect(json.data.status).toBe("COMPLETED");
    expect(json.data.output).toEqual({ documentId: "doc-1" });
  });

  it("returns 404 when the job is not scoped to caller's org", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);
    mockAiJob.findFirst.mockResolvedValue(null);

    const { GET } = await import("../../app/api/business-plans/[jobId]/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/business-plans/other-org") as any,
      { params: Promise.resolve({ jobId: "other-org" }) }
    );
    expect(res.status).toBe(404);
  });
});

// ==================== Pipeline service ====================

describe("runBusinessPlanPipeline", () => {
  const baseParams = {
    jobId: "job-1",
    projectId: "p-1",
    clientId: "c-1",
    orgId: "org-1",
    programId: "prog-1",
    assigneeId: "user-2",
    engine: "both" as const,
  };

  it("produces Document row + AI_JOB_COMPLETE on happy path", async () => {
    mockGenerateRagDraft.mockResolvedValue({
      sections: [
        { title: "사업 개요", content: "A".repeat(600) },
        { title: "기술 설명", content: "B".repeat(600) },
      ],
      metadata: { sourceDocs: ["doc-seed"], tokensUsed: 123 },
    });
    mockGeneratePrecisionDocx.mockResolvedValue({
      docxBuffer: Buffer.from("docx-bytes"),
      fileName: "biz.docx",
    });
    mockVerify.mockResolvedValue({
      isComplete: true,
      completenessScore: 95,
      missingItems: [],
      formatIssues: [],
    });
    mockUploadFile.mockResolvedValue({
      path: "org-1/exports/uuid-biz.docx",
      url: "https://cdn/biz.docx",
      size: 10,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    mockDocument.create.mockResolvedValue({ id: "doc-42" });

    const { runBusinessPlanPipeline } = await import(
      "../../lib/services/business-plan-pipeline"
    );

    await runBusinessPlanPipeline(baseParams);

    expect(mockGenerateRagDraft).toHaveBeenCalledWith({
      clientId: "c-1",
      programId: "prog-1",
      projectId: "p-1",
    });
    expect(mockGeneratePrecisionDocx).toHaveBeenCalledTimes(1);
    expect(mockVerify).toHaveBeenCalledTimes(1);
    expect(mockUploadFile).toHaveBeenCalledWith(
      "exports",
      "biz.docx",
      expect.any(Buffer),
      expect.objectContaining({
        orgId: "org-1",
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
    );
    expect(mockDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: "c-1",
          projectId: "p-1",
          fileUrl: "https://cdn/biz.docx",
          category: "OUTPUT",
        }),
      })
    );

    // AiJob transitions: RUNNING then COMPLETED with output
    const updates = mockAiJob.update.mock.calls.map((c) => c[0]);
    expect(updates[0]).toMatchObject({
      where: { id: "job-1" },
      data: { status: "RUNNING" },
    });
    const completion = updates[updates.length - 1];
    expect(completion.data.status).toBe("COMPLETED");
    expect(completion.data.output).toMatchObject({
      documentId: "doc-42",
      docxUrl: "https://cdn/biz.docx",
      rag: expect.objectContaining({ sourceDocs: ["doc-seed"] }),
      verification: expect.objectContaining({ completenessScore: 95 }),
    });

    expect(mockEmit).toHaveBeenCalledWith(
      "AI_JOB_COMPLETE",
      expect.objectContaining({
        jobId: "job-1",
        jobType: "BUSINESS_PLAN",
        assigneeId: "user-2",
        resultUrl: "https://cdn/biz.docx",
      })
    );
  });

  it("skips precision + upload when engine='rag'", async () => {
    mockGenerateRagDraft.mockResolvedValue({
      sections: [{ title: "사업 개요", content: "draft" }],
      metadata: { sourceDocs: [] },
    });

    const { runBusinessPlanPipeline } = await import(
      "../../lib/services/business-plan-pipeline"
    );

    await runBusinessPlanPipeline({ ...baseParams, engine: "rag" });

    expect(mockGeneratePrecisionDocx).not.toHaveBeenCalled();
    expect(mockUploadFile).not.toHaveBeenCalled();
    expect(mockDocument.create).not.toHaveBeenCalled();

    const completion = mockAiJob.update.mock.calls
      .map((c) => c[0])
      .find((u) => u.data?.status === "COMPLETED");
    expect(completion).toBeTruthy();
    expect(completion.data.output).not.toHaveProperty("documentId");
  });

  it("marks AiJob FAILED when RAG draft throws", async () => {
    mockGenerateRagDraft.mockRejectedValue(new Error("pgvector offline"));

    const { runBusinessPlanPipeline } = await import(
      "../../lib/services/business-plan-pipeline"
    );

    await runBusinessPlanPipeline(baseParams);

    expect(mockGeneratePrecisionDocx).not.toHaveBeenCalled();
    expect(mockUploadFile).not.toHaveBeenCalled();
    expect(mockDocument.create).not.toHaveBeenCalled();

    const failure = mockAiJob.update.mock.calls
      .map((c) => c[0])
      .find((u) => u.data?.status === "FAILED");
    expect(failure).toBeTruthy();
    expect(failure.data.errorMessage).toBe("pgvector offline");
    expect(mockEmit).toHaveBeenCalledWith(
      "AI_JOB_FAILED",
      expect.objectContaining({
        jobId: "job-1",
        errorMessage: "pgvector offline",
      })
    );
  });
});

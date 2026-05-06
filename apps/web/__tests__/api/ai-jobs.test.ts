import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockAiJob = {
  findMany: vi.fn(),
  count: vi.fn().mockResolvedValue(0),
  findFirst: vi.fn(),
  findUnique: vi.fn().mockResolvedValue(null),
  create: vi.fn(),
  update: vi.fn(),
};

const mockProject = {
  findFirst: vi.fn(),
};

const mockOrganization = {
  findUnique: vi.fn().mockResolvedValue({ quotaAiJobs: 10000 }),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    aiJob: mockAiJob,
    project: mockProject,
    organization: mockOrganization,
  },
}));

vi.mock("@axle/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@axle/ai", () => ({
  resolveAiTier: vi.fn((jobType: string) => {
    if (jobType === "BUSINESS_PLAN" || jobType === "RESEARCH") return "CLI_CLAUDE";
    return "API_HAIKU";
  }),
  extractAndStorePattern: vi.fn().mockResolvedValue(undefined),
  // ai-dispatcher.ensureInitialized() calls registerBuiltinHandlers and the
  // RESEARCH handler imports completeWithFallback at module load. Both must
  // be present in the mock or vitest throws an unhandled
  // "No '<export>' export is defined" error during runJob teardown.
  // Mirrors the pattern in __tests__/api/cron/cron-routes.test.ts.
  registerBuiltinHandlers: vi.fn(),
  dispatch: vi.fn().mockResolvedValue({ ok: true }),
  UnknownJobTypeError: class UnknownJobTypeError extends Error {},
  InvalidJobInputError: class InvalidJobInputError extends Error {},
  completeWithFallback: vi.fn(),
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

// ==================== Validation schemas ====================

describe("aiJobCreateSchema", () => {
  it("accepts minimal valid input", async () => {
    const { aiJobCreateSchema } = await import("../../lib/validations/ai-job");
    const result = aiJobCreateSchema.safeParse({
      type: "BUSINESS_PLAN",
      input: { prompt: "hello" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing type", async () => {
    const { aiJobCreateSchema } = await import("../../lib/validations/ai-job");
    const result = aiJobCreateSchema.safeParse({ input: {} });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", async () => {
    const { aiJobCreateSchema } = await import("../../lib/validations/ai-job");
    const result = aiJobCreateSchema.safeParse({ type: "UNKNOWN", input: {} });
    expect(result.success).toBe(false);
  });

  it("accepts optional tier override", async () => {
    const { aiJobCreateSchema } = await import("../../lib/validations/ai-job");
    const result = aiJobCreateSchema.safeParse({
      type: "SUMMARY",
      input: {},
      tier: "LOCAL_MLX",
    });
    expect(result.success).toBe(true);
    expect(result.data?.tier).toBe("LOCAL_MLX");
  });

  it("accepts all 10 valid job types", async () => {
    const { aiJobCreateSchema } = await import("../../lib/validations/ai-job");
    const types = [
      "BUSINESS_PLAN", "RESEARCH", "OCR", "TRANSCRIBE", "SUMMARY",
      "JOURNAL_DRAFT", "FINANCIAL_ANALYSIS", "GAP_DIAGNOSIS", "EVALUATION", "MATCHING",
    ];
    for (const type of types) {
      const result = aiJobCreateSchema.safeParse({ type, input: {} });
      expect(result.success, `type ${type} should be valid`).toBe(true);
    }
  });
});

describe("aiJobQuerySchema", () => {
  it("uses defaults for page and pageSize", async () => {
    const { aiJobQuerySchema } = await import("../../lib/validations/ai-job");
    const result = aiJobQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.page).toBe(1);
    expect(result.data?.pageSize).toBe(20);
  });

  it("coerces string numbers", async () => {
    const { aiJobQuerySchema } = await import("../../lib/validations/ai-job");
    const result = aiJobQuerySchema.safeParse({ page: "2", pageSize: "50" });
    expect(result.success).toBe(true);
    expect(result.data?.page).toBe(2);
    expect(result.data?.pageSize).toBe(50);
  });

  it("rejects pageSize > 100", async () => {
    const { aiJobQuerySchema } = await import("../../lib/validations/ai-job");
    const result = aiJobQuerySchema.safeParse({ pageSize: "200" });
    expect(result.success).toBe(false);
  });
});

describe("aiJobStatusUpdateSchema", () => {
  it("accepts status update only", async () => {
    const { aiJobStatusUpdateSchema } = await import("../../lib/validations/ai-job");
    const result = aiJobStatusUpdateSchema.safeParse({ status: "RUNNING" });
    expect(result.success).toBe(true);
  });

  it("accepts status with output", async () => {
    const { aiJobStatusUpdateSchema } = await import("../../lib/validations/ai-job");
    const result = aiJobStatusUpdateSchema.safeParse({
      status: "COMPLETED",
      output: { result: "done" },
      durationMs: 1500,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", async () => {
    const { aiJobStatusUpdateSchema } = await import("../../lib/validations/ai-job");
    const result = aiJobStatusUpdateSchema.safeParse({ status: "INVALID" });
    expect(result.success).toBe(false);
  });
});

// ==================== GET /api/ai/jobs ====================

describe("GET /api/ai/jobs", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import("../../app/api/ai/jobs/route");
    const res = await GET(makeRequest("GET", "http://localhost/api/ai/jobs") as any);
    expect(res.status).toBe(401);
  });

  it("returns paginated job list for authenticated user", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);
    const fakeJobs = [{ id: "job-1", type: "SUMMARY", status: "QUEUED" }];
    mockAiJob.findMany.mockResolvedValue(fakeJobs);
    mockAiJob.count.mockResolvedValue(1);

    const { GET } = await import("../../app/api/ai/jobs/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/ai/jobs?page=1&pageSize=20") as any
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(fakeJobs);
    expect(json.total).toBe(1);
  });

  it("applies projectId filter", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);
    mockAiJob.findMany.mockResolvedValue([]);
    mockAiJob.count.mockResolvedValue(0);

    const { GET } = await import("../../app/api/ai/jobs/route");
    await GET(
      makeRequest("GET", "http://localhost/api/ai/jobs?projectId=proj-1") as any
    );

    expect(mockAiJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectId: "proj-1" }),
      })
    );
  });
});

// ==================== POST /api/ai/jobs ====================

describe("POST /api/ai/jobs", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import("../../app/api/ai/jobs/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/ai/jobs", { type: "SUMMARY", input: {} }) as any
    );
    expect(res.status).toBe(401);
  });

  it("creates job with auto-resolved tier", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);
    const fakeJob = { id: "job-1", type: "BUSINESS_PLAN", tier: "CLI_CLAUDE", status: "QUEUED" };
    mockAiJob.create.mockResolvedValue(fakeJob);

    const { POST } = await import("../../app/api/ai/jobs/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/ai/jobs", {
        type: "BUSINESS_PLAN",
        input: { prompt: "write a plan" },
      }) as any
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data).toEqual(fakeJob);
    expect(mockAiJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "BUSINESS_PLAN",
          tier: "CLI_CLAUDE",
          status: "QUEUED",
        }),
      })
    );
  });

  it("returns 400 for invalid type", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);
    const { POST } = await import("../../app/api/ai/jobs/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/ai/jobs", { type: "INVALID", input: {} }) as any
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when projectId does not belong to org", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);
    mockProject.findFirst.mockResolvedValue(null);

    const { POST } = await import("../../app/api/ai/jobs/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/ai/jobs", {
        type: "SUMMARY",
        input: {},
        projectId: "other-org-project",
      }) as any
    );
    expect(res.status).toBe(404);
  });
});

// ==================== GET /api/ai/jobs/[jobId] ====================

describe("GET /api/ai/jobs/[jobId]", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import("../../app/api/ai/jobs/[jobId]/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/ai/jobs/job-1") as any,
      { params: Promise.resolve({ jobId: "job-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns job with output", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);
    const fakeJob = {
      id: "job-1",
      status: "COMPLETED",
      output: { text: "result" },
    };
    mockAiJob.findFirst.mockResolvedValue(fakeJob);

    const { GET } = await import("../../app/api/ai/jobs/[jobId]/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/ai/jobs/job-1") as any,
      { params: Promise.resolve({ jobId: "job-1" }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(fakeJob);
  });

  it("returns 404 when job not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);
    mockAiJob.findFirst.mockResolvedValue(null);

    const { GET } = await import("../../app/api/ai/jobs/[jobId]/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/ai/jobs/missing") as any,
      { params: Promise.resolve({ jobId: "missing" }) }
    );
    expect(res.status).toBe(404);
  });
});

// ==================== PATCH /api/ai/jobs/[jobId] ====================

describe("PATCH /api/ai/jobs/[jobId]", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { PATCH } = await import("../../app/api/ai/jobs/[jobId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/ai/jobs/job-1", { status: "RUNNING" }) as any,
      { params: Promise.resolve({ jobId: "job-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("updates job status", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);
    mockAiJob.findFirst.mockResolvedValue({ id: "job-1", status: "RUNNING" });
    const updatedJob = { id: "job-1", status: "COMPLETED" };
    mockAiJob.update.mockResolvedValue(updatedJob);

    const { PATCH } = await import("../../app/api/ai/jobs/[jobId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/ai/jobs/job-1", {
        status: "COMPLETED",
        output: { result: "done" },
        durationMs: 2000,
      }) as any,
      { params: Promise.resolve({ jobId: "job-1" }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(updatedJob);
  });

  it("returns 404 when job not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);
    mockAiJob.findFirst.mockResolvedValue(null);

    const { PATCH } = await import("../../app/api/ai/jobs/[jobId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/ai/jobs/missing", { status: "RUNNING" }) as any,
      { params: Promise.resolve({ jobId: "missing" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid status", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as any);
    mockAiJob.findFirst.mockResolvedValue({ id: "job-1" });

    const { PATCH } = await import("../../app/api/ai/jobs/[jobId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/ai/jobs/job-1", { status: "INVALID" }) as any,
      { params: Promise.resolve({ jobId: "job-1" }) }
    );
    expect(res.status).toBe(400);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockJournalOps = {
  findMany: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockClientOps = {
  findFirst: vi.fn(),
  findUnique: vi.fn(),
};

const mockContactOps = {
  findFirst: vi.fn(),
  findMany: vi.fn(),
};

const mockAiJobOps = {
  create: vi.fn(),
};

const mockDocumentOps = {
  create: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    researchJournal: mockJournalOps,
    client: mockClientOps,
    contact: mockContactOps,
    aiJob: mockAiJobOps,
    document: mockDocumentOps,
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
}));

const mockCreateAiJob = vi.fn();
const mockResolveProvider = vi.fn();
const mockUpdateJobStatus = vi.fn();

vi.mock("@axle/ai", () => ({
  createAiJob: mockCreateAiJob,
  resolveProvider: mockResolveProvider,
  updateJobStatus: mockUpdateJobStatus,
}));

vi.mock("@axle/docgen", () => ({
  generateJournalReportDocx: vi.fn().mockResolvedValue(Buffer.from("fake-docx")),
}));

vi.mock("@axle/storage", () => ({
  uploadFile: vi.fn().mockResolvedValue({
    path: "org-1/documents/fake.docx",
    url: "https://storage.example.com/fake.docx",
    size: 10,
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }),
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

const BASE_JOURNAL = {
  id: "j1",
  clientId: "c1",
  researcherContactId: "r1",
  date: new Date("2025-03-05"),
  title: "AI 연구",
  content: "딥러닝 연구 내용",
  status: "DRAFT",
  hours: null,
  approvedAt: null,
  approvedBy: null,
  aiDraftJobId: null,
  objectives: null,
  results: null,
  nextSteps: null,
  attachments: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  client: { id: "c1", name: "테스트연구소" },
  researcher: { id: "r1", name: "홍길동", position: "연구원" },
};

// ─── Validation schema tests ──────────────────────────────────────────────────

describe("journalCreateSchema", () => {
  it("accepts minimal valid input", async () => {
    const { journalCreateSchema } = await import("../../lib/validations/journal");
    const result = journalCreateSchema.safeParse({
      clientId: "c1",
      researcherContactId: "r1",
      date: "2025-03-05T00:00:00.000Z",
      title: "AI 연구",
      content: "연구 내용",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing clientId", async () => {
    const { journalCreateSchema } = await import("../../lib/validations/journal");
    const result = journalCreateSchema.safeParse({
      researcherContactId: "r1",
      date: "2025-03-05T00:00:00.000Z",
      title: "AI 연구",
      content: "연구 내용",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing title", async () => {
    const { journalCreateSchema } = await import("../../lib/validations/journal");
    const result = journalCreateSchema.safeParse({
      clientId: "c1",
      researcherContactId: "r1",
      date: "2025-03-05T00:00:00.000Z",
      content: "연구 내용",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format", async () => {
    const { journalCreateSchema } = await import("../../lib/validations/journal");
    const result = journalCreateSchema.safeParse({
      clientId: "c1",
      researcherContactId: "r1",
      date: "not-a-date",
      title: "AI 연구",
      content: "연구 내용",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional objectives, results, nextSteps, hours", async () => {
    const { journalCreateSchema } = await import("../../lib/validations/journal");
    const result = journalCreateSchema.safeParse({
      clientId: "c1",
      researcherContactId: "r1",
      date: "2025-03-05T00:00:00.000Z",
      title: "AI 연구",
      content: "연구 내용",
      objectives: "목표",
      results: "결과",
      nextSteps: "계획",
      hours: 6,
    });
    expect(result.success).toBe(true);
  });
});

describe("journalQuerySchema", () => {
  it("applies defaults when params are absent", async () => {
    const { journalQuerySchema } = await import("../../lib/validations/journal");
    const result = journalQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("accepts status filter", async () => {
    const { journalQuerySchema } = await import("../../lib/validations/journal");
    const result = journalQuerySchema.safeParse({ status: "APPROVED" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("APPROVED");
    }
  });

  it("rejects invalid status", async () => {
    const { journalQuerySchema } = await import("../../lib/validations/journal");
    const result = journalQuerySchema.safeParse({ status: "INVALID" });
    expect(result.success).toBe(false);
  });
});

describe("monthlyReportSchema", () => {
  it("accepts valid input", async () => {
    const { monthlyReportSchema } = await import("../../lib/validations/journal");
    const result = monthlyReportSchema.safeParse({
      clientId: "c1",
      year: 2025,
      month: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects month > 12", async () => {
    const { monthlyReportSchema } = await import("../../lib/validations/journal");
    const result = monthlyReportSchema.safeParse({
      clientId: "c1",
      year: 2025,
      month: 13,
    });
    expect(result.success).toBe(false);
  });

  it("rejects month < 1", async () => {
    const { monthlyReportSchema } = await import("../../lib/validations/journal");
    const result = monthlyReportSchema.safeParse({
      clientId: "c1",
      year: 2025,
      month: 0,
    });
    expect(result.success).toBe(false);
  });
});

// ─── GET /api/journals ────────────────────────────────────────────────────────

describe("GET /api/journals", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import("../../app/api/journals/route");
    const res = await GET(makeRequest("GET", "http://localhost/api/journals") as never);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no orgId", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      orgId: null,
      email: "a@test.com",
    } as never);
    const { GET } = await import("../../app/api/journals/route");
    const res = await GET(makeRequest("GET", "http://localhost/api/journals") as never);
    expect(res.status).toBe(403);
  });

  it("returns paginated journals", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockJournalOps.findMany.mockResolvedValue([BASE_JOURNAL]);
    mockJournalOps.count.mockResolvedValue(1);
    const { GET } = await import("../../app/api/journals/route");
    const res = await GET(makeRequest("GET", "http://localhost/api/journals") as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("filters by status query param", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockJournalOps.findMany.mockResolvedValue([]);
    mockJournalOps.count.mockResolvedValue(0);
    const { GET } = await import("../../app/api/journals/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/journals?status=APPROVED") as never
    );
    expect(res.status).toBe(200);
  });
});

// ─── POST /api/journals ───────────────────────────────────────────────────────

describe("POST /api/journals", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import("../../app/api/journals/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/journals", {
        clientId: "c1",
        researcherContactId: "r1",
        date: "2025-03-05T00:00:00.000Z",
        title: "AI 연구",
        content: "내용",
      }) as never
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 on missing required fields", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    const { POST } = await import("../../app/api/journals/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/journals", { title: "AI 연구" }) as never
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when client not in org", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockClientOps.findFirst.mockResolvedValue(null);
    const { POST } = await import("../../app/api/journals/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/journals", {
        clientId: "c-other",
        researcherContactId: "r1",
        date: "2025-03-05T00:00:00.000Z",
        title: "AI 연구",
        content: "내용",
      }) as never
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when researcher contact not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockClientOps.findFirst.mockResolvedValue({ id: "c1" });
    mockContactOps.findFirst.mockResolvedValue(null);
    const { POST } = await import("../../app/api/journals/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/journals", {
        clientId: "c1",
        researcherContactId: "r-nonexistent",
        date: "2025-03-05T00:00:00.000Z",
        title: "AI 연구",
        content: "내용",
      }) as never
    );
    expect(res.status).toBe(404);
  });

  it("creates journal and returns 201", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockClientOps.findFirst.mockResolvedValue({ id: "c1" });
    mockContactOps.findFirst.mockResolvedValue({ id: "r1" });
    mockJournalOps.create.mockResolvedValue(BASE_JOURNAL);
    const { POST } = await import("../../app/api/journals/route");
    const res = await POST(
      makeRequest("POST", "http://localhost/api/journals", {
        clientId: "c1",
        researcherContactId: "r1",
        date: "2025-03-05T00:00:00.000Z",
        title: "AI 연구",
        content: "내용",
      }) as never
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("j1");
  });
});

// ─── GET /api/journals/[journalId] ────────────────────────────────────────────

describe("GET /api/journals/[journalId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import("../../app/api/journals/[journalId]/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/journals/j1") as never,
      { params: Promise.resolve({ journalId: "j1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when journal not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockJournalOps.findFirst.mockResolvedValue(null);
    const { GET } = await import("../../app/api/journals/[journalId]/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/journals/j1") as never,
      { params: Promise.resolve({ journalId: "j1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns journal detail", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockJournalOps.findFirst.mockResolvedValue(BASE_JOURNAL);
    const { GET } = await import("../../app/api/journals/[journalId]/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/journals/j1") as never,
      { params: Promise.resolve({ journalId: "j1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("j1");
  });
});

// ─── PATCH /api/journals/[journalId] ─────────────────────────────────────────

describe("PATCH /api/journals/[journalId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 when journal not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockJournalOps.findFirst.mockResolvedValue(null);
    const { PATCH } = await import("../../app/api/journals/[journalId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/journals/j1", { title: "Updated" }) as never,
      { params: Promise.resolve({ journalId: "j1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when journal is not DRAFT", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockJournalOps.findFirst.mockResolvedValue({ id: "j1", status: "APPROVED" });
    const { PATCH } = await import("../../app/api/journals/[journalId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/journals/j1", { title: "Updated" }) as never,
      { params: Promise.resolve({ journalId: "j1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("updates journal and returns 200", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockJournalOps.findFirst.mockResolvedValue({ id: "j1", status: "DRAFT" });
    mockJournalOps.update.mockResolvedValue({ ...BASE_JOURNAL, title: "Updated" });
    const { PATCH } = await import("../../app/api/journals/[journalId]/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/journals/j1", { title: "Updated" }) as never,
      { params: Promise.resolve({ journalId: "j1" }) }
    );
    expect(res.status).toBe(200);
  });
});

// ─── DELETE /api/journals/[journalId] ────────────────────────────────────────

describe("DELETE /api/journals/[journalId]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 when journal not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockJournalOps.findFirst.mockResolvedValue(null);
    const { DELETE } = await import("../../app/api/journals/[journalId]/route");
    const res = await DELETE(
      makeRequest("DELETE", "http://localhost/api/journals/j1") as never,
      { params: Promise.resolve({ journalId: "j1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when journal is not DRAFT", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockJournalOps.findFirst.mockResolvedValue({ id: "j1", status: "SUBMITTED" });
    const { DELETE } = await import("../../app/api/journals/[journalId]/route");
    const res = await DELETE(
      makeRequest("DELETE", "http://localhost/api/journals/j1") as never,
      { params: Promise.resolve({ journalId: "j1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("deletes journal and returns 200", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockJournalOps.findFirst.mockResolvedValue({ id: "j1", status: "DRAFT" });
    mockJournalOps.delete.mockResolvedValue({ id: "j1" });
    const { DELETE } = await import("../../app/api/journals/[journalId]/route");
    const res = await DELETE(
      makeRequest("DELETE", "http://localhost/api/journals/j1") as never,
      { params: Promise.resolve({ journalId: "j1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deleted).toBe(true);
  });
});

// ─── POST /api/journals/[journalId]/submit ────────────────────────────────────

describe("POST /api/journals/[journalId]/submit", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/journals/[journalId]/submit/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/journals/j1/submit") as never,
      { params: Promise.resolve({ journalId: "j1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when journal not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockJournalOps.findFirst.mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/journals/[journalId]/submit/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/journals/j1/submit") as never,
      { params: Promise.resolve({ journalId: "j1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when journal is not DRAFT", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockJournalOps.findFirst.mockResolvedValue({ id: "j1", status: "SUBMITTED" });
    const { POST } = await import(
      "../../app/api/journals/[journalId]/submit/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/journals/j1/submit") as never,
      { params: Promise.resolve({ journalId: "j1" }) }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_TRANSITION");
  });

  it("transitions DRAFT → SUBMITTED and returns 200", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockJournalOps.findFirst.mockResolvedValue({ id: "j1", status: "DRAFT" });
    mockJournalOps.update.mockResolvedValue({
      id: "j1",
      status: "SUBMITTED",
      updatedAt: new Date(),
    });
    const { POST } = await import(
      "../../app/api/journals/[journalId]/submit/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/journals/j1/submit") as never,
      { params: Promise.resolve({ journalId: "j1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("SUBMITTED");
  });
});

// ─── POST /api/journals/[journalId]/approve ───────────────────────────────────

describe("POST /api/journals/[journalId]/approve", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 when journal is not SUBMITTED", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockJournalOps.findFirst.mockResolvedValue({ id: "j1", status: "DRAFT" });
    const { POST } = await import(
      "../../app/api/journals/[journalId]/approve/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/journals/j1/approve") as never,
      { params: Promise.resolve({ journalId: "j1" }) }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_TRANSITION");
  });

  it("returns 400 when journal is already APPROVED", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockJournalOps.findFirst.mockResolvedValue({ id: "j1", status: "APPROVED" });
    const { POST } = await import(
      "../../app/api/journals/[journalId]/approve/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/journals/j1/approve") as never,
      { params: Promise.resolve({ journalId: "j1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("transitions SUBMITTED → APPROVED with approvedBy/approvedAt", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockJournalOps.findFirst.mockResolvedValue({ id: "j1", status: "SUBMITTED" });
    const now = new Date();
    mockJournalOps.update.mockResolvedValue({
      id: "j1",
      status: "APPROVED",
      approvedBy: "user-1",
      approvedAt: now,
      updatedAt: now,
    });
    const { POST } = await import(
      "../../app/api/journals/[journalId]/approve/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/journals/j1/approve") as never,
      { params: Promise.resolve({ journalId: "j1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("APPROVED");
    expect(body.data.approvedBy).toBe("user-1");
  });
});

// ─── POST /api/journals/[journalId]/ai-draft ─────────────────────────────────

describe("POST /api/journals/[journalId]/ai-draft", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/journals/[journalId]/ai-draft/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/journals/j1/ai-draft") as never,
      { params: Promise.resolve({ journalId: "j1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when journal not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockJournalOps.findFirst.mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/journals/[journalId]/ai-draft/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/journals/j1/ai-draft") as never,
      { params: Promise.resolve({ journalId: "j1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("creates AI draft job and returns 201", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockJournalOps.findFirst.mockResolvedValue(BASE_JOURNAL);
    mockJournalOps.update.mockResolvedValue({ ...BASE_JOURNAL, aiDraftJobId: "job-1" });
    mockClientOps.findUnique.mockResolvedValue({ orgId: "org-1" });
    mockCreateAiJob.mockResolvedValue({
      id: "job-1",
      type: "JOURNAL_DRAFT",
      tier: "LOCAL_MLX",
      status: "QUEUED",
    });
    mockResolveProvider.mockResolvedValue({
      complete: vi.fn().mockResolvedValue({
        text: '{"objectives": "목표", "results": "결과", "nextSteps": "계획"}',
        usage: { inputTokens: 100, outputTokens: 50 },
        model: "mlx-local",
      }),
    });
    mockUpdateJobStatus.mockResolvedValue({});
    const { POST } = await import(
      "../../app/api/journals/[journalId]/ai-draft/route"
    );
    const res = await POST(
      makeRequest("POST", "http://localhost/api/journals/j1/ai-draft") as never,
      { params: Promise.resolve({ journalId: "j1" }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.jobId).toBe("job-1");
  });
});

// ─── GET /api/journals/researchers ───────────────────────────────────────────

describe("GET /api/journals/researchers", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import("../../app/api/journals/researchers/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/journals/researchers") as never
    );
    expect(res.status).toBe(401);
  });

  it("returns grouped researchers with monthly journal counts", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockContactOps.findMany.mockResolvedValue([
      {
        id: "r1",
        name: "홍길동",
        position: "연구원",
        email: "hong@test.com",
        phone: null,
        researchField: "AI",
        clientId: "c1",
        client: { id: "c1", name: "테스트연구소" },
        journals: [{ id: "j1" }, { id: "j2" }],
      },
    ]);
    const { GET } = await import("../../app/api/journals/researchers/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/journals/researchers") as never
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].researchers[0].monthlyJournalCount).toBe(2);
  });
});

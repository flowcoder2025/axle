/**
 * Tests for:
 * - POST /api/documents/[documentId]/verify (WI-204)
 * - GET  /api/documents/[documentId]/verify (WI-204)
 * - POST /api/clients/[clientId]/gap-analysis (WI-207)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Shared mocks ---

const mockDocumentOps = {
  findFirst: vi.fn(),
  update: vi.fn(),
};

const mockClientOps = {
  findFirst: vi.fn(),
};

const mockProgramOps = {
  findFirst: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    document: mockDocumentOps,
    client: mockClientOps,
    programInfo: mockProgramOps,
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
}));

const mockEvaluate = vi.fn();
const mockAnalyzeGaps = vi.fn();

vi.mock("@axle/ai", () => ({
  evaluate: mockEvaluate,
  analyzeGaps: mockAnalyzeGaps,
}));

vi.mock("@axle/storage", () => ({
  STORAGE_PACKAGE: "@axle/storage",
  BUCKETS: { DOCUMENTS: "documents" },
  getSignedUrl: vi.fn(),
}));

vi.mock("@/lib/utils/storage", () => ({
  extractStoragePath: vi.fn(() => "path/to/file"),
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

// =============================================
// POST /api/documents/[documentId]/verify
// =============================================

describe("POST /api/documents/[documentId]/verify", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/documents/[documentId]/verify/route"
    );
    const res = await POST(
      makeRequest(
        "POST",
        "http://localhost/api/documents/doc-1/verify"
      ) as never,
      { params: Promise.resolve({ documentId: "doc-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no orgId", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      orgId: null,
      email: "a@test.com",
    });
    const { POST } = await import(
      "../../app/api/documents/[documentId]/verify/route"
    );
    const res = await POST(
      makeRequest(
        "POST",
        "http://localhost/api/documents/doc-1/verify"
      ) as never,
      { params: Promise.resolve({ documentId: "doc-1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when document not found", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockDocumentOps.findFirst.mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/documents/[documentId]/verify/route"
    );
    const res = await POST(
      makeRequest(
        "POST",
        "http://localhost/api/documents/doc-x/verify"
      ) as never,
      { params: Promise.resolve({ documentId: "doc-x" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 422 when document has no usable text", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockDocumentOps.findFirst.mockResolvedValue({
      id: "doc-1",
      fileUrl: "https://storage/doc-1.pdf",
      fileType: "application/pdf",
      ocrResult: null,
      projectId: null,
      project: null,
    });
    const { POST } = await import(
      "../../app/api/documents/[documentId]/verify/route"
    );
    const res = await POST(
      makeRequest(
        "POST",
        "http://localhost/api/documents/doc-1/verify"
      ) as never,
      { params: Promise.resolve({ documentId: "doc-1" }) }
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("NO_CONTENT");
  });

  it("runs evaluate() and persists verifyResult when OCR text is present", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockDocumentOps.findFirst.mockResolvedValue({
      id: "doc-1",
      fileUrl: "https://storage/doc-1.pdf",
      fileType: "application/pdf",
      ocrResult: { text: "사업계획서 본문 내용이 충분히 포함되어 있습니다." },
      projectId: "prj-1",
      project: { id: "prj-1" },
    });
    mockEvaluate.mockResolvedValue({
      criteria: [
        { name: "사업 목표 명확성", weight: 0.15, score: 7.5, feedback: "ok" },
      ],
      totalScore: 7.5,
      grade: "B",
      strengths: ["강점"],
      weaknesses: [],
      improvements: ["개선 제안 1"],
    });
    mockDocumentOps.update.mockResolvedValue({});

    const { POST } = await import(
      "../../app/api/documents/[documentId]/verify/route"
    );
    const res = await POST(
      makeRequest(
        "POST",
        "http://localhost/api/documents/doc-1/verify"
      ) as never,
      { params: Promise.resolve({ documentId: "doc-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.score).toBe(7.5);
    expect(body.data.grade).toBe("B");
    expect(body.data.items).toHaveLength(1);
    expect(body.data.suggestions).toEqual(["개선 제안 1"]);
    expect(mockEvaluate).toHaveBeenCalledWith({
      documentContent: expect.stringContaining("사업계획서"),
    });
    expect(mockDocumentOps.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "doc-1" },
        data: expect.objectContaining({
          verifyResult: expect.any(Object),
          verifiedAt: expect.any(Date),
        }),
      })
    );
  });
});

// =============================================
// GET /api/documents/[documentId]/verify
// =============================================

describe("GET /api/documents/[documentId]/verify", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns null when no verifyResult is stored", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockDocumentOps.findFirst.mockResolvedValue({
      verifyResult: null,
      verifiedAt: null,
    });
    const { GET } = await import(
      "../../app/api/documents/[documentId]/verify/route"
    );
    const res = await GET(
      makeRequest(
        "GET",
        "http://localhost/api/documents/doc-1/verify"
      ) as never,
      { params: Promise.resolve({ documentId: "doc-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeNull();
  });

  it("returns stored verifyResult when present", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const verifiedAt = new Date("2026-01-01T00:00:00Z");
    mockDocumentOps.findFirst.mockResolvedValue({
      verifyResult: {
        criteria: [{ name: "x", weight: 1, score: 8, feedback: "" }],
        totalScore: 8,
        grade: "A",
        strengths: [],
        weaknesses: [],
        improvements: ["keep going"],
      },
      verifiedAt,
    });
    const { GET } = await import(
      "../../app/api/documents/[documentId]/verify/route"
    );
    const res = await GET(
      makeRequest(
        "GET",
        "http://localhost/api/documents/doc-1/verify"
      ) as never,
      { params: Promise.resolve({ documentId: "doc-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.score).toBe(8);
    expect(body.data.grade).toBe("A");
    expect(body.data.suggestions).toEqual(["keep going"]);
    expect(body.data.verifiedAt).toBe(verifiedAt.toISOString());
  });
});

// =============================================
// POST /api/clients/[clientId]/gap-analysis
// =============================================

describe("POST /api/clients/[clientId]/gap-analysis", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/clients/[clientId]/gap-analysis/route"
    );
    const res = await POST(
      makeRequest(
        "POST",
        "http://localhost/api/clients/cl-1/gap-analysis",
        { programId: "prog-1" }
      ) as never,
      { params: Promise.resolve({ clientId: "cl-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when programId missing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const { POST } = await import(
      "../../app/api/clients/[clientId]/gap-analysis/route"
    );
    const res = await POST(
      makeRequest(
        "POST",
        "http://localhost/api/clients/cl-1/gap-analysis",
        {}
      ) as never,
      { params: Promise.resolve({ clientId: "cl-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when client not found in org", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockClientOps.findFirst.mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/clients/[clientId]/gap-analysis/route"
    );
    const res = await POST(
      makeRequest(
        "POST",
        "http://localhost/api/clients/cl-x/gap-analysis",
        { programId: "prog-1" }
      ) as never,
      { params: Promise.resolve({ clientId: "cl-x" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when program not found in org", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockClientOps.findFirst.mockResolvedValue({ id: "cl-1" });
    mockProgramOps.findFirst.mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/clients/[clientId]/gap-analysis/route"
    );
    const res = await POST(
      makeRequest(
        "POST",
        "http://localhost/api/clients/cl-1/gap-analysis",
        { programId: "prog-x" }
      ) as never,
      { params: Promise.resolve({ clientId: "cl-1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("calls analyzeGaps() and returns the result", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockClientOps.findFirst.mockResolvedValue({ id: "cl-1" });
    mockProgramOps.findFirst.mockResolvedValue({ id: "prog-1" });
    mockAnalyzeGaps.mockResolvedValue({
      gaps: [
        {
          category: "서류",
          item: "사업계획서",
          severity: "critical",
          description: "누락",
          recommendation: "업로드 필요",
        },
      ],
      readiness: 80,
      summary: "준비도 80",
    });

    const { POST } = await import(
      "../../app/api/clients/[clientId]/gap-analysis/route"
    );
    const res = await POST(
      makeRequest(
        "POST",
        "http://localhost/api/clients/cl-1/gap-analysis",
        { programId: "prog-1" }
      ) as never,
      { params: Promise.resolve({ clientId: "cl-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.readiness).toBe(80);
    expect(body.data.gaps).toHaveLength(1);
    expect(mockAnalyzeGaps).toHaveBeenCalledWith({
      clientId: "cl-1",
      programId: "prog-1",
    });
  });
});

/**
 * Tests for POST /api/clients/[clientId]/financial-report (WI-228).
 *
 * Covers:
 *   - Authentication / authorization
 *   - Input validation (Zod)
 *   - Missing financial data
 *   - Happy path: AiJob lifecycle + Document + FinancialReport upsert + upload
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ------------------------------------------------------------------

const mockPrismaClient = { findFirst: vi.fn() };
const mockPrismaFinancial = { findFirst: vi.fn() };
const mockPrismaDocument = { create: vi.fn() };
const mockPrismaFinancialReport = { upsert: vi.fn() };
const mockPrismaAiJob = { create: vi.fn(), update: vi.fn() };

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    client: mockPrismaClient,
    clientFinancial: mockPrismaFinancial,
    document: mockPrismaDocument,
    financialReport: mockPrismaFinancialReport,
    aiJob: mockPrismaAiJob,
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
}));

const mockGenerateDocx = vi.fn();
vi.mock("@axle/docgen", () => ({
  generateFinancialReportDocx: mockGenerateDocx,
}));

const mockUploadFile = vi.fn();
vi.mock("@axle/storage", () => ({
  uploadFile: mockUploadFile,
}));

const mockBuildAnalysis = vi.fn();
vi.mock("@/lib/services/financial-analysis", () => ({
  buildFinancialAnalysis: mockBuildAnalysis,
}));

import { getCurrentUser } from "@axle/auth";

// --- Helpers ----------------------------------------------------------------

const authedUser = { id: "user-1", orgId: "org-1" };

const CLIENT = { id: "client-1", name: "테크Corp" };
const FINANCIAL = {
  id: "fin-1",
  clientId: "client-1",
  year: 2025,
  revenue: "1200000000",
  operatingProfit: "150000000",
  netProfit: "120000000",
  totalAssets: "2000000000",
  totalLiabilities: "800000000",
  totalEquity: "1200000000",
  creditRating: "A",
  source: "DART",
};

const ANALYSIS = {
  year: 2025,
  metrics: {
    operatingMargin: 12.5,
    netMargin: 10,
    roe: 10,
    roa: 6,
    debtRatio: 66.67,
    debtToAsset: 40,
    revenueGrowth: 20,
    operatingProfitGrowth: 50,
    netProfitGrowth: 50,
  },
  historical: [],
  narrative: "본문 분석",
  recommendations: ["제언 A", "제언 B"],
  aiModel: "claude-haiku-4-5-20251001",
  fallbackUsed: false,
  generatedAt: "2026-04-21T00:00:00.000Z",
};

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
  mockPrismaClient.findFirst.mockResolvedValue(CLIENT);
  mockPrismaFinancial.findFirst.mockResolvedValue(FINANCIAL);
  mockPrismaAiJob.create.mockResolvedValue({ id: "job-1" });
  mockPrismaAiJob.update.mockResolvedValue({ id: "job-1", status: "COMPLETED" });
  mockGenerateDocx.mockResolvedValue(Buffer.from("DOCX"));
  mockUploadFile.mockResolvedValue({
    url: "https://storage.example/financial-report.docx",
    path: "financial-reports/client-1/financial-report.docx",
    size: 4,
  });
  mockPrismaDocument.create.mockResolvedValue({
    id: "doc-1",
    fileUrl: "https://storage.example/financial-report.docx",
  });
  mockPrismaFinancialReport.upsert.mockResolvedValue({
    id: "report-1",
    year: 2025,
  });
  mockBuildAnalysis.mockResolvedValue(ANALYSIS);
});

// --- Tests ------------------------------------------------------------------

describe("POST /api/clients/[clientId]/financial-report", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const { POST } = await import(
      "../../app/api/clients/[clientId]/financial-report/route"
    );
    const res = await POST(
      makeRequest(
        "POST",
        "http://localhost/api/clients/client-1/financial-report",
        { year: 2025 },
      ) as never,
      { params: Promise.resolve({ clientId: "client-1" }) },
    );
    expect(res.status).toBe(401);
    expect(mockBuildAnalysis).not.toHaveBeenCalled();
  });

  it("returns 404 when client does not belong to the caller's org", async () => {
    mockPrismaClient.findFirst.mockResolvedValue(null);

    const { POST } = await import(
      "../../app/api/clients/[clientId]/financial-report/route"
    );
    const res = await POST(
      makeRequest(
        "POST",
        "http://localhost/api/clients/client-1/financial-report",
        { year: 2025 },
      ) as never,
      { params: Promise.resolve({ clientId: "client-1" }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for missing year", async () => {
    const { POST } = await import(
      "../../app/api/clients/[clientId]/financial-report/route"
    );
    const res = await POST(
      makeRequest(
        "POST",
        "http://localhost/api/clients/client-1/financial-report",
        {},
      ) as never,
      { params: Promise.resolve({ clientId: "client-1" }) },
    );
    expect(res.status).toBe(400);
    expect(mockBuildAnalysis).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid year type", async () => {
    const { POST } = await import(
      "../../app/api/clients/[clientId]/financial-report/route"
    );
    const res = await POST(
      makeRequest(
        "POST",
        "http://localhost/api/clients/client-1/financial-report",
        { year: "2025" },
      ) as never,
      { params: Promise.resolve({ clientId: "client-1" }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when no financial data exists for the year", async () => {
    mockPrismaFinancial.findFirst.mockResolvedValue(null);

    const { POST } = await import(
      "../../app/api/clients/[clientId]/financial-report/route"
    );
    const res = await POST(
      makeRequest(
        "POST",
        "http://localhost/api/clients/client-1/financial-report",
        { year: 1999 },
      ) as never,
      { params: Promise.resolve({ clientId: "client-1" }) },
    );
    expect(res.status).toBe(404);
    expect(mockBuildAnalysis).not.toHaveBeenCalled();
  });

  it("creates Document, upserts FinancialReport, completes AiJob and returns 201", async () => {
    const { POST } = await import(
      "../../app/api/clients/[clientId]/financial-report/route"
    );
    const res = await POST(
      makeRequest(
        "POST",
        "http://localhost/api/clients/client-1/financial-report",
        { year: 2025 },
      ) as never,
      { params: Promise.resolve({ clientId: "client-1" }) },
    );
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.data).toMatchObject({
      documentId: "doc-1",
      url: "https://storage.example/financial-report.docx",
      jobId: "job-1",
      reportId: "report-1",
      fallbackUsed: false,
    });

    // AiJob was created RUNNING then updated to COMPLETED
    expect(mockPrismaAiJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId: "org-1",
          type: "FINANCIAL_ANALYSIS",
          tier: "API_HAIKU",
          status: "RUNNING",
        }),
      }),
    );
    expect(mockPrismaAiJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({
          status: "COMPLETED",
          output: expect.objectContaining({
            documentId: "doc-1",
            reportId: "report-1",
            fallbackUsed: false,
            recommendationsCount: 2,
          }),
        }),
      }),
    );

    // DOCX generation received metrics, narrative, recommendations
    expect(mockGenerateDocx).toHaveBeenCalledWith(
      expect.objectContaining({
        clientName: "테크Corp",
        year: 2025,
        analysis: "본문 분석",
        recommendations: ["제언 A", "제언 B"],
        ratios: expect.objectContaining({ operatingMargin: 12.5 }),
        metrics: expect.objectContaining({ revenueGrowth: 20 }),
      }),
    );

    // Storage upload
    expect(mockUploadFile).toHaveBeenCalledWith(
      "documents",
      expect.stringContaining("financial-report-client-1-2025"),
      expect.any(Buffer),
      expect.objectContaining({
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );

    // Document created with OUTPUT category
    expect(mockPrismaDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: "client-1",
          category: "OUTPUT",
          fileUrl: "https://storage.example/financial-report.docx",
        }),
      }),
    );

    // FinancialReport upsert keyed on clientId+year
    expect(mockPrismaFinancialReport.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId_year: { clientId: "client-1", year: 2025 } },
        create: expect.objectContaining({
          clientId: "client-1",
          year: 2025,
          clientFinancialId: "fin-1",
        }),
      }),
    );
  });

  it("propagates fallbackUsed=true in the response when AI falls back", async () => {
    mockBuildAnalysis.mockResolvedValue({
      ...ANALYSIS,
      fallbackUsed: true,
      aiModel: null,
    });

    const { POST } = await import(
      "../../app/api/clients/[clientId]/financial-report/route"
    );
    const res = await POST(
      makeRequest(
        "POST",
        "http://localhost/api/clients/client-1/financial-report",
        { year: 2025 },
      ) as never,
      { params: Promise.resolve({ clientId: "client-1" }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.fallbackUsed).toBe(true);
  });

  it("marks AiJob FAILED and returns 500 when DOCX generation throws", async () => {
    mockGenerateDocx.mockRejectedValue(new Error("docx boom"));

    const { POST } = await import(
      "../../app/api/clients/[clientId]/financial-report/route"
    );
    const res = await POST(
      makeRequest(
        "POST",
        "http://localhost/api/clients/client-1/financial-report",
        { year: 2025 },
      ) as never,
      { params: Promise.resolve({ clientId: "client-1" }) },
    );
    expect(res.status).toBe(500);

    expect(mockPrismaAiJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          output: expect.objectContaining({
            error: "docx boom",
          }),
        }),
      }),
    );
  });
});

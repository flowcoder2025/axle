/**
 * Tests for Financial Analysis API (WI-100) and service
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockPrismaFinancial = {
  findFirst: vi.fn(),
};

const mockPrismaClient = {
  findFirst: vi.fn(),
};

const mockPrismaAiJob = {
  create: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    client: mockPrismaClient,
    clientFinancial: mockPrismaFinancial,
    aiJob: mockPrismaAiJob,
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from "@axle/auth";

const authedUser = { id: "user-1", orgId: "org-1" };
const FINANCIAL = {
  id: "fin-1",
  clientId: "client-1",
  year: 2023,
  revenue: "1000000000",
  operatingProfit: "100000000",
  netProfit: "80000000",
  totalAssets: "5000000000",
  totalLiabilities: "2000000000",
  totalEquity: "3000000000",
  creditRating: "A",
  source: "DART",
};

const AI_JOB = {
  id: "job-1",
  type: "FINANCIAL_ANALYSIS",
  tier: "API_HAIKU",
  status: "COMPLETED",
  input: { clientId: "client-1", year: 2023 },
  output: {},
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
  mockPrismaClient.findFirst.mockResolvedValue({ id: "client-1", name: "테크Corp" });
});

// ==========================================
// Financial ratio calculation tests
// ==========================================

describe("calculateFinancialRatios", () => {
  it("calculates debt ratio correctly", async () => {
    const { calculateFinancialRatios } = await import(
      "../../lib/services/financial-analysis"
    );
    const ratios = calculateFinancialRatios({
      totalLiabilities: 200,
      totalEquity: 100,
    });
    expect(ratios.debtRatio).toBe(200); // 200/100 * 100
  });

  it("calculates ROE correctly", async () => {
    const { calculateFinancialRatios } = await import(
      "../../lib/services/financial-analysis"
    );
    const ratios = calculateFinancialRatios({
      netProfit: 80,
      totalEquity: 400,
    });
    expect(ratios.roe).toBe(20); // 80/400 * 100
  });

  it("returns undefined for missing fields", async () => {
    const { calculateFinancialRatios } = await import(
      "../../lib/services/financial-analysis"
    );
    const ratios = calculateFinancialRatios({});
    expect(ratios.debtRatio).toBeUndefined();
    expect(ratios.roe).toBeUndefined();
  });

  it("returns undefined for zero denominator", async () => {
    const { calculateFinancialRatios } = await import(
      "../../lib/services/financial-analysis"
    );
    const ratios = calculateFinancialRatios({
      netProfit: 80,
      totalEquity: 0,
    });
    expect(ratios.roe).toBeUndefined();
  });

  it("calculates operating margin", async () => {
    const { calculateFinancialRatios } = await import(
      "../../lib/services/financial-analysis"
    );
    const ratios = calculateFinancialRatios({
      operatingProfit: 100,
      revenue: 1000,
    });
    expect(ratios.operatingMargin).toBe(10); // 100/1000 * 100
  });
});

// ==========================================
// API route tests
// ==========================================

describe("POST /api/clients/[clientId]/financial-analysis", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/clients/[clientId]/financial-analysis/route"
    );
    const req = makeRequest(
      "POST",
      "http://localhost/api/clients/client-1/financial-analysis",
      { year: 2023 }
    );
    const res = await POST(req as never, {
      params: Promise.resolve({ clientId: "client-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when client not found", async () => {
    mockPrismaClient.findFirst.mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/clients/[clientId]/financial-analysis/route"
    );
    const req = makeRequest(
      "POST",
      "http://localhost/api/clients/wrong/financial-analysis",
      { year: 2023 }
    );
    const res = await POST(req as never, {
      params: Promise.resolve({ clientId: "wrong" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when no financial data for year", async () => {
    mockPrismaFinancial.findFirst.mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/clients/[clientId]/financial-analysis/route"
    );
    const req = makeRequest(
      "POST",
      "http://localhost/api/clients/client-1/financial-analysis",
      { year: 1999 }
    );
    const res = await POST(req as never, {
      params: Promise.resolve({ clientId: "client-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("creates AiJob and returns 201 with ratios", async () => {
    mockPrismaFinancial.findFirst.mockResolvedValue(FINANCIAL);
    mockPrismaAiJob.create.mockResolvedValue(AI_JOB);
    const { POST } = await import(
      "../../app/api/clients/[clientId]/financial-analysis/route"
    );
    const req = makeRequest(
      "POST",
      "http://localhost/api/clients/client-1/financial-analysis",
      { year: 2023 }
    );
    const res = await POST(req as never, {
      params: Promise.resolve({ clientId: "client-1" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.ratios).toBeDefined();
    expect(body.data.job.type).toBe("FINANCIAL_ANALYSIS");
    // Check AiJob was created with correct type and tier
    expect(mockPrismaAiJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "FINANCIAL_ANALYSIS",
          tier: "API_HAIKU",
        }),
      })
    );
  });

  it("returns 400 for missing year", async () => {
    const { POST } = await import(
      "../../app/api/clients/[clientId]/financial-analysis/route"
    );
    const req = makeRequest(
      "POST",
      "http://localhost/api/clients/client-1/financial-analysis",
      {}
    );
    const res = await POST(req as never, {
      params: Promise.resolve({ clientId: "client-1" }),
    });
    expect(res.status).toBe(400);
  });
});

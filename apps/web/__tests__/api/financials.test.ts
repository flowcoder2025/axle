/**
 * Tests for ClientFinancial CRUD API (WI-098)
 * /api/clients/[clientId]/financials (GET, POST)
 * /api/clients/[clientId]/financials/[year] (GET, PATCH, DELETE)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockPrismaFinancial = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockPrismaClient = {
  findFirst: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    client: mockPrismaClient,
    clientFinancial: mockPrismaFinancial,
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
  mockPrismaClient.findFirst.mockResolvedValue({ id: "client-1" });
});

// ==========================================
// Validation schema tests
// ==========================================

describe("clientFinancialCreateSchema", () => {
  it("rejects missing year", async () => {
    const { clientFinancialCreateSchema } = await import(
      "../../lib/validations/financial"
    );
    const result = clientFinancialCreateSchema.safeParse({ revenue: 100 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer year", async () => {
    const { clientFinancialCreateSchema } = await import(
      "../../lib/validations/financial"
    );
    const result = clientFinancialCreateSchema.safeParse({ year: 2023.5 });
    expect(result.success).toBe(false);
  });

  it("accepts minimal valid input (year only)", async () => {
    const { clientFinancialCreateSchema } = await import(
      "../../lib/validations/financial"
    );
    const result = clientFinancialCreateSchema.safeParse({ year: 2023 });
    expect(result.success).toBe(true);
  });

  it("accepts full valid input", async () => {
    const { clientFinancialCreateSchema } = await import(
      "../../lib/validations/financial"
    );
    const result = clientFinancialCreateSchema.safeParse({
      year: 2023,
      revenue: 1000000,
      operatingProfit: 100000,
      netProfit: 80000,
      totalAssets: 5000000,
      totalLiabilities: 2000000,
      totalEquity: 3000000,
      creditRating: "A",
      source: "DART",
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative revenue", async () => {
    const { clientFinancialCreateSchema } = await import(
      "../../lib/validations/financial"
    );
    const result = clientFinancialCreateSchema.safeParse({
      year: 2023,
      revenue: -100,
    });
    expect(result.success).toBe(false);
  });
});

// ==========================================
// Collection routes: GET + POST
// ==========================================

describe("GET /api/clients/[clientId]/financials", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/financials/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/clients/client-1/financials"
    );
    const res = await GET(req as never, {
      params: Promise.resolve({ clientId: "client-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when client not found", async () => {
    mockPrismaClient.findFirst.mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/financials/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/clients/wrong/financials"
    );
    const res = await GET(req as never, {
      params: Promise.resolve({ clientId: "wrong" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns financial list ordered by year desc", async () => {
    mockPrismaFinancial.findMany.mockResolvedValue([FINANCIAL]);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/financials/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/clients/client-1/financials"
    );
    const res = await GET(req as never, {
      params: Promise.resolve({ clientId: "client-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(mockPrismaFinancial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { year: "desc" } })
    );
  });
});

describe("POST /api/clients/[clientId]/financials", () => {
  it("returns 400 for missing year", async () => {
    const { POST } = await import(
      "../../app/api/clients/[clientId]/financials/route"
    );
    const req = makeRequest(
      "POST",
      "http://localhost/api/clients/client-1/financials",
      { revenue: 1000000 }
    );
    const res = await POST(req as never, {
      params: Promise.resolve({ clientId: "client-1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 when year already exists", async () => {
    mockPrismaFinancial.findFirst.mockResolvedValue(FINANCIAL);
    const { POST } = await import(
      "../../app/api/clients/[clientId]/financials/route"
    );
    const req = makeRequest(
      "POST",
      "http://localhost/api/clients/client-1/financials",
      { year: 2023 }
    );
    const res = await POST(req as never, {
      params: Promise.resolve({ clientId: "client-1" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("CONFLICT");
  });

  it("creates financial record and returns 201", async () => {
    mockPrismaFinancial.findFirst.mockResolvedValue(null);
    mockPrismaFinancial.create.mockResolvedValue(FINANCIAL);
    const { POST } = await import(
      "../../app/api/clients/[clientId]/financials/route"
    );
    const req = makeRequest(
      "POST",
      "http://localhost/api/clients/client-1/financials",
      { year: 2023, revenue: 1000000 }
    );
    const res = await POST(req as never, {
      params: Promise.resolve({ clientId: "client-1" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.year).toBe(2023);
  });
});

// ==========================================
// Item routes: GET, PATCH, DELETE
// ==========================================

describe("GET /api/clients/[clientId]/financials/[year]", () => {
  it("returns financial record by year", async () => {
    mockPrismaFinancial.findFirst.mockResolvedValue(FINANCIAL);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/financials/[year]/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/clients/client-1/financials/2023"
    );
    const res = await GET(req as never, {
      params: Promise.resolve({ clientId: "client-1", year: "2023" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.year).toBe(2023);
  });

  it("returns 404 when not found", async () => {
    mockPrismaFinancial.findFirst.mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/financials/[year]/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/clients/client-1/financials/1999"
    );
    const res = await GET(req as never, {
      params: Promise.resolve({ clientId: "client-1", year: "1999" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/clients/[clientId]/financials/[year]", () => {
  it("updates financial record", async () => {
    const updated = { ...FINANCIAL, creditRating: "AA" };
    mockPrismaFinancial.findFirst.mockResolvedValue(FINANCIAL);
    mockPrismaFinancial.update.mockResolvedValue(updated);
    const { PATCH } = await import(
      "../../app/api/clients/[clientId]/financials/[year]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/clients/client-1/financials/2023",
      { creditRating: "AA" }
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ clientId: "client-1", year: "2023" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.creditRating).toBe("AA");
  });
});

describe("DELETE /api/clients/[clientId]/financials/[year]", () => {
  it("deletes financial record and returns 204", async () => {
    mockPrismaFinancial.findFirst.mockResolvedValue(FINANCIAL);
    mockPrismaFinancial.delete.mockResolvedValue(FINANCIAL);
    const { DELETE } = await import(
      "../../app/api/clients/[clientId]/financials/[year]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/clients/client-1/financials/2023"
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({ clientId: "client-1", year: "2023" }),
    });
    expect(res.status).toBe(204);
    expect(mockPrismaFinancial.delete).toHaveBeenCalledWith({
      where: { id: "fin-1" },
    });
  });

  it("returns 404 when record not found", async () => {
    mockPrismaFinancial.findFirst.mockResolvedValue(null);
    const { DELETE } = await import(
      "../../app/api/clients/[clientId]/financials/[year]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/clients/client-1/financials/1999"
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({ clientId: "client-1", year: "1999" }),
    });
    expect(res.status).toBe(404);
  });
});

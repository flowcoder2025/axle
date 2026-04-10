import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockEstimateOps = {
  findMany: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockClientOps = {
  findFirst: vi.fn(),
};

const mockEmailLogOps = {
  create: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    estimate: mockEstimateOps,
    client: mockClientOps,
    emailLog: mockEmailLogOps,
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        estimate: mockEstimateOps,
        emailLog: mockEmailLogOps,
      });
    }),
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
}));

vi.mock("@axle/docgen", () => ({
  generateEstimateDocx: vi.fn().mockResolvedValue(Buffer.from("docx-content")),
}));

vi.mock("@axle/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: "email-123" }),
  estimateEmail: vi.fn().mockReturnValue("<html>estimate email</html>"),
}));

vi.mock("../../lib/utils/number-generator", () => ({
  generateEstimateNumber: vi.fn().mockResolvedValue("EST-2024-0001"),
  generateContractNumber: vi.fn().mockResolvedValue("CON-2024-0001"),
}));

// --- Helpers ---

import { getCurrentUser } from "@axle/auth";

const authedUser = { id: "user-1", orgId: "org-1", email: "a@test.com", name: "Test User" };

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

// --- Validation schema tests ---

describe("estimateCreateSchema", () => {
  it("accepts valid estimate input", async () => {
    const { estimateCreateSchema } = await import("../../lib/validations/estimate");
    const result = estimateCreateSchema.safeParse({
      clientId: "client-1",
      items: [{ name: "컨설팅", quantity: 1, unitPrice: 100000, amount: 100000 }],
      totalAmount: 100000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing clientId", async () => {
    const { estimateCreateSchema } = await import("../../lib/validations/estimate");
    const result = estimateCreateSchema.safeParse({
      items: [{ name: "컨설팅", quantity: 1, unitPrice: 100000, amount: 100000 }],
      totalAmount: 100000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty items array", async () => {
    const { estimateCreateSchema } = await import("../../lib/validations/estimate");
    const result = estimateCreateSchema.safeParse({
      clientId: "client-1",
      items: [],
      totalAmount: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative totalAmount", async () => {
    const { estimateCreateSchema } = await import("../../lib/validations/estimate");
    const result = estimateCreateSchema.safeParse({
      clientId: "client-1",
      items: [{ name: "컨설팅", quantity: 1, unitPrice: 100000, amount: 100000 }],
      totalAmount: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("estimateSearchSchema", () => {
  it("accepts valid search params with coercion", async () => {
    const { estimateSearchSchema } = await import("../../lib/validations/estimate");
    const result = estimateSearchSchema.safeParse({ page: "2", pageSize: "10" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.pageSize).toBe(10);
    }
  });

  it("accepts valid status filter", async () => {
    const { estimateSearchSchema } = await import("../../lib/validations/estimate");
    const result = estimateSearchSchema.safeParse({ status: "SENT" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", async () => {
    const { estimateSearchSchema } = await import("../../lib/validations/estimate");
    const result = estimateSearchSchema.safeParse({ status: "INVALID" });
    expect(result.success).toBe(false);
  });
});

// --- API route tests ---

describe("GET /api/estimates", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(authedUser);
  });

  it("returns 401 when not authenticated", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const { GET } = await import("../../app/api/estimates/route");
    const req = makeRequest("GET", "http://localhost/api/estimates");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
  });

  it("returns estimates list for authenticated user", async () => {
    const mockEstimates = [
      {
        id: "est-1",
        estimateNumber: "EST-2024-0001",
        clientId: "client-1",
        projectId: null,
        totalAmount: "100000",
        taxAmount: null,
        status: "DRAFT",
        validUntil: null,
        sentAt: null,
        createdAt: new Date(),
        client: { name: "테스트 고객사" },
      },
    ];

    mockEstimateOps.findMany.mockResolvedValue(mockEstimates);
    mockEstimateOps.count.mockResolvedValue(1);

    const { GET } = await import("../../app/api/estimates/route");
    const req = makeRequest("GET", "http://localhost/api/estimates");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
  });
});

describe("POST /api/estimates", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(authedUser);
  });

  it("creates estimate and returns 201", async () => {
    mockClientOps.findFirst.mockResolvedValue({ id: "client-1" });
    mockEstimateOps.count.mockResolvedValue(0);
    const created = {
      id: "est-1",
      estimateNumber: "EST-2024-0001",
      clientId: "client-1",
      status: "DRAFT",
    };
    mockEstimateOps.create.mockResolvedValue(created);

    const { POST } = await import("../../app/api/estimates/route");
    const req = makeRequest("POST", "http://localhost/api/estimates", {
      clientId: "client-1",
      items: [{ name: "컨설팅", quantity: 1, unitPrice: 100000, amount: 100000 }],
      totalAmount: 100000,
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.estimateNumber).toBe("EST-2024-0001");
  });

  it("returns 404 when client not found", async () => {
    mockClientOps.findFirst.mockResolvedValue(null);

    const { POST } = await import("../../app/api/estimates/route");
    const req = makeRequest("POST", "http://localhost/api/estimates", {
      clientId: "nonexistent",
      items: [{ name: "컨설팅", quantity: 1, unitPrice: 100000, amount: 100000 }],
      totalAmount: 100000,
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid body", async () => {
    const { POST } = await import("../../app/api/estimates/route");
    const req = makeRequest("POST", "http://localhost/api/estimates", {
      clientId: "client-1",
      // missing items and totalAmount
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });
});

// --- Number generator tests ---

describe("generateEstimateNumber", () => {
  it("returns EST-YYYY-NNNN format", async () => {
    const { generateEstimateNumber: realGen } = await vi.importActual<
      typeof import("../../lib/utils/number-generator")
    >("../../lib/utils/number-generator");

    const mockPrisma = {
      estimate: {
        count: vi.fn().mockResolvedValue(5),
      },
    } as unknown as import("@prisma/client").PrismaClient;

    const year = new Date().getFullYear();
    const result = await realGen(mockPrisma);
    expect(result).toBe(`EST-${year}-0006`);
  });
});

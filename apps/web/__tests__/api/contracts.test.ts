import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockContractOps = {
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
    contract: mockContractOps,
    client: mockClientOps,
    emailLog: mockEmailLogOps,
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        contract: mockContractOps,
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
  generateContractDocx: vi.fn().mockResolvedValue(Buffer.from("docx-content")),
}));

vi.mock("@axle/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: "email-123" }),
  contractEmail: vi.fn().mockReturnValue("<html>contract email</html>"),
}));

vi.mock("../../lib/utils/number-generator", () => ({
  generateEstimateNumber: vi.fn().mockResolvedValue("EST-2024-0001"),
  generateContractNumber: vi.fn().mockResolvedValue("CON-2024-0001"),
}));

// --- Helpers ---

import { getCurrentUser } from "@axle/auth";

const authedUser = { id: "user-1", orgId: "org-1", email: "a@test.com", name: "Test User" };

const validContractBody = {
  clientId: "client-1",
  title: "용역 계약서",
  partyA: { name: "AXLE", representative: "홍길동" },
  partyB: { name: "테스트 주식회사", representative: "김대표" },
  terms: [{ title: "계약 목적", content: "본 계약의 목적은 컨설팅 용역 제공입니다.", order: 1 }],
};

function makeRequest(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

// --- Validation schema tests ---

describe("contractCreateSchema", () => {
  it("accepts valid contract input", async () => {
    const { contractCreateSchema } = await import("../../lib/validations/contract");
    const result = contractCreateSchema.safeParse(validContractBody);
    expect(result.success).toBe(true);
  });

  it("rejects missing clientId", async () => {
    const { contractCreateSchema } = await import("../../lib/validations/contract");
    const { clientId: _omit, ...rest } = validContractBody;
    const result = contractCreateSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty terms array", async () => {
    const { contractCreateSchema } = await import("../../lib/validations/contract");
    const result = contractCreateSchema.safeParse({ ...validContractBody, terms: [] });
    expect(result.success).toBe(false);
  });

  it("rejects term with missing title", async () => {
    const { contractCreateSchema } = await import("../../lib/validations/contract");
    const result = contractCreateSchema.safeParse({
      ...validContractBody,
      terms: [{ content: "내용", order: 1 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("contractSignSchema", () => {
  it("accepts valid signature data URL", async () => {
    const { contractSignSchema } = await import("../../lib/validations/contract");
    const result = contractSignSchema.safeParse({
      signatureDataUrl: "data:image/png;base64,abc123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty signatureDataUrl", async () => {
    const { contractSignSchema } = await import("../../lib/validations/contract");
    const result = contractSignSchema.safeParse({ signatureDataUrl: "" });
    expect(result.success).toBe(false);
  });
});

// --- API route tests ---

describe("GET /api/contracts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(authedUser);
  });

  it("returns 401 when not authenticated", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const { GET } = await import("../../app/api/contracts/route");
    const req = makeRequest("GET", "http://localhost/api/contracts");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
  });

  it("returns contracts list for authenticated user", async () => {
    const mockContracts = [
      {
        id: "con-1",
        contractNumber: "CON-2024-0001",
        clientId: "client-1",
        projectId: null,
        title: "용역 계약서",
        totalAmount: null,
        status: "DRAFT",
        startDate: null,
        endDate: null,
        signedAt: null,
        createdAt: new Date(),
        client: { name: "테스트 고객사" },
      },
    ];

    mockContractOps.findMany.mockResolvedValue(mockContracts);
    mockContractOps.count.mockResolvedValue(1);

    const { GET } = await import("../../app/api/contracts/route");
    const req = makeRequest("GET", "http://localhost/api/contracts");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
  });
});

describe("POST /api/contracts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(authedUser);
  });

  it("creates contract and returns 201", async () => {
    mockClientOps.findFirst.mockResolvedValue({ id: "client-1" });
    mockContractOps.count.mockResolvedValue(0);
    const created = {
      id: "con-1",
      contractNumber: "CON-2024-0001",
      clientId: "client-1",
      title: "용역 계약서",
      status: "DRAFT",
    };
    mockContractOps.create.mockResolvedValue(created);

    const { POST } = await import("../../app/api/contracts/route");
    const req = makeRequest("POST", "http://localhost/api/contracts", validContractBody);
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.contractNumber).toBe("CON-2024-0001");
  });

  it("returns 404 when client not found", async () => {
    mockClientOps.findFirst.mockResolvedValue(null);

    const { POST } = await import("../../app/api/contracts/route");
    const req = makeRequest("POST", "http://localhost/api/contracts", validContractBody);
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid body", async () => {
    const { POST } = await import("../../app/api/contracts/route");
    const req = makeRequest("POST", "http://localhost/api/contracts", {
      clientId: "client-1",
      // missing title, partyA, partyB, terms
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });
});

describe("generateContractNumber", () => {
  it("returns CON-YYYY-NNNN format", async () => {
    const { generateContractNumber: realGen } = await vi.importActual<
      typeof import("../../lib/utils/number-generator")
    >("../../lib/utils/number-generator");

    const mockPrisma = {
      contract: {
        count: vi.fn().mockResolvedValue(2),
      },
    } as unknown as import("@prisma/client").PrismaClient;

    const year = new Date().getFullYear();
    const result = await realGen(mockPrisma);
    expect(result).toBe(`CON-${year}-0003`);
  });
});

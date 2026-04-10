/**
 * Tests for Certificate CRUD API
 * /api/clients/[clientId]/certificates (GET, POST)
 * /api/clients/[clientId]/certificates/[certificateId] (GET, PATCH, DELETE)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockPrismaCertificate = {
  findMany: vi.fn(),
  count: vi.fn(),
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
    certificate: mockPrismaCertificate,
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
}));

// --- Helpers ---

import { getCurrentUser } from "@axle/auth";

const authedUser = { id: "user-1", orgId: "org-1" };
const CERTIFICATE = {
  id: "cert-1",
  clientId: "client-1",
  type: "VENTURE",
  subjectName: "주식회사 테크",
  serialNumber: "SN-001",
  validFrom: new Date("2024-01-01T00:00:00.000Z"),
  validTo: new Date("2025-12-31T00:00:00.000Z"),
  storagePath: "/files/cert-1.pdf",
  isActive: true,
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

describe("certificateCreateSchema", () => {
  it("rejects missing type", async () => {
    const { certificateCreateSchema } = await import(
      "../../lib/validations/certificate"
    );
    const result = certificateCreateSchema.safeParse({ subjectName: "Corp" });
    expect(result.success).toBe(false);
  });

  it("rejects missing subjectName", async () => {
    const { certificateCreateSchema } = await import(
      "../../lib/validations/certificate"
    );
    const result = certificateCreateSchema.safeParse({ type: "VENTURE" });
    expect(result.success).toBe(false);
  });

  it("accepts minimal valid input (type + subjectName only)", async () => {
    const { certificateCreateSchema } = await import(
      "../../lib/validations/certificate"
    );
    const result = certificateCreateSchema.safeParse({
      type: "VENTURE",
      subjectName: "Corp",
    });
    expect(result.success).toBe(true);
  });

  it("defaults isActive to true", async () => {
    const { certificateCreateSchema } = await import(
      "../../lib/validations/certificate"
    );
    const result = certificateCreateSchema.safeParse({
      type: "VENTURE",
      subjectName: "Corp",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isActive).toBe(true);
  });

  it("accepts optional date fields as ISO strings", async () => {
    const { certificateCreateSchema } = await import(
      "../../lib/validations/certificate"
    );
    const result = certificateCreateSchema.safeParse({
      type: "VENTURE",
      subjectName: "Corp",
      validFrom: "2024-01-01T00:00:00.000Z",
      validTo: "2025-12-31T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid date strings", async () => {
    const { certificateCreateSchema } = await import(
      "../../lib/validations/certificate"
    );
    const result = certificateCreateSchema.safeParse({
      type: "VENTURE",
      subjectName: "Corp",
      validFrom: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});

describe("certificateUpdateSchema", () => {
  it("allows all fields to be optional", async () => {
    const { certificateUpdateSchema } = await import(
      "../../lib/validations/certificate"
    );
    const result = certificateUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts isActive false on update", async () => {
    const { certificateUpdateSchema } = await import(
      "../../lib/validations/certificate"
    );
    const result = certificateUpdateSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });
});

// ==========================================
// Collection routes: GET + POST
// ==========================================

describe("GET /api/clients/[clientId]/certificates", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/certificates/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/clients/client-1/certificates",
    );
    const res = await GET(req as never, {
      params: Promise.resolve({ clientId: "client-1" }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when client does not belong to user org", async () => {
    mockPrismaClient.findFirst.mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/certificates/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/clients/wrong/certificates",
    );
    const res = await GET(req as never, {
      params: Promise.resolve({ clientId: "wrong" }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns paginated certificates for valid client", async () => {
    mockPrismaCertificate.findMany.mockResolvedValue([CERTIFICATE]);
    mockPrismaCertificate.count.mockResolvedValue(1);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/certificates/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/clients/client-1/certificates?page=1&pageSize=20",
    );
    const res = await GET(req as never, {
      params: Promise.resolve({ clientId: "client-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
  });

  it("filters by isActive query param", async () => {
    mockPrismaCertificate.findMany.mockResolvedValue([]);
    mockPrismaCertificate.count.mockResolvedValue(0);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/certificates/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/clients/client-1/certificates?isActive=false",
    );
    await GET(req as never, {
      params: Promise.resolve({ clientId: "client-1" }),
    });
    expect(mockPrismaCertificate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: false }),
      }),
    );
  });

  it("filters by type query param", async () => {
    mockPrismaCertificate.findMany.mockResolvedValue([]);
    mockPrismaCertificate.count.mockResolvedValue(0);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/certificates/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/clients/client-1/certificates?type=VENTURE",
    );
    await GET(req as never, {
      params: Promise.resolve({ clientId: "client-1" }),
    });
    expect(mockPrismaCertificate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "VENTURE" }),
      }),
    );
  });
});

describe("POST /api/clients/[clientId]/certificates", () => {
  it("returns 422 for missing required type", async () => {
    const { POST } = await import(
      "../../app/api/clients/[clientId]/certificates/route"
    );
    const req = makeRequest(
      "POST",
      "http://localhost/api/clients/client-1/certificates",
      { subjectName: "Corp" },
    );
    const res = await POST(req as never, {
      params: Promise.resolve({ clientId: "client-1" }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 422 for missing required subjectName", async () => {
    const { POST } = await import(
      "../../app/api/clients/[clientId]/certificates/route"
    );
    const req = makeRequest(
      "POST",
      "http://localhost/api/clients/client-1/certificates",
      { type: "VENTURE" },
    );
    const res = await POST(req as never, {
      params: Promise.resolve({ clientId: "client-1" }),
    });
    expect(res.status).toBe(422);
  });

  it("creates a certificate and returns 201", async () => {
    mockPrismaCertificate.create.mockResolvedValue(CERTIFICATE);
    const { POST } = await import(
      "../../app/api/clients/[clientId]/certificates/route"
    );
    const req = makeRequest(
      "POST",
      "http://localhost/api/clients/client-1/certificates",
      { type: "VENTURE", subjectName: "주식회사 테크" },
    );
    const res = await POST(req as never, {
      params: Promise.resolve({ clientId: "client-1" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.type).toBe("VENTURE");
  });

  it("converts validFrom/validTo strings to Date", async () => {
    mockPrismaCertificate.create.mockResolvedValue(CERTIFICATE);
    const { POST } = await import(
      "../../app/api/clients/[clientId]/certificates/route"
    );
    const req = makeRequest(
      "POST",
      "http://localhost/api/clients/client-1/certificates",
      {
        type: "VENTURE",
        subjectName: "Corp",
        validFrom: "2024-01-01T00:00:00.000Z",
        validTo: "2025-12-31T00:00:00.000Z",
      },
    );
    await POST(req as never, {
      params: Promise.resolve({ clientId: "client-1" }),
    });
    expect(mockPrismaCertificate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          validFrom: new Date("2024-01-01T00:00:00.000Z"),
          validTo: new Date("2025-12-31T00:00:00.000Z"),
        }),
      }),
    );
  });

  it("returns 404 when client not found", async () => {
    mockPrismaClient.findFirst.mockResolvedValue(null);
    const { POST } = await import(
      "../../app/api/clients/[clientId]/certificates/route"
    );
    const req = makeRequest(
      "POST",
      "http://localhost/api/clients/wrong/certificates",
      { type: "VENTURE", subjectName: "Corp" },
    );
    const res = await POST(req as never, {
      params: Promise.resolve({ clientId: "wrong" }),
    });
    expect(res.status).toBe(404);
  });
});

// ==========================================
// Item routes: GET, PATCH, DELETE
// ==========================================

describe("GET /api/clients/[clientId]/certificates/[certificateId]", () => {
  it("returns single certificate", async () => {
    mockPrismaCertificate.findFirst.mockResolvedValue(CERTIFICATE);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/certificates/[certificateId]/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/clients/client-1/certificates/cert-1",
    );
    const res = await GET(req as never, {
      params: Promise.resolve({ clientId: "client-1", certificateId: "cert-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("cert-1");
  });

  it("returns 404 when certificate not found", async () => {
    mockPrismaCertificate.findFirst.mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/certificates/[certificateId]/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/clients/client-1/certificates/ghost",
    );
    const res = await GET(req as never, {
      params: Promise.resolve({ clientId: "client-1", certificateId: "ghost" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when client does not belong to user org (org boundary)", async () => {
    mockPrismaClient.findFirst.mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/certificates/[certificateId]/route"
    );
    const req = makeRequest(
      "GET",
      "http://localhost/api/clients/other-org-client/certificates/cert-1",
    );
    const res = await GET(req as never, {
      params: Promise.resolve({
        clientId: "other-org-client",
        certificateId: "cert-1",
      }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("PATCH /api/clients/[clientId]/certificates/[certificateId]", () => {
  it("updates and returns the certificate", async () => {
    const updated = { ...CERTIFICATE, isActive: false };
    mockPrismaCertificate.findFirst.mockResolvedValue(CERTIFICATE);
    mockPrismaCertificate.update.mockResolvedValue(updated);
    const { PATCH } = await import(
      "../../app/api/clients/[clientId]/certificates/[certificateId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/clients/client-1/certificates/cert-1",
      { isActive: false },
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ clientId: "client-1", certificateId: "cert-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.isActive).toBe(false);
  });

  it("returns 404 when certificate does not exist", async () => {
    mockPrismaCertificate.findFirst.mockResolvedValue(null);
    const { PATCH } = await import(
      "../../app/api/clients/[clientId]/certificates/[certificateId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/clients/client-1/certificates/ghost",
      { isActive: false },
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ clientId: "client-1", certificateId: "ghost" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 422 for invalid validFrom format", async () => {
    mockPrismaCertificate.findFirst.mockResolvedValue(CERTIFICATE);
    const { PATCH } = await import(
      "../../app/api/clients/[clientId]/certificates/[certificateId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/clients/client-1/certificates/cert-1",
      { validFrom: "not-a-date" },
    );
    const res = await PATCH(req as never, {
      params: Promise.resolve({ clientId: "client-1", certificateId: "cert-1" }),
    });
    expect(res.status).toBe(422);
  });

  it("converts date strings to Date objects on update", async () => {
    mockPrismaCertificate.findFirst.mockResolvedValue(CERTIFICATE);
    mockPrismaCertificate.update.mockResolvedValue(CERTIFICATE);
    const { PATCH } = await import(
      "../../app/api/clients/[clientId]/certificates/[certificateId]/route"
    );
    const req = makeRequest(
      "PATCH",
      "http://localhost/api/clients/client-1/certificates/cert-1",
      { validTo: "2026-12-31T00:00:00.000Z" },
    );
    await PATCH(req as never, {
      params: Promise.resolve({ clientId: "client-1", certificateId: "cert-1" }),
    });
    expect(mockPrismaCertificate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          validTo: new Date("2026-12-31T00:00:00.000Z"),
        }),
      }),
    );
  });
});

describe("DELETE /api/clients/[clientId]/certificates/[certificateId]", () => {
  it("deletes certificate and returns 204", async () => {
    mockPrismaCertificate.findFirst.mockResolvedValue(CERTIFICATE);
    mockPrismaCertificate.delete.mockResolvedValue(CERTIFICATE);
    const { DELETE } = await import(
      "../../app/api/clients/[clientId]/certificates/[certificateId]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/clients/client-1/certificates/cert-1",
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({ clientId: "client-1", certificateId: "cert-1" }),
    });
    expect(res.status).toBe(204);
    expect(mockPrismaCertificate.delete).toHaveBeenCalledWith({
      where: { id: "cert-1" },
    });
  });

  it("returns 404 when certificate does not exist", async () => {
    mockPrismaCertificate.findFirst.mockResolvedValue(null);
    const { DELETE } = await import(
      "../../app/api/clients/[clientId]/certificates/[certificateId]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/clients/client-1/certificates/ghost",
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({ clientId: "client-1", certificateId: "ghost" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { DELETE } = await import(
      "../../app/api/clients/[clientId]/certificates/[certificateId]/route"
    );
    const req = makeRequest(
      "DELETE",
      "http://localhost/api/clients/client-1/certificates/cert-1",
    );
    const res = await DELETE(req as never, {
      params: Promise.resolve({ clientId: "client-1", certificateId: "cert-1" }),
    });
    expect(res.status).toBe(401);
  });
});

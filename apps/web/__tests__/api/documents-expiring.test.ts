import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockDocumentOps = {
  findMany: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    document: mockDocumentOps,
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
}));

// --- Helpers ---

import { getCurrentUser } from "@axle/auth";

const authedUser = { id: "user-1", orgId: "org-1", email: "a@test.com" };

function makeRequest(url: string): Request {
  return new Request(url, { method: "GET" });
}

// --- Tests ---

describe("GET /api/documents/expiring", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/documents/expiring/route"
    );
    const res = await GET(
      makeRequest("http://localhost/api/documents/expiring") as never
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 when user has no orgId", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      orgId: null,
      email: "a@test.com",
    });
    const { GET } = await import(
      "../../app/api/documents/expiring/route"
    );
    const res = await GET(
      makeRequest("http://localhost/api/documents/expiring") as never
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid days param", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const { GET } = await import(
      "../../app/api/documents/expiring/route"
    );
    const res = await GET(
      makeRequest("http://localhost/api/documents/expiring?days=0") as never
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for days exceeding 365", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const { GET } = await import(
      "../../app/api/documents/expiring/route"
    );
    const res = await GET(
      makeRequest("http://localhost/api/documents/expiring?days=400") as never
    );
    expect(res.status).toBe(400);
  });

  it("returns empty list when no documents are expiring", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockDocumentOps.findMany.mockResolvedValue([]);

    const { GET } = await import(
      "../../app/api/documents/expiring/route"
    );
    const res = await GET(
      makeRequest("http://localhost/api/documents/expiring") as never
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.days).toBe(30);
  });

  it("returns documents with daysRemaining and clientName", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);

    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days
    const fakeDocs = [
      {
        id: "doc-1",
        name: "계약서.pdf",
        category: "INPUT",
        expiresAt: futureDate,
        autoRenew: false,
        clientId: "client-1",
        client: { id: "client-1", name: "테스트 고객사" },
      },
    ];
    mockDocumentOps.findMany.mockResolvedValue(fakeDocs);

    const { GET } = await import(
      "../../app/api/documents/expiring/route"
    );
    const res = await GET(
      makeRequest("http://localhost/api/documents/expiring?days=30") as never
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].clientName).toBe("테스트 고객사");
    expect(body.data[0].daysRemaining).toBeGreaterThanOrEqual(4);
    expect(body.data[0].daysRemaining).toBeLessThanOrEqual(5);
    expect(body.data[0].expiresAt).toBe(futureDate.toISOString());
    expect(body.total).toBe(1);
  });

  it("applies orgId boundary in the where clause", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockDocumentOps.findMany.mockResolvedValue([]);

    const { GET } = await import(
      "../../app/api/documents/expiring/route"
    );
    await GET(
      makeRequest("http://localhost/api/documents/expiring") as never
    );

    expect(mockDocumentOps.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          client: { orgId: "org-1" },
          expiresAt: expect.objectContaining({
            not: null,
          }),
        }),
      })
    );
  });

  it("filters by clientId when provided", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockDocumentOps.findMany.mockResolvedValue([]);

    const { GET } = await import(
      "../../app/api/documents/expiring/route"
    );
    await GET(
      makeRequest(
        "http://localhost/api/documents/expiring?clientId=client-99"
      ) as never
    );

    expect(mockDocumentOps.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientId: "client-99" }),
      })
    );
  });

  it("respects custom days param", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockDocumentOps.findMany.mockResolvedValue([]);

    const { GET } = await import(
      "../../app/api/documents/expiring/route"
    );
    const res = await GET(
      makeRequest("http://localhost/api/documents/expiring?days=7") as never
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.days).toBe(7);
  });
});

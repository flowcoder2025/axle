/**
 * Tests for Client org-chart API (WI-327 + WI-327-1-fix).
 * /api/clients/[clientId]/org-chart (GET, PUT)
 *
 * Covers:
 * - cross-org isolation (other org's clientId → 404)
 * - Zod validation (empty departments array → 400 per WI-327-1-fix)
 * - masterProfile merge (does NOT wipe sibling keys)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrismaClient = {
  findFirst: vi.fn(),
  update: vi.fn(),
};

vi.mock("@axle/db", () => ({
  prisma: { client: mockPrismaClient },
}));

vi.mock("@axle/auth", () => ({
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from "@axle/auth";

const authedUser = { id: "user-1", orgId: "org-1" };

const validChart = {
  companyName: "주식회사 제이이티",
  ceo: { name: "김희수", position: "대표이사" },
  departments: [
    { name: "연구개발전담부서", members: [{ name: "심재경", position: "연구팀장" }] },
  ],
};

function makeRequest(method: string, body?: unknown): Request {
  return new Request("http://localhost/api/clients/c1/org-chart", {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
});

describe("GET /api/clients/[clientId]/org-chart", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/org-chart/route"
    );
    const res = await GET(makeRequest("GET") as never, {
      params: Promise.resolve({ clientId: "c1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when client belongs to a different org", async () => {
    mockPrismaClient.findFirst.mockResolvedValue(null);
    const { GET } = await import(
      "../../app/api/clients/[clientId]/org-chart/route"
    );
    const res = await GET(makeRequest("GET") as never, {
      params: Promise.resolve({ clientId: "c-foreign" }),
    });
    expect(res.status).toBe(404);
    // Confirms the org-scoped filter is applied.
    expect(mockPrismaClient.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c-foreign", orgId: "org-1" },
      }),
    );
  });

  it("returns null data when no org chart is stored", async () => {
    mockPrismaClient.findFirst.mockResolvedValue({
      id: "c1",
      name: "JET",
      masterProfile: { businessInfo: { name: "JET" } },
    });
    const { GET } = await import(
      "../../app/api/clients/[clientId]/org-chart/route"
    );
    const res = await GET(makeRequest("GET") as never, {
      params: Promise.resolve({ clientId: "c1" }),
    });
    const body = await res.json();
    expect(body.data).toBeNull();
    expect(body.mermaid).toBeNull();
  });

  it("returns parsed chart + mermaid when stored", async () => {
    mockPrismaClient.findFirst.mockResolvedValue({
      id: "c1",
      name: "JET",
      masterProfile: { organizationChart: validChart },
    });
    const { GET } = await import(
      "../../app/api/clients/[clientId]/org-chart/route"
    );
    const res = await GET(makeRequest("GET") as never, {
      params: Promise.resolve({ clientId: "c1" }),
    });
    const body = await res.json();
    expect(body.data.companyName).toBe("주식회사 제이이티");
    expect(body.mermaid).toContain("flowchart TD");
    expect(body.mermaid).toContain("심재경");
  });
});

describe("PUT /api/clients/[clientId]/org-chart", () => {
  it("returns 400 on invalid JSON", async () => {
    mockPrismaClient.findFirst.mockResolvedValue({ id: "c1", masterProfile: null });
    const badReq = new Request("http://localhost/api/clients/c1/org-chart", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not json{",
    });
    const { PUT } = await import(
      "../../app/api/clients/[clientId]/org-chart/route"
    );
    const res = await PUT(badReq as never, {
      params: Promise.resolve({ clientId: "c1" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when departments array is empty (WI-327-1-fix)", async () => {
    mockPrismaClient.findFirst.mockResolvedValue({ id: "c1", masterProfile: null });
    const { PUT } = await import(
      "../../app/api/clients/[clientId]/org-chart/route"
    );
    const res = await PUT(
      makeRequest("PUT", { ...validChart, departments: [] }) as never,
      { params: Promise.resolve({ clientId: "c1" }) },
    );
    expect(res.status).toBe(400);
    expect(mockPrismaClient.update).not.toHaveBeenCalled();
  });

  it("returns 404 when client belongs to a different org", async () => {
    mockPrismaClient.findFirst.mockResolvedValue(null);
    const { PUT } = await import(
      "../../app/api/clients/[clientId]/org-chart/route"
    );
    const res = await PUT(makeRequest("PUT", validChart) as never, {
      params: Promise.resolve({ clientId: "c-foreign" }),
    });
    expect(res.status).toBe(404);
  });

  it("merges chart into existing masterProfile without dropping siblings", async () => {
    const existing = {
      businessInfo: { name: "JET" },
      summary: "stale summary",
    };
    mockPrismaClient.findFirst.mockResolvedValue({
      id: "c1",
      masterProfile: existing,
    });
    mockPrismaClient.update.mockResolvedValue({});
    const { PUT } = await import(
      "../../app/api/clients/[clientId]/org-chart/route"
    );
    await PUT(makeRequest("PUT", validChart) as never, {
      params: Promise.resolve({ clientId: "c1" }),
    });
    const [callArg] = mockPrismaClient.update.mock.calls;
    const data = callArg[0].data.masterProfile as Record<string, unknown>;
    // Sibling keys preserved
    expect(data.businessInfo).toEqual({ name: "JET" });
    expect(data.summary).toBe("stale summary");
    // Chart stored + timestamped
    const chart = data.organizationChart as Record<string, unknown>;
    expect(chart.companyName).toBe("주식회사 제이이티");
    expect(typeof chart.updatedAt).toBe("string");
  });
});

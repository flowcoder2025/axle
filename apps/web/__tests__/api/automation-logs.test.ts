/**
 * Tests for GET /api/automation-logs (WI-130).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockAutomationLog,
  mockClient,
} = vi.hoisted(() => ({
  mockAutomationLog: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  mockClient: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("@axle/db", () => ({
  prisma: {
    automationLog: mockAutomationLog,
    client: mockClient,
  },
}));

vi.mock("@axle/auth", () => ({
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from "@axle/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const authedUser = { id: "user-1", orgId: "org-1", email: "a@test.com" };

function makeRequest(url: string): Request {
  return new Request(url, { method: "GET" });
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const sampleLog = {
  id: "log-1",
  clientId: "client-1",
  type: "HOMETAX_ISSUE",
  target: "https://www.hometax.go.kr",
  status: "COMPLETED",
  resultUrl: null,
  errorMessage: null,
  executedAt: new Date("2026-01-01T00:00:00Z"),
};

const sampleClients = [
  { id: "client-1" },
  { id: "client-2" },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/automation-logs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser as never);
    mockClient.findFirst.mockResolvedValue(sampleClients[0]);
    mockClient.findMany.mockResolvedValue(sampleClients);
    mockAutomationLog.findMany.mockResolvedValue([sampleLog]);
    mockAutomationLog.count.mockResolvedValue(1);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null as never);
    const { GET } = await import("../../app/api/automation-logs/route");
    const res = await GET(makeRequest("http://localhost/api/automation-logs") as never);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no orgId", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "u", orgId: null, email: "a@b.com" } as never);
    const { GET } = await import("../../app/api/automation-logs/route");
    const res = await GET(makeRequest("http://localhost/api/automation-logs") as never);
    expect(res.status).toBe(403);
  });

  it("returns 200 with logs for authenticated user", async () => {
    const { GET } = await import("../../app/api/automation-logs/route");
    const res = await GET(makeRequest("http://localhost/api/automation-logs") as never);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; meta: { total: number; page: number; pageSize: number } };
    expect(body.data).toHaveLength(1);
    expect(body.meta.total).toBe(1);
    expect(body.meta.page).toBe(1);
    expect(body.meta.pageSize).toBe(20);
  });

  it("filters by clientId — returns 404 when client not in org", async () => {
    mockClient.findFirst.mockResolvedValue(null);
    const { GET } = await import("../../app/api/automation-logs/route");
    const res = await GET(
      makeRequest("http://localhost/api/automation-logs?clientId=other-client") as never
    );
    expect(res.status).toBe(404);
  });

  it("filters by clientId when client belongs to org", async () => {
    const { GET } = await import("../../app/api/automation-logs/route");
    const res = await GET(
      makeRequest("http://localhost/api/automation-logs?clientId=client-1") as never
    );
    expect(res.status).toBe(200);
    expect(mockClient.findFirst).toHaveBeenCalledWith({
      where: { id: "client-1", orgId: "org-1" },
      select: { id: true },
    });
  });

  it("supports type filter", async () => {
    const { GET } = await import("../../app/api/automation-logs/route");
    await GET(makeRequest("http://localhost/api/automation-logs?type=HOMETAX_ISSUE") as never);
    expect(mockAutomationLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "HOMETAX_ISSUE" }),
      })
    );
  });

  it("supports status filter", async () => {
    const { GET } = await import("../../app/api/automation-logs/route");
    await GET(makeRequest("http://localhost/api/automation-logs?status=FAILED") as never);
    expect(mockAutomationLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "FAILED" }),
      })
    );
  });

  it("supports pagination", async () => {
    const { GET } = await import("../../app/api/automation-logs/route");
    await GET(makeRequest("http://localhost/api/automation-logs?page=2&pageSize=10") as never);
    expect(mockAutomationLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
  });

  it("returns 400 for invalid type filter", async () => {
    const { GET } = await import("../../app/api/automation-logs/route");
    const res = await GET(
      makeRequest("http://localhost/api/automation-logs?type=INVALID_TYPE") as never
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid pageSize", async () => {
    const { GET } = await import("../../app/api/automation-logs/route");
    const res = await GET(
      makeRequest("http://localhost/api/automation-logs?pageSize=999") as never
    );
    expect(res.status).toBe(400);
  });

  it("returns correct totalPages in meta", async () => {
    mockAutomationLog.count.mockResolvedValue(45);
    mockAutomationLog.findMany.mockResolvedValue([]);
    const { GET } = await import("../../app/api/automation-logs/route");
    const res = await GET(makeRequest("http://localhost/api/automation-logs?pageSize=10") as never);
    const body = await res.json() as { meta: { totalPages: number } };
    expect(body.meta.totalPages).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Validation schema tests
// ---------------------------------------------------------------------------

describe("automationLogSearchSchema", () => {
  it("accepts valid type", async () => {
    const { automationLogSearchSchema } = await import("../../lib/validations/automation-log");
    const result = automationLogSearchSchema.safeParse({ type: "DART_FETCH" });
    expect(result.success).toBe(true);
  });

  it("accepts valid status", async () => {
    const { automationLogSearchSchema } = await import("../../lib/validations/automation-log");
    const result = automationLogSearchSchema.safeParse({ status: "RUNNING" });
    expect(result.success).toBe(true);
  });

  it("rejects unknown type", async () => {
    const { automationLogSearchSchema } = await import("../../lib/validations/automation-log");
    const result = automationLogSearchSchema.safeParse({ type: "UNKNOWN" });
    expect(result.success).toBe(false);
  });

  it("coerces page to number", async () => {
    const { automationLogSearchSchema } = await import("../../lib/validations/automation-log");
    const result = automationLogSearchSchema.safeParse({ page: "3" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.page).toBe(3);
  });
});

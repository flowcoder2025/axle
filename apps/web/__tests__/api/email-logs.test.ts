import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockEmailLog = {
  findMany: vi.fn(),
  count: vi.fn(),
};

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    emailLog: mockEmailLog,
  },
}));

vi.mock("@axle/auth", () => ({
  AUTH_PACKAGE: "@axle/auth",
  getCurrentUser: vi.fn(),
}));

// --- Helpers ---

import { getCurrentUser } from "@axle/auth";

const authedUser = { id: "user-1", orgId: "org-1", email: "a@test.com" };

function makeRequest(method: string, url: string): Request {
  return new Request(url, { method });
}

// --- Validation schema tests ---

describe("emailLogQuerySchema", () => {
  it("applies defaults when params are absent", async () => {
    const { emailLogQuerySchema } = await import(
      "../../lib/validations/email-log"
    );
    const result = emailLogQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("coerces string page/pageSize to numbers", async () => {
    const { emailLogQuerySchema } = await import(
      "../../lib/validations/email-log"
    );
    const result = emailLogQuerySchema.safeParse({ page: "3", pageSize: "50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.pageSize).toBe(50);
    }
  });

  it("accepts valid EmailType enum value", async () => {
    const { emailLogQuerySchema } = await import(
      "../../lib/validations/email-log"
    );
    const result = emailLogQuerySchema.safeParse({ type: "DOC_REQUEST" });
    expect(result.success).toBe(true);
  });

  it("rejects unknown EmailType value", async () => {
    const { emailLogQuerySchema } = await import(
      "../../lib/validations/email-log"
    );
    const result = emailLogQuerySchema.safeParse({ type: "UNKNOWN_TYPE" });
    expect(result.success).toBe(false);
  });

  it("rejects pageSize above 100", async () => {
    const { emailLogQuerySchema } = await import(
      "../../lib/validations/email-log"
    );
    const result = emailLogQuerySchema.safeParse({ pageSize: "200" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid datetime for dateFrom", async () => {
    const { emailLogQuerySchema } = await import(
      "../../lib/validations/email-log"
    );
    const result = emailLogQuerySchema.safeParse({ dateFrom: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("accepts valid ISO datetime strings", async () => {
    const { emailLogQuerySchema } = await import(
      "../../lib/validations/email-log"
    );
    const result = emailLogQuerySchema.safeParse({
      dateFrom: "2024-01-01T00:00:00.000Z",
      dateTo: "2024-12-31T23:59:59.000Z",
    });
    expect(result.success).toBe(true);
  });
});

// --- Route handler tests ---

describe("GET /api/email-logs", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const { GET } = await import("../../app/api/email-logs/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/email-logs") as never
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
    const { GET } = await import("../../app/api/email-logs/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/email-logs") as never
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns list response in correct shape", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const fakeLogs = [
      {
        id: "el-1",
        meetingId: null,
        clientId: "c-1",
        projectId: null,
        to: "test@example.com",
        subject: "Document request",
        type: "DOC_REQUEST",
        channel: "email",
        resendMessageId: null,
        sentAt: new Date("2024-06-01T10:00:00.000Z"),
        openedAt: null,
      },
    ];
    mockEmailLog.findMany.mockResolvedValue(fakeLogs);
    mockEmailLog.count.mockResolvedValue(1);

    const { GET } = await import("../../app/api/email-logs/route");
    const res = await GET(
      makeRequest("GET", "http://localhost/api/email-logs") as never
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      data: expect.any(Array),
      total: 1,
      page: 1,
      pageSize: 20,
    });
    expect(body.data).toHaveLength(1);
    expect(body.data[0].type).toBe("DOC_REQUEST");
  });

  it("passes clientId filter to prisma", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockEmailLog.findMany.mockResolvedValue([]);
    mockEmailLog.count.mockResolvedValue(0);

    const { GET } = await import("../../app/api/email-logs/route");
    await GET(
      makeRequest(
        "GET",
        "http://localhost/api/email-logs?clientId=c-42"
      ) as never
    );
    expect(mockEmailLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientId: "c-42" }),
      })
    );
  });

  it("passes type filter to prisma", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockEmailLog.findMany.mockResolvedValue([]);
    mockEmailLog.count.mockResolvedValue(0);

    const { GET } = await import("../../app/api/email-logs/route");
    await GET(
      makeRequest(
        "GET",
        "http://localhost/api/email-logs?type=MEETING_SUMMARY"
      ) as never
    );
    expect(mockEmailLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "MEETING_SUMMARY" }),
      })
    );
  });

  it("applies sentAt range filter when dateFrom and dateTo are provided", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockEmailLog.findMany.mockResolvedValue([]);
    mockEmailLog.count.mockResolvedValue(0);

    const { GET } = await import("../../app/api/email-logs/route");
    await GET(
      makeRequest(
        "GET",
        "http://localhost/api/email-logs?dateFrom=2024-01-01T00:00:00.000Z&dateTo=2024-12-31T23:59:59.000Z"
      ) as never
    );
    expect(mockEmailLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sentAt: {
            gte: new Date("2024-01-01T00:00:00.000Z"),
            lte: new Date("2024-12-31T23:59:59.000Z"),
          },
        }),
      })
    );
  });

  it("returns 400 on invalid query params", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    const { GET } = await import("../../app/api/email-logs/route");
    const res = await GET(
      makeRequest(
        "GET",
        "http://localhost/api/email-logs?type=INVALID_TYPE"
      ) as never
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("orders results by sentAt desc", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockEmailLog.findMany.mockResolvedValue([]);
    mockEmailLog.count.mockResolvedValue(0);

    const { GET } = await import("../../app/api/email-logs/route");
    await GET(
      makeRequest("GET", "http://localhost/api/email-logs") as never
    );
    expect(mockEmailLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { sentAt: "desc" },
      })
    );
  });

  it("respects page and pageSize for pagination", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(authedUser);
    mockEmailLog.findMany.mockResolvedValue([]);
    mockEmailLog.count.mockResolvedValue(0);

    const { GET } = await import("../../app/api/email-logs/route");
    const res = await GET(
      makeRequest(
        "GET",
        "http://localhost/api/email-logs?page=2&pageSize=10"
      ) as never
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page).toBe(2);
    expect(body.pageSize).toBe(10);
    expect(mockEmailLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
  });
});

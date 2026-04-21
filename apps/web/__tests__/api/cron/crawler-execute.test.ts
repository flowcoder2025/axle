/**
 * Tests for POST /api/cron/crawler-execute and the underlying
 * crawler-persist service (WI-211-212-213).
 *
 * - fetch is mocked so no real HTTP is performed
 * - @axle/db is mocked so no real DB is touched
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- DB mock ---

const mockProgramInfo = {
  findUnique: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
};
const mockAutomationLog = {
  create: vi.fn(),
};

vi.mock("@axle/db", () => ({
  prisma: {
    programInfo: mockProgramInfo,
    automationLog: mockAutomationLog,
  },
}));

// @prisma/client is imported by crawler-persist for Prisma.JsonNull/InputJsonValue
vi.mock("@prisma/client", () => ({
  Prisma: {
    JsonNull: null,
  },
}));

// Mock @axle/crawler so the route test does not depend on the compiled
// crawler package (which lives outside the worktree).
class MockBizinfoApiSource {
  constructor(_apiKey?: string) {
    // no-op
  }
  async fetchAllPrograms(): Promise<unknown[]> {
    return [
      {
        name: "창업 공고",
        externalId: "abc-1",
        category: "창업",
      },
    ];
  }
}

class MockKStartupApiSource {
  constructor(_apiKey?: string) {
    // no-op
  }
  async fetchAllPrograms(): Promise<unknown[]> {
    return [];
  }
}

vi.mock("@axle/crawler", () => ({
  BizinfoApiSource: MockBizinfoApiSource,
  KStartupApiSource: MockKStartupApiSource,
}));

// --- Helpers ---

function authedRequest(): Request {
  return new Request("http://localhost/api/cron/crawler-execute", {
    method: "POST",
    headers: { authorization: "Bearer test-secret" },
  });
}

process.env.CRON_SECRET = "test-secret";

beforeEach(() => {
  vi.clearAllMocks();
  mockProgramInfo.findUnique.mockReset();
  mockProgramInfo.update.mockReset();
  mockProgramInfo.create.mockReset();
  mockAutomationLog.create.mockReset();
  delete process.env.BIZINFO_API_KEY;
  delete process.env.KSTARTUP_API_KEY;
});

// --- crawler-persist unit tests ---

describe("retryWithBackoff", () => {
  it("returns result on first success", async () => {
    const { retryWithBackoff } = await import(
      "../../../lib/services/crawler-persist"
    );
    const fn = vi.fn().mockResolvedValue("ok");
    const out = await retryWithBackoff(fn, [0, 0, 0]);
    expect(out).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries up to 3 times then succeeds on 3rd attempt", async () => {
    const { retryWithBackoff } = await import(
      "../../../lib/services/crawler-persist"
    );
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("a"))
      .mockRejectedValueOnce(new Error("b"))
      .mockResolvedValueOnce("ok");
    const out = await retryWithBackoff(fn, [0, 0, 0]);
    expect(out).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws last error after exhausting all retries", async () => {
    const { retryWithBackoff } = await import(
      "../../../lib/services/crawler-persist"
    );
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(new Error("boom"));
    await expect(retryWithBackoff(fn, [0, 0, 0])).rejects.toThrow("boom");
    // initial + 3 retries = 4 attempts
    expect(fn).toHaveBeenCalledTimes(4);
  });
});

describe("mapToProgramCategory", () => {
  it("maps Korean labels to enum values", async () => {
    const { mapToProgramCategory } = await import(
      "../../../lib/services/crawler-persist"
    );
    expect(mapToProgramCategory("창업")).toBe("STARTUP");
    expect(mapToProgramCategory("R&D")).toBe("RND");
    expect(mapToProgramCategory("수출")).toBe("EXPORT");
    expect(mapToProgramCategory("기타")).toBe("GENERAL");
    expect(mapToProgramCategory(undefined)).toBe("GENERAL");
  });
});

describe("runAndPersistSource", () => {
  it("upserts new programs and writes a COMPLETED AutomationLog", async () => {
    const { runAndPersistSource } = await import(
      "../../../lib/services/crawler-persist"
    );

    mockProgramInfo.findUnique.mockResolvedValue(null);
    mockProgramInfo.create.mockResolvedValue({});
    mockAutomationLog.create.mockResolvedValue({});

    const result = await runAndPersistSource({
      source: "bizinfo",
      fetch: async () => [
        { name: "프로그램1", externalId: "ext-1", category: "창업" },
        { name: "프로그램2", externalId: "ext-2", category: "R&D" },
      ],
      retryDelaysMs: [0, 0, 0],
    });

    expect(result.source).toBe("bizinfo");
    expect(result.imported).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.error).toBeUndefined();

    expect(mockProgramInfo.create).toHaveBeenCalledTimes(2);
    expect(mockProgramInfo.update).not.toHaveBeenCalled();
    expect(mockAutomationLog.create).toHaveBeenCalledTimes(1);
    const logArg = mockAutomationLog.create.mock.calls[0][0];
    expect(logArg.data.type).toBe("CRAWL");
    expect(logArg.data.status).toBe("COMPLETED");
    expect(logArg.data.target).toBe("bizinfo");
    expect(logArg.data.detail.imported).toBe(2);
    expect(logArg.data.detail.updated).toBe(0);
  });

  it("updates existing programs instead of creating", async () => {
    const { runAndPersistSource } = await import(
      "../../../lib/services/crawler-persist"
    );

    mockProgramInfo.findUnique.mockResolvedValue({ id: "existing-id" });
    mockProgramInfo.update.mockResolvedValue({});
    mockAutomationLog.create.mockResolvedValue({});

    const result = await runAndPersistSource({
      source: "kstartup",
      fetch: async () => [
        { name: "기존프로그램", externalId: "ext-99", category: "창업" },
      ],
      retryDelaysMs: [0, 0, 0],
    });

    expect(result.imported).toBe(0);
    expect(result.updated).toBe(1);
    expect(mockProgramInfo.create).not.toHaveBeenCalled();
    expect(mockProgramInfo.update).toHaveBeenCalledTimes(1);
  });

  it("retries failing fetch 3 times before writing FAILED AutomationLog", async () => {
    const { runAndPersistSource } = await import(
      "../../../lib/services/crawler-persist"
    );

    const fetchFn = vi
      .fn<() => Promise<never>>()
      .mockRejectedValue(new Error("transient"));

    mockAutomationLog.create.mockResolvedValue({});

    const result = await runAndPersistSource({
      source: "bizinfo",
      fetch: fetchFn,
      retryDelaysMs: [0, 0, 0],
    });

    expect(fetchFn).toHaveBeenCalledTimes(4); // initial + 3 retries
    expect(result.imported).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.error).toBe("transient");
    expect(mockAutomationLog.create).toHaveBeenCalledTimes(1);
    const logArg = mockAutomationLog.create.mock.calls[0][0];
    expect(logArg.data.status).toBe("FAILED");
    expect(logArg.data.errorMessage).toBe("transient");
  });

  it("counts upsert failures (missing externalId) without aborting", async () => {
    const { runAndPersistSource } = await import(
      "../../../lib/services/crawler-persist"
    );

    mockProgramInfo.findUnique.mockResolvedValue(null);
    mockProgramInfo.create.mockResolvedValue({});
    mockAutomationLog.create.mockResolvedValue({});

    const result = await runAndPersistSource({
      source: "bizinfo",
      fetch: async () => [
        { name: "good", externalId: "ext-1", category: "창업" },
        { name: "bad (no externalId)", category: "창업" }, // missing externalId
      ],
      retryDelaysMs: [0, 0, 0],
    });

    expect(result.imported).toBe(1);
    expect(result.failed).toBe(1);
    expect(mockProgramInfo.create).toHaveBeenCalledTimes(1);
    expect(mockAutomationLog.create).toHaveBeenCalledTimes(1);
  });
});

// --- cron route tests ---

describe("POST /api/cron/crawler-execute", () => {
  it("returns 401 when auth is missing", async () => {
    const { POST } = await import(
      "../../../app/api/cron/crawler-execute/route"
    );
    const req = new Request("http://localhost/api/cron/crawler-execute", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns empty sources when no API keys are set", async () => {
    const { POST } = await import(
      "../../../app/api/cron/crawler-execute/route"
    );
    const res = await POST(authedRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.sources).toEqual([]);
    expect(typeof body.totalDuration).toBe("number");
    expect(mockAutomationLog.create).not.toHaveBeenCalled();
  });

  it("runs bizinfo when only BIZINFO_API_KEY is set", async () => {
    process.env.BIZINFO_API_KEY = "biz-key";

    mockProgramInfo.findUnique.mockResolvedValue(null);
    mockProgramInfo.create.mockResolvedValue({});
    mockAutomationLog.create.mockResolvedValue({});

    const { POST } = await import(
      "../../../app/api/cron/crawler-execute/route"
    );
    const res = await POST(authedRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.sources).toHaveLength(1);
    expect(body.sources[0].source).toBe("bizinfo");
    expect(body.sources[0].imported).toBe(1);
    expect(mockAutomationLog.create).toHaveBeenCalledTimes(1);
  });
});

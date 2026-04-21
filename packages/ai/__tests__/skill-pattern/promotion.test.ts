import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockSkillPattern } = vi.hoisted(() => {
  const mockSkillPattern = {
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  };
  return { mockSkillPattern };
});

vi.mock("@axle/db", () => ({
  prisma: {
    skillPattern: mockSkillPattern,
  },
}));

import {
  canTransition,
  transitionStatus,
  queueForFineTune,
  promoteToLocalMlx,
  markFineTuneComplete,
  hasPromotedPatternFor,
  postAdapterToBridge,
  InvalidTransitionError,
} from "../../src/skill-pattern/promotion.js";

beforeEach(() => {
  vi.clearAllMocks();
});

// ==================== canTransition ====================

describe("canTransition", () => {
  it("allows IDLE → CANDIDATE", () => {
    expect(canTransition("IDLE", "CANDIDATE")).toBe(true);
  });

  it("allows CANDIDATE → QUEUED", () => {
    expect(canTransition("CANDIDATE", "QUEUED")).toBe(true);
  });

  it("allows QUEUED → FINE_TUNING", () => {
    expect(canTransition("QUEUED", "FINE_TUNING")).toBe(true);
  });

  it("allows FINE_TUNING → COMPLETED", () => {
    expect(canTransition("FINE_TUNING", "COMPLETED")).toBe(true);
  });

  it("allows COMPLETED → PROMOTED", () => {
    expect(canTransition("COMPLETED", "PROMOTED")).toBe(true);
  });

  it("allows FAILED → QUEUED (retry)", () => {
    expect(canTransition("FAILED", "QUEUED")).toBe(true);
  });

  it("rejects IDLE → PROMOTED (must go through fine-tune)", () => {
    expect(canTransition("IDLE", "PROMOTED")).toBe(false);
  });

  it("rejects PROMOTED → FINE_TUNING directly", () => {
    expect(canTransition("PROMOTED", "FINE_TUNING")).toBe(false);
  });
});

// ==================== transitionStatus ====================

describe("transitionStatus", () => {
  it("throws if pattern not found", async () => {
    mockSkillPattern.findUnique.mockResolvedValue(null);
    await expect(transitionStatus("missing", "CANDIDATE")).rejects.toThrow(
      "not found",
    );
  });

  it("returns current when target equals current", async () => {
    mockSkillPattern.findUnique.mockResolvedValue({
      id: "p1",
      status: "IDLE",
    });
    const result = await transitionStatus("p1", "IDLE");
    expect(result.status).toBe("IDLE");
    expect(mockSkillPattern.update).not.toHaveBeenCalled();
  });

  it("throws InvalidTransitionError for illegal transitions", async () => {
    mockSkillPattern.findUnique.mockResolvedValue({
      id: "p1",
      status: "IDLE",
    });
    await expect(transitionStatus("p1", "PROMOTED")).rejects.toThrow(
      InvalidTransitionError,
    );
  });

  it("stamps fineTuneStartedAt on QUEUED → FINE_TUNING", async () => {
    mockSkillPattern.findUnique.mockResolvedValue({
      id: "p1",
      status: "QUEUED",
    });
    mockSkillPattern.update.mockImplementation(async ({ data }) => ({
      id: "p1",
      status: "FINE_TUNING",
      ...data,
    }));

    await transitionStatus("p1", "FINE_TUNING");
    const updateCall = mockSkillPattern.update.mock.calls[0]![0];
    expect(updateCall.data.status).toBe("FINE_TUNING");
    expect(updateCall.data.fineTuneStartedAt).toBeInstanceOf(Date);
  });

  it("sets isFineTuned=true and promotedAt on PROMOTED", async () => {
    mockSkillPattern.findUnique.mockResolvedValue({
      id: "p1",
      status: "COMPLETED",
    });
    mockSkillPattern.update.mockImplementation(async ({ data }) => ({
      id: "p1",
      ...data,
    }));

    await transitionStatus("p1", "PROMOTED");
    const updateCall = mockSkillPattern.update.mock.calls[0]![0];
    expect(updateCall.data.isFineTuned).toBe(true);
    expect(updateCall.data.promotedAt).toBeInstanceOf(Date);
    expect(updateCall.data.errorMessage).toBeNull();
  });

  it("defaults errorMessage on FAILED when none supplied", async () => {
    mockSkillPattern.findUnique.mockResolvedValue({
      id: "p1",
      status: "FINE_TUNING",
    });
    mockSkillPattern.update.mockImplementation(async ({ data }) => ({
      id: "p1",
      ...data,
    }));

    await transitionStatus("p1", "FAILED");
    const updateCall = mockSkillPattern.update.mock.calls[0]![0];
    expect(updateCall.data.errorMessage).toBe("Unknown error");
  });
});

// ==================== queueForFineTune ====================

describe("queueForFineTune", () => {
  it("rejects patterns with successCount < 10", async () => {
    mockSkillPattern.findUnique.mockResolvedValue({
      id: "p1",
      status: "IDLE",
      successCount: 5,
    });
    await expect(queueForFineTune("p1")).rejects.toThrow("need >= 10");
  });

  it("rejects patterns not in IDLE/CANDIDATE/FAILED", async () => {
    mockSkillPattern.findUnique.mockResolvedValue({
      id: "p1",
      status: "FINE_TUNING",
      successCount: 10,
    });
    await expect(queueForFineTune("p1")).rejects.toThrow(InvalidTransitionError);
  });

  it("transitions CANDIDATE → QUEUED when threshold is met", async () => {
    const current = {
      id: "p1",
      status: "CANDIDATE",
      successCount: 15,
    };
    // findUnique is called twice: once by queueForFineTune, once by transitionStatus
    mockSkillPattern.findUnique.mockResolvedValue(current);
    mockSkillPattern.update.mockImplementation(async ({ data }) => ({
      ...current,
      ...data,
    }));

    const result = await queueForFineTune("p1");
    expect(result.status).toBe("QUEUED");
  });
});

// ==================== promoteToLocalMlx ====================

describe("promoteToLocalMlx", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("requires COMPLETED status", async () => {
    mockSkillPattern.findUnique.mockResolvedValue({
      id: "p1",
      status: "IDLE",
    });
    await expect(promoteToLocalMlx("p1")).rejects.toThrow(InvalidTransitionError);
  });

  it("fails when loraAdapterUrl is missing", async () => {
    mockSkillPattern.findUnique.mockResolvedValue({
      id: "p1",
      status: "COMPLETED",
      loraAdapterUrl: null,
      taskType: "SUMMARY",
    });
    mockSkillPattern.update.mockImplementation(async ({ data }) => ({
      id: "p1",
      ...data,
    }));

    const result = await promoteToLocalMlx("p1");
    expect(result.status).toBe("FAILED");
    expect(mockSkillPattern.update.mock.calls[0]![0].data.errorMessage).toMatch(
      /Missing loraAdapterUrl/,
    );
  });

  it("fails when bridge env vars are missing", async () => {
    delete process.env.AGENT_BRIDGE_URL;
    delete process.env.AGENT_BRIDGE_TOKEN;

    mockSkillPattern.findUnique.mockResolvedValue({
      id: "p1",
      status: "COMPLETED",
      loraAdapterUrl: "https://example.com/adapter.safetensors",
      taskType: "SUMMARY",
    });
    mockSkillPattern.update.mockImplementation(async ({ data }) => ({
      id: "p1",
      ...data,
    }));

    const result = await promoteToLocalMlx("p1");
    expect(result.status).toBe("FAILED");
    expect(mockSkillPattern.update.mock.calls[0]![0].data.errorMessage).toMatch(
      /AGENT_BRIDGE_URL/,
    );
  });

  it("transitions COMPLETED → PROMOTED on bridge success", async () => {
    process.env.AGENT_BRIDGE_URL = "https://bridge.local";
    process.env.AGENT_BRIDGE_TOKEN = "test-token";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "ok",
    });
    vi.stubGlobal("fetch", fetchMock);

    mockSkillPattern.findUnique.mockResolvedValue({
      id: "p1",
      status: "COMPLETED",
      loraAdapterUrl: "https://example.com/adapter.safetensors",
      taskType: "SUMMARY",
    });
    mockSkillPattern.update.mockImplementation(async ({ data }) => ({
      id: "p1",
      ...data,
    }));

    const result = await promoteToLocalMlx("p1");
    expect(result.status).toBe("PROMOTED");
    expect(result.isFineTuned).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://bridge.local/adapters/promote",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("transitions COMPLETED → FAILED on bridge 5xx", async () => {
    process.env.AGENT_BRIDGE_URL = "https://bridge.local";
    process.env.AGENT_BRIDGE_TOKEN = "test-token";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "internal error",
      }),
    );

    mockSkillPattern.findUnique.mockResolvedValue({
      id: "p1",
      status: "COMPLETED",
      loraAdapterUrl: "https://example.com/a.safetensors",
      taskType: "SUMMARY",
    });
    mockSkillPattern.update.mockImplementation(async ({ data }) => ({
      id: "p1",
      ...data,
    }));

    const result = await promoteToLocalMlx("p1");
    expect(result.status).toBe("FAILED");
    expect(mockSkillPattern.update.mock.calls[0]![0].data.errorMessage).toMatch(
      /500/,
    );
  });
});

// ==================== markFineTuneComplete ====================

describe("markFineTuneComplete", () => {
  afterEach(() => {
    delete process.env.AGENT_BRIDGE_URL;
    delete process.env.AGENT_BRIDGE_TOKEN;
  });

  it("transitions FINE_TUNING → COMPLETED → PROMOTED when bridge succeeds", async () => {
    process.env.AGENT_BRIDGE_URL = "https://bridge.local";
    process.env.AGENT_BRIDGE_TOKEN = "t";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "" }),
    );

    // findUnique is called twice: by transitionStatus(COMPLETED) and
    // by promoteToLocalMlx. After the first update the status is COMPLETED
    // with the adapter URL set.
    const snapshot = {
      id: "p1",
      taskType: "SUMMARY",
      loraAdapterUrl: "https://a.com/a.safetensors",
    };
    mockSkillPattern.findUnique
      .mockResolvedValueOnce({ ...snapshot, status: "FINE_TUNING" })
      .mockResolvedValueOnce({ ...snapshot, status: "COMPLETED" });
    mockSkillPattern.update.mockImplementation(async ({ data }) => ({
      ...snapshot,
      ...data,
    }));

    const result = await markFineTuneComplete(
      "p1",
      "https://a.com/a.safetensors",
    );
    expect(result.status).toBe("PROMOTED");
  });
});

// ==================== hasPromotedPatternFor ====================

describe("hasPromotedPatternFor", () => {
  it("returns true when count > 0", async () => {
    mockSkillPattern.count.mockResolvedValue(2);
    expect(await hasPromotedPatternFor("SUMMARY")).toBe(true);
    expect(mockSkillPattern.count).toHaveBeenCalledWith({
      where: { taskType: "SUMMARY", status: "PROMOTED" },
    });
  });

  it("returns false when count = 0", async () => {
    mockSkillPattern.count.mockResolvedValue(0);
    expect(await hasPromotedPatternFor("OCR")).toBe(false);
  });
});

// ==================== postAdapterToBridge ====================

describe("postAdapterToBridge", () => {
  afterEach(() => {
    delete process.env.AGENT_BRIDGE_URL;
    delete process.env.AGENT_BRIDGE_TOKEN;
  });

  it("returns error when env vars missing", async () => {
    const result = await postAdapterToBridge({
      patternId: "p1",
      taskType: "SUMMARY",
      adapterUrl: "https://a.com/a",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorMessage).toMatch(/AGENT_BRIDGE_URL/);
    }
  });

  it("returns error on fetch rejection", async () => {
    process.env.AGENT_BRIDGE_URL = "https://bridge.local";
    process.env.AGENT_BRIDGE_TOKEN = "t";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const result = await postAdapterToBridge({
      patternId: "p1",
      taskType: "SUMMARY",
      adapterUrl: "https://a.com/a",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorMessage).toMatch(/ECONNREFUSED/);
    }
  });
});

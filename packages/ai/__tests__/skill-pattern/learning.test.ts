import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const { mockSkillPattern } = vi.hoisted(() => {
  const mockSkillPattern = {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  };
  return { mockSkillPattern };
});

vi.mock("@axle/db", () => ({
  prisma: {
    skillPattern: mockSkillPattern,
  },
}));

import {
  extractAndStorePattern,
  findMatchingPattern,
  getFineTuningCandidates,
  markAsFineTuned,
} from "../../src/skill-pattern/learning.js";

beforeEach(() => {
  vi.clearAllMocks();
});

// ==================== extractAndStorePattern ====================

describe("extractAndStorePattern", () => {
  it("does nothing when success is false", async () => {
    await extractAndStorePattern({
      aiJobId: "job-1",
      type: "SUMMARY",
      input: { text: "hello" },
      output: { summary: "hi" },
      success: false,
    });

    expect(mockSkillPattern.findFirst).not.toHaveBeenCalled();
    expect(mockSkillPattern.create).not.toHaveBeenCalled();
    expect(mockSkillPattern.update).not.toHaveBeenCalled();
  });

  it("creates a new pattern when none exists", async () => {
    mockSkillPattern.findFirst.mockResolvedValue(null);
    mockSkillPattern.create.mockResolvedValue({ id: "pat-1" });

    await extractAndStorePattern({
      aiJobId: "job-1",
      type: "SUMMARY",
      input: { text: "hello" },
      output: { summary: "hi" },
      success: true,
    });

    expect(mockSkillPattern.findFirst).toHaveBeenCalledOnce();
    expect(mockSkillPattern.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taskType: "SUMMARY",
          successCount: 1,
          isFineTuned: false,
        }),
      })
    );
    expect(mockSkillPattern.update).not.toHaveBeenCalled();
  });

  it("increments successCount on existing pattern", async () => {
    const existing = {
      id: "pat-1",
      taskType: "SUMMARY",
      successCount: 5,
      isFineTuned: false,
    };
    mockSkillPattern.findFirst.mockResolvedValue(existing);
    mockSkillPattern.update.mockResolvedValue({ id: "pat-1" });

    await extractAndStorePattern({
      aiJobId: "job-2",
      type: "SUMMARY",
      input: { text: "hello" },
      output: { summary: "hi" },
      success: true,
    });

    expect(mockSkillPattern.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pat-1" },
        data: expect.objectContaining({ successCount: 6 }),
      })
    );
    expect(mockSkillPattern.create).not.toHaveBeenCalled();
  });

  it("stores lastUsedAt when updating existing pattern", async () => {
    const existing = {
      id: "pat-2",
      taskType: "RESEARCH",
      successCount: 3,
      isFineTuned: false,
    };
    mockSkillPattern.findFirst.mockResolvedValue(existing);
    mockSkillPattern.update.mockResolvedValue({ id: "pat-2" });

    await extractAndStorePattern({
      aiJobId: "job-3",
      type: "RESEARCH",
      input: {},
      output: {},
      success: true,
    });

    expect(mockSkillPattern.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastUsedAt: expect.any(Date),
        }),
      })
    );
  });

  it("does NOT change isFineTuned when successCount reaches 10 (candidate marking is separate)", async () => {
    const existing = {
      id: "pat-3",
      taskType: "OCR",
      successCount: 9,
      isFineTuned: false,
    };
    mockSkillPattern.findFirst.mockResolvedValue(existing);
    mockSkillPattern.update.mockResolvedValue({ id: "pat-3" });

    await extractAndStorePattern({
      aiJobId: "job-4",
      type: "OCR",
      input: { file: "x" },
      output: { text: "y" },
      success: true,
    });

    expect(mockSkillPattern.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ successCount: 10 }),
      })
    );
  });

  it("pattern name is set to Auto:<taskType> on create", async () => {
    mockSkillPattern.findFirst.mockResolvedValue(null);
    mockSkillPattern.create.mockResolvedValue({ id: "pat-4" });

    await extractAndStorePattern({
      aiJobId: "job-5",
      type: "EVALUATION",
      input: {},
      output: {},
      success: true,
    });

    expect(mockSkillPattern.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Auto:EVALUATION" }),
      })
    );
  });
});

// ==================== findMatchingPattern ====================

describe("findMatchingPattern", () => {
  it("returns the best matching pattern", async () => {
    const fakePattern = { id: "pat-1", taskType: "SUMMARY", successCount: 7 };
    mockSkillPattern.findFirst.mockResolvedValue(fakePattern);

    const result = await findMatchingPattern("SUMMARY", { text: "hello" });

    expect(mockSkillPattern.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ taskType: "SUMMARY" }),
        orderBy: { successCount: "desc" },
      })
    );
    expect(result).toEqual(fakePattern);
  });

  it("returns null when no matching pattern exists", async () => {
    mockSkillPattern.findFirst.mockResolvedValue(null);

    const result = await findMatchingPattern("TRANSCRIBE", {});

    expect(result).toBeNull();
  });
});

// ==================== getFineTuningCandidates ====================

describe("getFineTuningCandidates", () => {
  it("returns patterns with successCount >= 10 and isFineTuned = false", async () => {
    const fakePatterns = [
      { id: "pat-1", successCount: 15, isFineTuned: false },
      { id: "pat-2", successCount: 10, isFineTuned: false },
    ];
    mockSkillPattern.findMany.mockResolvedValue(fakePatterns);

    const result = await getFineTuningCandidates();

    expect(mockSkillPattern.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { successCount: { gte: 10 }, isFineTuned: false },
        orderBy: { successCount: "desc" },
      })
    );
    expect(result).toEqual(fakePatterns);
  });

  it("returns empty array when no candidates", async () => {
    mockSkillPattern.findMany.mockResolvedValue([]);

    const result = await getFineTuningCandidates();

    expect(result).toEqual([]);
  });
});

// ==================== markAsFineTuned ====================

describe("markAsFineTuned", () => {
  it("sets isFineTuned = true for the given pattern", async () => {
    mockSkillPattern.update.mockResolvedValue({ id: "pat-1", isFineTuned: true });

    await markAsFineTuned("pat-1");

    expect(mockSkillPattern.update).toHaveBeenCalledWith({
      where: { id: "pat-1" },
      data: { isFineTuned: true },
    });
  });
});

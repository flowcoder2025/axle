import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSkillPattern } = vi.hoisted(() => {
  const mockSkillPattern = {
    count: vi.fn(),
  };
  return { mockSkillPattern };
});

vi.mock("@axle/db", () => ({
  prisma: { skillPattern: mockSkillPattern },
}));

import { resolveAiTierAsync } from "../src/router.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveAiTierAsync", () => {
  it("respects forceApiMode", async () => {
    const tier = await resolveAiTierAsync("BUSINESS_PLAN", {
      forceApiMode: true,
      defaultApiTier: "API_OPUS",
    });
    expect(tier).toBe("API_OPUS");
    expect(mockSkillPattern.count).not.toHaveBeenCalled();
  });

  it("returns LOCAL_MLX when promoted pattern exists and local is available", async () => {
    mockSkillPattern.count.mockResolvedValue(1);
    const tier = await resolveAiTierAsync("EVALUATION", {
      localAvailable: true,
    });
    expect(tier).toBe("LOCAL_MLX");
    expect(mockSkillPattern.count).toHaveBeenCalledWith({
      where: { taskType: "EVALUATION", status: "PROMOTED" },
    });
  });

  it("does not query DB when localAvailable=false", async () => {
    const tier = await resolveAiTierAsync("SUMMARY", {
      localAvailable: false,
    });
    expect(tier).toBe("API_HAIKU");
    expect(mockSkillPattern.count).not.toHaveBeenCalled();
  });

  it("does not query DB when preferPromotedPattern=false", async () => {
    const tier = await resolveAiTierAsync("SUMMARY", {
      localAvailable: true,
      preferPromotedPattern: false,
    });
    expect(tier).toBe("LOCAL_MLX"); // static routing still allows LOCAL_MLX for SUMMARY
    expect(mockSkillPattern.count).not.toHaveBeenCalled();
  });

  it("falls back to static routing when no promoted pattern exists", async () => {
    mockSkillPattern.count.mockResolvedValue(0);
    const tier = await resolveAiTierAsync("EVALUATION", {
      localAvailable: true,
    });
    expect(tier).toBe("API_HAIKU");
  });

  it("keeps CLI_CLAUDE routing for BUSINESS_PLAN even when local is available without a promoted pattern", async () => {
    mockSkillPattern.count.mockResolvedValue(0);
    const tier = await resolveAiTierAsync("BUSINESS_PLAN", {
      localAvailable: true,
    });
    expect(tier).toBe("CLI_CLAUDE");
  });
});

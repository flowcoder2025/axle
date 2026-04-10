import { describe, it, expect } from "vitest";
import { resolveAiTier } from "../src/router.js";
import type { AiJobType } from "@prisma/client";

describe("resolveAiTier", () => {
  describe("CLI_CLAUDE tier — high-quality generation jobs", () => {
    it("routes BUSINESS_PLAN to CLI_CLAUDE", () => {
      expect(resolveAiTier("BUSINESS_PLAN")).toBe("CLI_CLAUDE");
    });

    it("routes RESEARCH to CLI_CLAUDE", () => {
      expect(resolveAiTier("RESEARCH")).toBe("CLI_CLAUDE");
    });
  });

  describe("LOCAL_MLX tier — fast local inference (when available)", () => {
    const localConfig = { localAvailable: true };

    it("routes JOURNAL_DRAFT to LOCAL_MLX when local is available", () => {
      expect(resolveAiTier("JOURNAL_DRAFT", localConfig)).toBe("LOCAL_MLX");
    });

    it("routes SUMMARY to LOCAL_MLX when local is available", () => {
      expect(resolveAiTier("SUMMARY", localConfig)).toBe("LOCAL_MLX");
    });

    it("routes OCR to LOCAL_MLX when local is available", () => {
      expect(resolveAiTier("OCR", localConfig)).toBe("LOCAL_MLX");
    });

    it("routes TRANSCRIBE to LOCAL_MLX when local is available", () => {
      expect(resolveAiTier("TRANSCRIBE", localConfig)).toBe("LOCAL_MLX");
    });
  });

  describe("API_HAIKU fallback — local unavailable", () => {
    const noLocalConfig = { localAvailable: false };

    it("routes JOURNAL_DRAFT to API_HAIKU when local is unavailable", () => {
      expect(resolveAiTier("JOURNAL_DRAFT", noLocalConfig)).toBe("API_HAIKU");
    });

    it("routes SUMMARY to API_HAIKU when local is unavailable", () => {
      expect(resolveAiTier("SUMMARY", noLocalConfig)).toBe("API_HAIKU");
    });

    it("routes OCR to API_HAIKU when local is unavailable", () => {
      expect(resolveAiTier("OCR", noLocalConfig)).toBe("API_HAIKU");
    });

    it("routes TRANSCRIBE to API_HAIKU when local is unavailable", () => {
      expect(resolveAiTier("TRANSCRIBE", noLocalConfig)).toBe("API_HAIKU");
    });

    it("defaults localAvailable to false (API_HAIKU for JOURNAL_DRAFT)", () => {
      expect(resolveAiTier("JOURNAL_DRAFT")).toBe("API_HAIKU");
    });
  });

  describe("API_HAIKU tier — structured analysis jobs", () => {
    it("routes FINANCIAL_ANALYSIS to API_HAIKU", () => {
      expect(resolveAiTier("FINANCIAL_ANALYSIS")).toBe("API_HAIKU");
    });

    it("routes GAP_DIAGNOSIS to API_HAIKU", () => {
      expect(resolveAiTier("GAP_DIAGNOSIS")).toBe("API_HAIKU");
    });

    it("routes EVALUATION to API_HAIKU", () => {
      expect(resolveAiTier("EVALUATION")).toBe("API_HAIKU");
    });

    it("routes MATCHING to API_HAIKU", () => {
      expect(resolveAiTier("MATCHING")).toBe("API_HAIKU");
    });
  });

  describe("forceApiMode override", () => {
    it("forces API_HAIKU even for CLI_CLAUDE jobs", () => {
      expect(
        resolveAiTier("BUSINESS_PLAN", { forceApiMode: true })
      ).toBe("API_HAIKU");
    });

    it("forces API_HAIKU even for RESEARCH", () => {
      expect(
        resolveAiTier("RESEARCH", { forceApiMode: true })
      ).toBe("API_HAIKU");
    });

    it("respects defaultApiTier when forceApiMode is true", () => {
      expect(
        resolveAiTier("BUSINESS_PLAN", {
          forceApiMode: true,
          defaultApiTier: "API_OPUS",
        })
      ).toBe("API_OPUS");
    });

    it("forceApiMode overrides localAvailable for LOCAL_MLX jobs", () => {
      expect(
        resolveAiTier("SUMMARY", {
          forceApiMode: true,
          localAvailable: true,
        })
      ).toBe("API_HAIKU");
    });
  });

  describe("all 10 AiJobType values are covered", () => {
    const allJobTypes: AiJobType[] = [
      "BUSINESS_PLAN",
      "RESEARCH",
      "JOURNAL_DRAFT",
      "SUMMARY",
      "OCR",
      "TRANSCRIBE",
      "FINANCIAL_ANALYSIS",
      "GAP_DIAGNOSIS",
      "EVALUATION",
      "MATCHING",
    ];

    for (const jobType of allJobTypes) {
      it(`resolveAiTier("${jobType}") returns a valid AiTier`, () => {
        const tier = resolveAiTier(jobType);
        expect(["LOCAL_MLX", "API_HAIKU", "API_OPUS", "CLI_CLAUDE"]).toContain(tier);
      });
    }
  });
});

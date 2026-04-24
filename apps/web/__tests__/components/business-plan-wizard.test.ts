/**
 * WI-203 — Unit tests for the BusinessPlanWizard progress messaging helper.
 *
 * React Testing Library isn't wired into apps/web (no jsdom), so we exercise
 * the pure `describeProgress` function here. It's the only piece of non-render
 * logic the wizard owns.
 */
import { describe, it, expect } from "vitest";
import {
  describeProgress,
  SUPPORTED_PROJECT_TYPES,
  WIZARD_SECTIONS,
  POLL_INTERVAL_MS,
  POLL_MAX_DURATION_MS,
} from "../../src/components/projects/business-plan-wizard";

describe("describeProgress", () => {
  it("reports QUEUED as the initial state", () => {
    const result = describeProgress("QUEUED", "both", 0);
    expect(result.label).toContain("대기열");
    expect(result.percent).toBeGreaterThan(0);
    expect(result.percent).toBeLessThan(100);
  });

  it("flags COMPLETED at 100%", () => {
    const result = describeProgress("COMPLETED", "both", 300_000);
    expect(result.percent).toBe(100);
  });

  it("flags FAILED at 100% with a distinct label", () => {
    const result = describeProgress("FAILED", "both", 5_000);
    expect(result.percent).toBe(100);
    expect(result.label).toMatch(/실패/);
  });

  it("uses a RAG-only label when engine=rag", () => {
    const result = describeProgress("RUNNING", "rag", 10_000);
    expect(result.label).toMatch(/RAG 초안/);
  });

  it("uses a precision label when engine=precision and elapsed > 30s", () => {
    const result = describeProgress("RUNNING", "precision", 35_000);
    expect(result.label).toMatch(/자가 평가|업로드/);
  });

  it("transitions through phases for engine=both", () => {
    const early = describeProgress("RUNNING", "both", 5_000);
    const mid = describeProgress("RUNNING", "both", 45_000);
    const late = describeProgress("RUNNING", "both", 90_000);
    expect(early.label).toMatch(/RAG 초안/);
    expect(mid.label).toMatch(/정밀 편집/);
    expect(late.label).toMatch(/자가 평가/);
    expect(early.percent).toBeLessThan(mid.percent);
    expect(mid.percent).toBeLessThan(late.percent);
  });

  it("caps the progress bar at 100 or below", () => {
    for (const elapsed of [0, 1_000, 60_000, 600_000]) {
      const result = describeProgress("RUNNING", "both", elapsed);
      expect(result.percent).toBeLessThanOrEqual(100);
      expect(result.percent).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("SUPPORTED_PROJECT_TYPES", () => {
  it("covers the business-plan-adjacent project types", () => {
    expect(SUPPORTED_PROJECT_TYPES.has("BUSINESS_PLAN")).toBe(true);
    expect(SUPPORTED_PROJECT_TYPES.has("VENTURE_CERT")).toBe(true);
    expect(SUPPORTED_PROJECT_TYPES.has("RESEARCH_INSTITUTE")).toBe(true);
    expect(SUPPORTED_PROJECT_TYPES.has("BUNDLE")).toBe(true);
  });

  it("excludes unrelated project types", () => {
    expect(SUPPORTED_PROJECT_TYPES.has("PATENT")).toBe(false);
    expect(SUPPORTED_PROJECT_TYPES.has("SOBOOJANG_CERT")).toBe(false);
  });
});

describe("WIZARD_SECTIONS", () => {
  it("mirrors the 9 venture sections from @axle/docgen", () => {
    // The wizard list is derived from VENTURE_BUSINESS_PLAN_SECTIONS, so the
    // server-side generator and UI cannot drift. Expect all 9 to be required.
    expect(WIZARD_SECTIONS).toHaveLength(9);
    const required = WIZARD_SECTIONS.filter((s) => s.required);
    expect(required).toHaveLength(9);
  });

  it("exposes instruction, tips, and char limits for AI prompt injection", () => {
    for (const section of WIZARD_SECTIONS) {
      expect(section.instruction.length).toBeGreaterThan(0);
      expect(Array.isArray(section.tips)).toBe(true);
      expect(section.tips.length).toBeGreaterThan(0);
      expect(section.minChars).toBeGreaterThan(0);
      expect(section.maxChars).toBeGreaterThanOrEqual(section.minChars);
    }
  });

  it("has unique ids", () => {
    const ids = WIZARD_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Polling constants", () => {
  it("polls every 5 seconds", () => {
    expect(POLL_INTERVAL_MS).toBe(5_000);
  });

  it("caps at 10 minutes", () => {
    expect(POLL_MAX_DURATION_MS).toBe(10 * 60 * 1_000);
  });
});

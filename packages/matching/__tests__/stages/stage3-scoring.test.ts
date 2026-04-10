import { describe, it, expect } from "vitest";
import { stage3Scoring } from "../../src/stages/stage3-scoring.js";
import type { ClientProfile, ProgramProfile } from "../../src/types.js";

const baseClient: ClientProfile = {
  id: "client-1",
  name: "테스트 기업",
  industry: "IT",
  region: "서울",
  employeeCount: 50,
  revenue: 500_000_000,
  isVenture: false,
  isInnoBiz: false,
  certifications: [],
};

const baseProgram: ProgramProfile = {
  id: "prog-1",
  name: "테스트 프로그램",
  category: "STARTUP",
};

describe("stage3Scoring", () => {
  it("returns 0 score with no reasons when nothing matches", () => {
    const result = stage3Scoring(baseClient, baseProgram);
    expect(result.score).toBe(0);
    expect(result.reasons).toHaveLength(0);
  });

  it("adds +15 for region match", () => {
    const program = { ...baseProgram, region: "서울" };
    const result = stage3Scoring(baseClient, program);
    expect(result.score).toBeGreaterThanOrEqual(15);
    expect(result.reasons.some((r) => r.includes("+15점"))).toBe(true);
  });

  it("does not add region score when regions differ", () => {
    const program = { ...baseProgram, region: "부산" };
    const result = stage3Scoring(baseClient, program);
    expect(result.reasons.some((r) => r.includes("지역 일치"))).toBe(false);
  });

  it("adds +20 for industry alignment", () => {
    const program = {
      ...baseProgram,
      requirements: { targetIndustries: ["IT", "바이오"] },
    };
    const result = stage3Scoring(baseClient, program);
    expect(result.score).toBeGreaterThanOrEqual(20);
    expect(result.reasons.some((r) => r.includes("+20점"))).toBe(true);
  });

  it("adds +15 for revenue in target range", () => {
    const program = {
      ...baseProgram,
      requirements: { minRevenue: 100_000_000, maxRevenue: 1_000_000_000 },
    };
    const result = stage3Scoring(baseClient, program);
    expect(result.score).toBeGreaterThanOrEqual(15);
    expect(result.reasons.some((r) => r.includes("매출 범위"))).toBe(true);
  });

  it("does not add revenue score when revenue is below minimum", () => {
    const client = { ...baseClient, revenue: 50_000_000 };
    const program = {
      ...baseProgram,
      requirements: { minRevenue: 100_000_000 },
    };
    const result = stage3Scoring(client, program);
    expect(result.reasons.some((r) => r.includes("매출 범위"))).toBe(false);
  });

  it("adds +10 per matching certification bonus", () => {
    const client = { ...baseClient, certifications: ["ISO9001", "ISO14001"] };
    const program = {
      ...baseProgram,
      requirements: { certBonuses: ["ISO9001", "ISO14001"] },
    };
    const result = stage3Scoring(client, program);
    expect(result.score).toBeGreaterThanOrEqual(20);
    expect(result.reasons.some((r) => r.includes("+20점"))).toBe(true);
  });

  it("adds +10 for venture client on VENTURE program", () => {
    const client = { ...baseClient, isVenture: true };
    const program = { ...baseProgram, category: "VENTURE" };
    const result = stage3Scoring(client, program);
    expect(result.reasons.some((r) => r.includes("벤처기업 인증 보유"))).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(10);
  });

  it("does not add venture bonus for non-venture client", () => {
    const program = { ...baseProgram, category: "VENTURE" };
    const result = stage3Scoring(baseClient, program);
    expect(result.reasons.some((r) => r.includes("벤처기업 인증 보유"))).toBe(false);
  });

  it("adds +10 for innobiz client on CERTIFICATION program", () => {
    const client = { ...baseClient, isInnoBiz: true };
    const program = { ...baseProgram, category: "CERTIFICATION" };
    const result = stage3Scoring(client, program);
    expect(result.reasons.some((r) => r.includes("이노비즈 인증 보유"))).toBe(true);
  });

  it("accumulates score from multiple matching criteria", () => {
    const client = {
      ...baseClient,
      isVenture: true,
      certifications: ["ISO9001"],
    };
    const program = {
      ...baseProgram,
      category: "VENTURE",
      region: "서울",
      requirements: {
        targetIndustries: ["IT"],
        minRevenue: 100_000_000,
        certBonuses: ["ISO9001"],
      },
    };
    const result = stage3Scoring(client, program);
    // region(15) + industry(20) + revenue(15) + cert(10) + venture(10) = 70
    expect(result.score).toBe(70);
  });
});

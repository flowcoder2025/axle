import { describe, it, expect } from "vitest";
import { stage2Penalties } from "../../src/stages/stage2-penalties.js";
import type { ClientProfile, ProgramProfile } from "../../src/types.js";

const baseClient: ClientProfile = {
  id: "client-1",
  name: "테스트 기업",
  industry: "IT",
  region: "서울",
  employeeCount: 50,
  revenue: 500_000_000,
  certifications: [],
};

const baseProgram: ProgramProfile = {
  id: "prog-1",
  name: "테스트 프로그램",
  category: "STARTUP",
};

describe("stage2Penalties", () => {
  it("returns no penalties for a well-matched client", () => {
    const program = {
      ...baseProgram,
      requirements: { targetIndustries: ["IT"] },
    };
    const result = stage2Penalties(baseClient, program);
    expect(result.penalties).toHaveLength(0);
    expect(result.totalPenalty).toBe(0);
  });

  it("penalises -10 for weak industry match", () => {
    const program = {
      ...baseProgram,
      requirements: { targetIndustries: ["제조업", "바이오"] },
    };
    const result = stage2Penalties(baseClient, program);
    const industryPenalty = result.penalties.find((p) => p.reason.includes("산업 분야"));
    expect(industryPenalty).toBeDefined();
    expect(industryPenalty!.points).toBe(10);
  });

  it("penalises -5 when revenue is undefined", () => {
    const client = { ...baseClient, revenue: undefined };
    const result = stage2Penalties(client, baseProgram);
    const revPenalty = result.penalties.find((p) => p.reason.includes("재무 데이터"));
    expect(revPenalty).toBeDefined();
    expect(revPenalty!.points).toBe(5);
  });

  it("penalises -5 when revenue is 0", () => {
    const client = { ...baseClient, revenue: 0 };
    const result = stage2Penalties(client, baseProgram);
    const revPenalty = result.penalties.find((p) => p.reason.includes("재무 데이터"));
    expect(revPenalty).toBeDefined();
    expect(revPenalty!.points).toBe(5);
  });

  it("penalises -5 when employee count below target minimum", () => {
    const program = {
      ...baseProgram,
      requirements: { targetMinEmployees: 100 },
    };
    const client = { ...baseClient, employeeCount: 30 };
    const result = stage2Penalties(client, program);
    const empPenalty = result.penalties.find((p) => p.reason.includes("임직원 수 목표"));
    expect(empPenalty).toBeDefined();
    expect(empPenalty!.points).toBe(5);
  });

  it("does not penalise when employee count meets target", () => {
    const program = {
      ...baseProgram,
      requirements: { targetMinEmployees: 30 },
    };
    const result = stage2Penalties(baseClient, program);
    const empPenalty = result.penalties.find((p) => p.reason.includes("임직원 수 목표"));
    expect(empPenalty).toBeUndefined();
  });

  it("sums totalPenalty across multiple penalties", () => {
    const program = {
      ...baseProgram,
      requirements: { targetIndustries: ["제조업"], targetMinEmployees: 200 },
    };
    const client = { ...baseClient, revenue: 0, employeeCount: 10 };
    const result = stage2Penalties(client, program);
    // industry(-10) + revenue(-5) + employee(-5) = 20
    expect(result.totalPenalty).toBe(20);
    expect(result.penalties).toHaveLength(3);
  });
});

import { describe, it, expect } from "vitest";
import { stage1Disqualify } from "../../src/stages/stage1-disqualify.js";
import type { ClientProfile, ProgramProfile } from "../../src/types.js";

const baseClient: ClientProfile = {
  id: "client-1",
  name: "테스트 기업",
  industry: "IT",
  region: "서울",
  employeeCount: 50,
  certifications: [],
};

const baseProgram: ProgramProfile = {
  id: "prog-1",
  name: "테스트 프로그램",
  category: "STARTUP",
};

describe("stage1Disqualify", () => {
  it("passes when no eligibility constraints", () => {
    const result = stage1Disqualify(baseClient, baseProgram);
    expect(result.disqualified).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it("disqualifies on region mismatch", () => {
    const program = { ...baseProgram, region: "부산" };
    const result = stage1Disqualify(baseClient, program);
    expect(result.disqualified).toBe(true);
    expect(result.reasons[0]).toMatch(/지역 불일치/);
  });

  it("passes when regions match", () => {
    const program = { ...baseProgram, region: "서울" };
    const result = stage1Disqualify(baseClient, program);
    expect(result.disqualified).toBe(false);
  });

  it("passes when program has region but client has no region (unknown)", () => {
    const client = { ...baseClient, region: undefined };
    const program = { ...baseProgram, region: "서울" };
    // No region on client — cannot confirm mismatch, so don't disqualify
    const result = stage1Disqualify(client, program);
    expect(result.disqualified).toBe(false);
  });

  it("disqualifies on excluded industry", () => {
    const program = {
      ...baseProgram,
      eligibility: { excludedIndustries: ["IT", "금융"] },
    };
    const result = stage1Disqualify(baseClient, program);
    expect(result.disqualified).toBe(true);
    expect(result.reasons[0]).toMatch(/산업 제외/);
  });

  it("passes when industry not in excluded list", () => {
    const program = {
      ...baseProgram,
      eligibility: { excludedIndustries: ["금융", "보험"] },
    };
    const result = stage1Disqualify(baseClient, program);
    expect(result.disqualified).toBe(false);
  });

  it("disqualifies on missing required certification", () => {
    const program = {
      ...baseProgram,
      eligibility: { requiredCertifications: ["ISO9001"] },
    };
    const result = stage1Disqualify(baseClient, program);
    expect(result.disqualified).toBe(true);
    expect(result.reasons[0]).toMatch(/필수 인증 미보유/);
  });

  it("passes when required certification is present", () => {
    const client = { ...baseClient, certifications: ["ISO9001", "ISO14001"] };
    const program = {
      ...baseProgram,
      eligibility: { requiredCertifications: ["ISO9001"] },
    };
    const result = stage1Disqualify(client, program);
    expect(result.disqualified).toBe(false);
  });

  it("disqualifies when employee count below minimum", () => {
    const program = {
      ...baseProgram,
      eligibility: { minEmployees: 100 },
    };
    const result = stage1Disqualify(baseClient, program);
    expect(result.disqualified).toBe(true);
    expect(result.reasons[0]).toMatch(/임직원 수 미달/);
  });

  it("disqualifies when employee count exceeds maximum", () => {
    const program = {
      ...baseProgram,
      eligibility: { maxEmployees: 10 },
    };
    const result = stage1Disqualify(baseClient, program);
    expect(result.disqualified).toBe(true);
    expect(result.reasons[0]).toMatch(/임직원 수 초과/);
  });

  it("disqualifies venture-only program for non-venture client", () => {
    const client = { ...baseClient, isVenture: false };
    const program = {
      ...baseProgram,
      eligibility: { ventureOnly: true },
    };
    const result = stage1Disqualify(client, program);
    expect(result.disqualified).toBe(true);
    expect(result.reasons[0]).toMatch(/벤처기업 인증 필수/);
  });

  it("passes venture-only program for venture client", () => {
    const client = { ...baseClient, isVenture: true };
    const program = {
      ...baseProgram,
      eligibility: { ventureOnly: true },
    };
    const result = stage1Disqualify(client, program);
    expect(result.disqualified).toBe(false);
  });

  it("accumulates multiple disqualification reasons", () => {
    const program = {
      ...baseProgram,
      region: "부산",
      eligibility: { ventureOnly: true, minEmployees: 200 },
    };
    const client = { ...baseClient, isVenture: false };
    const result = stage1Disqualify(client, program);
    expect(result.disqualified).toBe(true);
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
  });
});

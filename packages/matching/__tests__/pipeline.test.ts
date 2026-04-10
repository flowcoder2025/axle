import { describe, it, expect } from "vitest";
import { matchClientToPrograms } from "../src/pipeline.js";
import type { ClientProfile, ProgramProfile } from "../src/types.js";

const client: ClientProfile = {
  id: "client-1",
  name: "서울 IT 기업",
  industry: "IT",
  region: "서울",
  employeeCount: 50,
  revenue: 500_000_000,
  isVenture: true,
  isInnoBiz: false,
  certifications: ["ISO9001"],
};

const programs: ProgramProfile[] = [
  {
    id: "prog-disqualified",
    name: "부산 제조업 전용",
    category: "GENERAL",
    region: "부산",
    requirements: { targetIndustries: ["제조업"] },
  },
  {
    id: "prog-low",
    name: "일반 스타트업 지원",
    category: "STARTUP",
    region: "서울",
    requirements: {},
  },
  {
    id: "prog-high",
    name: "서울 IT 벤처 지원",
    category: "VENTURE",
    region: "서울",
    requirements: {
      targetIndustries: ["IT"],
      minRevenue: 100_000_000,
      certBonuses: ["ISO9001"],
    },
  },
];

describe("matchClientToPrograms", () => {
  it("returns a result for each program", () => {
    const results = matchClientToPrograms(client, programs);
    expect(results).toHaveLength(3);
  });

  it("disqualifies program with region mismatch", () => {
    const results = matchClientToPrograms(client, programs);
    const disqualified = results.find((r) => r.programId === "prog-disqualified");
    expect(disqualified).toBeDefined();
    expect(disqualified!.isDisqualified).toBe(true);
    expect(disqualified!.score).toBe(0);
    expect(disqualified!.disqualifyReasons.length).toBeGreaterThan(0);
  });

  it("scores the highly aligned program the highest", () => {
    const results = matchClientToPrograms(client, programs);
    const highScore = results.find((r) => r.programId === "prog-high");
    const lowScore = results.find((r) => r.programId === "prog-low");
    expect(highScore!.score).toBeGreaterThan(lowScore!.score);
  });

  it("sorts results with qualified programs first, then disqualified", () => {
    const results = matchClientToPrograms(client, programs);
    const disqualifiedIndex = results.findIndex((r) => r.isDisqualified);
    const qualifiedIndices = results
      .map((r, i) => (!r.isDisqualified ? i : -1))
      .filter((i) => i >= 0);
    const maxQualifiedIndex = Math.max(...qualifiedIndices);
    expect(disqualifiedIndex).toBeGreaterThan(maxQualifiedIndex);
  });

  it("sorts qualified programs by score descending", () => {
    const results = matchClientToPrograms(client, programs);
    const qualified = results.filter((r) => !r.isDisqualified);
    for (let i = 1; i < qualified.length; i++) {
      expect(qualified[i - 1]!.score).toBeGreaterThanOrEqual(qualified[i]!.score);
    }
  });

  it("clamps score to 0 when penalties exceed raw score", () => {
    const weakClient: ClientProfile = {
      id: "client-weak",
      name: "페널티 테스트 기업",
      revenue: 0,
      employeeCount: 1,
    };
    const heavyPenaltyProgram: ProgramProfile = {
      id: "prog-heavy",
      name: "강한 페널티 프로그램",
      category: "STARTUP",
      requirements: {
        targetIndustries: ["제조업"],
        targetMinEmployees: 500,
      },
    };
    const [result] = matchClientToPrograms(weakClient, [heavyPenaltyProgram]);
    expect(result!.score).toBeGreaterThanOrEqual(0);
  });

  it("returns empty array for empty programs list", () => {
    const results = matchClientToPrograms(client, []);
    expect(results).toHaveLength(0);
  });

  it("includes matchReasons for qualified high-scoring programs", () => {
    const results = matchClientToPrograms(client, programs);
    const high = results.find((r) => r.programId === "prog-high");
    expect(high!.matchReasons.length).toBeGreaterThan(0);
  });
});

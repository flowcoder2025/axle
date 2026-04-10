import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before imports
// ---------------------------------------------------------------------------

const { mockClient, mockProgramInfo } = vi.hoisted(() => {
  const mockClient = { findUnique: vi.fn() };
  const mockProgramInfo = { findUnique: vi.fn() };
  return { mockClient, mockProgramInfo };
});

vi.mock("@axle/db", () => ({
  prisma: {
    client: mockClient,
    programInfo: mockProgramInfo,
  },
}));

vi.mock("../../src/rag/index.js", () => ({
  semanticSearch: vi.fn().mockResolvedValue([]),
}));

import { analyzeGaps } from "../../src/diagnosis/gap-analyzer.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClient(overrides: Partial<ReturnType<typeof baseClient>> = {}) {
  return { ...baseClient(), ...overrides };
}

function baseClient() {
  return {
    id: "client-1",
    name: "테스트 기업",
    industry: "IT",
    isVenture: false,
    isInnoBiz: false,
    isMainBiz: false,
    isSocial: false,
    ventureValidUntil: null,
    employeeCount: 10,
    capitalAmount: null,
    foundedDate: null,
    region: null,
    masterProfile: null,
    financials: [
      {
        year: 2023,
        revenue: { toNumber: () => 500_000_000 },
        operatingProfit: { toNumber: () => 50_000_000 },
        netProfit: { toNumber: () => 30_000_000 },
        totalAssets: { toNumber: () => 200_000_000 },
        totalLiabilities: { toNumber: () => 80_000_000 },
        totalEquity: { toNumber: () => 120_000_000 },
        creditRating: null,
      },
    ],
    certificates: [],
    documents: [],
  };
}

function baseProgram(overrides: object = {}) {
  return {
    id: "prog-1",
    name: "테스트 지원사업",
    agency: "중소벤처기업부",
    category: "STARTUP",
    requirements: null,
    eligibility: null,
    maxFunding: null,
    region: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("analyzeGaps — no requirements", () => {
  it("returns zero gaps and full readiness when no requirements defined", async () => {
    mockClient.findUnique.mockResolvedValue(makeClient());
    mockProgramInfo.findUnique.mockResolvedValue(baseProgram());

    const result = await analyzeGaps({ clientId: "client-1", programId: "prog-1" });

    expect(result.gaps).toHaveLength(0);
    expect(result.readiness).toBe(100);
    expect(result.summary).toContain("모두 충족");
  });
});

describe("analyzeGaps — document gaps", () => {
  it("detects missing required documents", async () => {
    mockClient.findUnique.mockResolvedValue(makeClient({ documents: [] }));
    mockProgramInfo.findUnique.mockResolvedValue(
      baseProgram({
        requirements: { requiredDocuments: ["사업계획서", "재무제표"] },
      })
    );

    const result = await analyzeGaps({ clientId: "client-1", programId: "prog-1" });

    const docGaps = result.gaps.filter((g) => g.category === "서류");
    expect(docGaps).toHaveLength(2);
    expect(docGaps[0].severity).toBe("critical");
    expect(docGaps[0].item).toBe("사업계획서");
  });

  it("does not flag a document the client already has", async () => {
    mockClient.findUnique.mockResolvedValue(
      makeClient({
        documents: [{ category: "사업계획서", name: "plan.pdf" }],
      })
    );
    mockProgramInfo.findUnique.mockResolvedValue(
      baseProgram({
        requirements: { requiredDocuments: ["사업계획서"] },
      })
    );

    const result = await analyzeGaps({ clientId: "client-1", programId: "prog-1" });

    expect(result.gaps.filter((g) => g.category === "서류")).toHaveLength(0);
  });
});

describe("analyzeGaps — certification gaps", () => {
  it("flags missing required certification", async () => {
    mockClient.findUnique.mockResolvedValue(makeClient({ certificates: [] }));
    mockProgramInfo.findUnique.mockResolvedValue(
      baseProgram({
        eligibility: { requiredCertifications: ["ISO9001"] },
      })
    );

    const result = await analyzeGaps({ clientId: "client-1", programId: "prog-1" });

    const certGaps = result.gaps.filter((g) => g.category === "자격");
    expect(certGaps).toHaveLength(1);
    expect(certGaps[0].item).toBe("ISO9001");
  });

  it("does not flag a certification the client holds", async () => {
    const future = new Date(Date.now() + 86_400_000); // tomorrow
    mockClient.findUnique.mockResolvedValue(
      makeClient({
        certificates: [{ type: "ISO9001", validTo: future, isActive: true }],
      })
    );
    mockProgramInfo.findUnique.mockResolvedValue(
      baseProgram({
        eligibility: { requiredCertifications: ["ISO9001"] },
      })
    );

    const result = await analyzeGaps({ clientId: "client-1", programId: "prog-1" });

    expect(result.gaps.filter((g) => g.category === "자격")).toHaveLength(0);
  });
});

describe("analyzeGaps — financial gaps", () => {
  it("detects missing financial data", async () => {
    mockClient.findUnique.mockResolvedValue(makeClient({ financials: [] }));
    mockProgramInfo.findUnique.mockResolvedValue(baseProgram());

    const result = await analyzeGaps({ clientId: "client-1", programId: "prog-1" });

    const finGaps = result.gaps.filter((g) => g.category === "재무");
    expect(finGaps).toHaveLength(1);
    expect(finGaps[0].item).toBe("재무 데이터 없음");
    expect(finGaps[0].severity).toBe("major");
  });

  it("detects revenue below minimum", async () => {
    mockClient.findUnique.mockResolvedValue(makeClient()); // revenue = 500M
    mockProgramInfo.findUnique.mockResolvedValue(
      baseProgram({
        eligibility: { minRevenue: 1_000_000_000 }, // 1B
      })
    );

    const result = await analyzeGaps({ clientId: "client-1", programId: "prog-1" });

    const revenueGap = result.gaps.find((g) => g.item === "매출액 미달");
    expect(revenueGap).toBeDefined();
    expect(revenueGap?.severity).toBe("major");
  });

  it("detects high debt ratio", async () => {
    mockClient.findUnique.mockResolvedValue(
      makeClient({
        financials: [
          {
            year: 2023,
            revenue: { toNumber: () => 500_000_000 },
            operatingProfit: { toNumber: () => 10_000_000 },
            netProfit: { toNumber: () => 5_000_000 },
            totalAssets: { toNumber: () => 100_000_000 },
            totalLiabilities: { toNumber: () => 90_000_000 }, // 90% debt ratio
            totalEquity: { toNumber: () => 10_000_000 },
            creditRating: null,
          },
        ],
      })
    );
    mockProgramInfo.findUnique.mockResolvedValue(
      baseProgram({ eligibility: { maxDebtRatio: 0.5 } })
    );

    const result = await analyzeGaps({ clientId: "client-1", programId: "prog-1" });

    expect(result.gaps.find((g) => g.item === "부채비율 초과")).toBeDefined();
  });
});

describe("analyzeGaps — technical gaps", () => {
  it("flags missing venture certification when required", async () => {
    mockClient.findUnique.mockResolvedValue(makeClient({ isVenture: false }));
    mockProgramInfo.findUnique.mockResolvedValue(
      baseProgram({ eligibility: { requireVenture: true } })
    );

    const result = await analyzeGaps({ clientId: "client-1", programId: "prog-1" });

    const gap = result.gaps.find((g) => g.item === "벤처기업 인증 필요");
    expect(gap).toBeDefined();
    expect(gap?.severity).toBe("critical");
  });

  it("does not flag venture gap when client is venture", async () => {
    mockClient.findUnique.mockResolvedValue(makeClient({ isVenture: true }));
    mockProgramInfo.findUnique.mockResolvedValue(
      baseProgram({ eligibility: { requireVenture: true } })
    );

    const result = await analyzeGaps({ clientId: "client-1", programId: "prog-1" });

    expect(result.gaps.find((g) => g.item === "벤처기업 인증 필요")).toBeUndefined();
  });

  it("flags insufficient employee count", async () => {
    mockClient.findUnique.mockResolvedValue(makeClient({ employeeCount: 3 }));
    mockProgramInfo.findUnique.mockResolvedValue(
      baseProgram({ eligibility: { minEmployees: 10 } })
    );

    const result = await analyzeGaps({ clientId: "client-1", programId: "prog-1" });

    expect(result.gaps.find((g) => g.item === "고용 인원 미달")).toBeDefined();
  });
});

describe("analyzeGaps — readiness scoring", () => {
  it("reduces readiness proportionally to gap severity", async () => {
    mockClient.findUnique.mockResolvedValue(
      makeClient({ documents: [], financials: [], isVenture: false })
    );
    mockProgramInfo.findUnique.mockResolvedValue(
      baseProgram({
        requirements: { requiredDocuments: ["사업계획서"] },
        eligibility: { requireVenture: true },
      })
    );

    const result = await analyzeGaps({ clientId: "client-1", programId: "prog-1" });

    // 2 critical (doc + venture) = -40, 1 major (no financials) = -10 → 50
    expect(result.readiness).toBe(50);
    expect(result.readiness).toBeGreaterThanOrEqual(0);
    expect(result.readiness).toBeLessThan(100);
  });

  it("clamps readiness to 0 for many critical gaps", async () => {
    mockClient.findUnique.mockResolvedValue(
      makeClient({
        documents: [],
        financials: [],
        isVenture: false,
        isInnoBiz: false,
        employeeCount: 0,
        certificates: [],
      })
    );
    mockProgramInfo.findUnique.mockResolvedValue(
      baseProgram({
        requirements: { requiredDocuments: ["a", "b", "c", "d", "e", "f"] },
        eligibility: {
          requireVenture: true,
          requireInnoBiz: true,
          minEmployees: 20,
          requiredCertifications: ["X"],
        },
      })
    );

    const result = await analyzeGaps({ clientId: "client-1", programId: "prog-1" });

    expect(result.readiness).toBe(0);
  });
});

describe("analyzeGaps — not found cases", () => {
  it("returns critical gap when client not found", async () => {
    mockClient.findUnique.mockResolvedValue(null);
    mockProgramInfo.findUnique.mockResolvedValue(baseProgram());

    const result = await analyzeGaps({ clientId: "missing", programId: "prog-1" });

    expect(result.readiness).toBe(0);
    expect(result.gaps[0].item).toBe("클라이언트 없음");
  });

  it("returns critical gap when program not found", async () => {
    mockClient.findUnique.mockResolvedValue(makeClient());
    mockProgramInfo.findUnique.mockResolvedValue(null);

    const result = await analyzeGaps({ clientId: "client-1", programId: "missing" });

    expect(result.readiness).toBe(0);
    expect(result.gaps[0].item).toBe("프로그램 없음");
  });
});

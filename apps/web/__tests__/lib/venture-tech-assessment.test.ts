/**
 * WI-302: Venture Tech Assessment auto-fill pipeline tests.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockClientFindUnique } = vi.hoisted(() => ({
  mockClientFindUnique: vi.fn(),
}));

vi.mock("@axle/db", () => ({
  DB_PACKAGE: "@axle/db",
  prisma: {
    client: { findUnique: mockClientFindUnique },
  },
}));

import { buildVentureTechAssessmentInput } from "@/lib/services/venture-tech-assessment";

beforeEach(() => {
  mockClientFindUnique.mockReset();
});

function makeClient(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "client-1",
    name: "주식회사 제이이티",
    ceoName: "김희수",
    businessNumber: "123-45-67890",
    foundedDate: new Date("2022-03-15T00:00:00Z"),
    address: "서울 강남구 테헤란로 1",
    capitalAmount: "100000000",
    employeeCount: 9,
    masterProfile: null,
    financials: [
      { year: 2024, revenue: "500000000", operatingProfit: "50000000", netProfit: "40000000" },
      { year: 2023, revenue: "200000000", operatingProfit: "5000000", netProfit: "3000000" },
      { year: 2022, revenue: "50000000", operatingProfit: "-10000000", netProfit: "-12000000" },
    ],
    achievements: [
      { type: "PATENT", title: "P1" },
      { type: "PATENT", title: "P2" },
      { type: "AWARD", title: "A1" },
      { type: "INVESTMENT", title: "I1" },
    ],
    ...over,
  };
}

describe("buildVentureTechAssessmentInput", () => {
  it("maps all companyInfo columns from Client", async () => {
    mockClientFindUnique.mockResolvedValueOnce(makeClient());
    const input = await buildVentureTechAssessmentInput("client-1");

    expect(input.companyInfo).toEqual({
      companyName: "주식회사 제이이티",
      ceoName: "김희수",
      businessNumber: "123-45-67890",
      foundedDate: "2022-03-15",
      address: "서울 강남구 테헤란로 1",
      capitalAmount: 100_000_000,
    });
  });

  it("converts Decimal-like fields to plain numbers", async () => {
    mockClientFindUnique.mockResolvedValueOnce(makeClient({ capitalAmount: "250000000" }));
    const input = await buildVentureTechAssessmentInput("client-1");
    expect(input.companyInfo.capitalAmount).toBe(250_000_000);
    expect(typeof input.finance![0].revenue).toBe("number");
  });

  it("sorts finance years ascending regardless of DB order", async () => {
    mockClientFindUnique.mockResolvedValueOnce(makeClient());
    const input = await buildVentureTechAssessmentInput("client-1");
    expect(input.finance!.map((f) => f.year)).toEqual([2022, 2023, 2024]);
  });

  it("counts PATENT-type achievements into intellectualProperty.patents", async () => {
    mockClientFindUnique.mockResolvedValueOnce(makeClient());
    const input = await buildVentureTechAssessmentInput("client-1");
    expect(input.intellectualProperty!.patents).toBe(2);
  });

  it("falls back to most-recent revenue for domesticSales when editor did not override", async () => {
    mockClientFindUnique.mockResolvedValueOnce(makeClient());
    const input = await buildVentureTechAssessmentInput("client-1");
    expect(input.achievements!.domesticSales).toBe(500_000_000);
  });

  it("respects masterProfile.venture overrides for sections, checks, achievements, ip", async () => {
    mockClientFindUnique.mockResolvedValueOnce(
      makeClient({
        masterProfile: {
          // Sibling field owned by the org chart feature — must be ignored here.
          organizationChart: { departments: [] },
          venture: {
            sections: {
              background: "사용자 입력 본문",
              solution: "두 번째 섹션",
            },
            checks: {
              problemImportance: ["많은 사람들이 겪고 있는 문제임"],
              fundingSources: ["자본금", "정부지원(R&D 지원)"],
            },
            achievements: { domesticSales: 999_000_000, exports: 100_000_000 },
            ip: { patents: 99, trademarks: 5, designs: 2, softwareCopyrights: 7 },
          },
        },
      }),
    );

    const input = await buildVentureTechAssessmentInput("client-1");
    expect(input.sections).toEqual({
      background: "사용자 입력 본문",
      solution: "두 번째 섹션",
    });
    expect(input.checks).toEqual({
      problemImportance: ["많은 사람들이 겪고 있는 문제임"],
      fundingSources: ["자본금", "정부지원(R&D 지원)"],
    });
    expect(input.achievements!.domesticSales).toBe(999_000_000);
    expect(input.achievements!.exports).toBe(100_000_000);
    // Editor override wins over PATENT count
    expect(input.intellectualProperty!.patents).toBe(99);
    expect(input.intellectualProperty!.trademarks).toBe(5);
    expect(input.intellectualProperty!.designs).toBe(2);
    expect(input.intellectualProperty!.softwareCopyrights).toBe(7);
  });

  it("returns empty sections/checks when masterProfile.venture is missing", async () => {
    mockClientFindUnique.mockResolvedValueOnce(makeClient({ masterProfile: null }));
    const input = await buildVentureTechAssessmentInput("client-1");
    expect(input.sections).toEqual({});
    expect(input.checks).toEqual({});
  });

  it("treats malformed masterProfile (non-object / missing venture key) as empty", async () => {
    mockClientFindUnique.mockResolvedValueOnce(
      makeClient({ masterProfile: { businessInfo: { name: "x" } /* no venture */ } }),
    );
    const input = await buildVentureTechAssessmentInput("client-1");
    expect(input.sections).toEqual({});
    expect(input.checks).toEqual({});
  });

  it("uses '' for ceoName when null so the generator surfaces the missing-CEO error", async () => {
    mockClientFindUnique.mockResolvedValueOnce(makeClient({ ceoName: null }));
    const input = await buildVentureTechAssessmentInput("client-1");
    expect(input.companyInfo.ceoName).toBe("");
  });

  it("omits foundedDate / businessNumber / address / capitalAmount when null", async () => {
    mockClientFindUnique.mockResolvedValueOnce(
      makeClient({
        foundedDate: null,
        businessNumber: null,
        address: null,
        capitalAmount: null,
        employeeCount: null,
      }),
    );
    const input = await buildVentureTechAssessmentInput("client-1");
    expect(input.companyInfo.foundedDate).toBeUndefined();
    expect(input.companyInfo.businessNumber).toBeUndefined();
    expect(input.companyInfo.address).toBeUndefined();
    expect(input.companyInfo.capitalAmount).toBeUndefined();
    expect(input.achievements!.employeeCount).toBeUndefined();
  });

  it("returns empty finance array when client has no financial records", async () => {
    mockClientFindUnique.mockResolvedValueOnce(makeClient({ financials: [] }));
    const input = await buildVentureTechAssessmentInput("client-1");
    expect(input.finance).toEqual([]);
    expect(input.achievements!.domesticSales).toBeUndefined();
  });

  it("returns 0 patents when client has no PATENT achievements", async () => {
    mockClientFindUnique.mockResolvedValueOnce(
      makeClient({ achievements: [{ type: "AWARD", title: "x" }] }),
    );
    const input = await buildVentureTechAssessmentInput("client-1");
    expect(input.intellectualProperty!.patents).toBe(0);
  });

  it("throws when the client does not exist", async () => {
    mockClientFindUnique.mockResolvedValueOnce(null);
    await expect(buildVentureTechAssessmentInput("missing")).rejects.toThrow(
      /Client not found/,
    );
  });

  it("requests only the most recent 3 financial years from the database", async () => {
    mockClientFindUnique.mockResolvedValueOnce(makeClient());
    await buildVentureTechAssessmentInput("client-1");
    const args = mockClientFindUnique.mock.calls[0][0];
    expect(args.where).toEqual({ id: "client-1" });
    expect(args.include.financials).toEqual({
      orderBy: { year: "desc" },
      take: 3,
    });
  });
});

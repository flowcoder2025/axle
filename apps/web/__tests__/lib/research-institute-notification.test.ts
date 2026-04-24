/**
 * WI-311: Research Institute Notification auto-fill pipeline tests.
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

import { buildResearchInstituteNotificationInput } from "@/lib/services/research-institute-notification";

beforeEach(() => {
  mockClientFindUnique.mockReset();
});

function makeClient(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "client-1",
    name: "주식회사 제이이티",
    ceoName: "김희수",
    businessNumber: "123-45-67890",
    foundedDate: new Date("2015-03-15T00:00:00Z"),
    address: "서울 강남구 테헤란로 1",
    masterProfile: null,
    ...over,
  };
}

describe("buildResearchInstituteNotificationInput", () => {
  it("maps companyInfo base fields from Client columns", async () => {
    mockClientFindUnique.mockResolvedValueOnce(makeClient());
    const input = await buildResearchInstituteNotificationInput("client-1");

    expect(input.companyInfo.companyName).toBe("주식회사 제이이티");
    expect(input.companyInfo.ceoName).toBe("김희수");
    expect(input.companyInfo.businessNumber).toBe("123-45-67890");
    expect(input.companyInfo.foundedDate).toBe("2015-03-15");
    expect(input.companyInfo.address).toBe("서울 강남구 테헤란로 1");
  });

  it("leaves institute fields undefined when slice is empty", async () => {
    mockClientFindUnique.mockResolvedValueOnce(makeClient());
    const input = await buildResearchInstituteNotificationInput("client-1");

    expect(input.companyInfo.instituteName).toBeUndefined();
    expect(input.companyInfo.instituteAddress).toBeUndefined();
    expect(input.companyInfo.instituteAreaSqm).toBeUndefined();
    expect(input.companyInfo.instituteFoundedDate).toBeUndefined();
    expect(input.overview).toBeUndefined();
    expect(input.rdFields).toBeUndefined();
    expect(input.coreTechnologies).toBeUndefined();
    expect(input.projects).toBeUndefined();
    expect(input.researchers).toBeUndefined();
  });

  it("reads every overridable field from masterProfile.researchInstitute", async () => {
    mockClientFindUnique.mockResolvedValueOnce(
      makeClient({
        masterProfile: {
          // Sibling slices owned by other features — must be ignored here.
          organizationChart: { departments: [] },
          venture: { sections: { background: "무시되어야 함" } },
          researchInstitute: {
            instituteName: "JET 기업부설연구소",
            instituteAddress: "서울 강남구 테헤란로 1 3층",
            instituteAreaSqm: 120,
            instituteFoundedDate: "2022-03-15",
            overview: "연구소 개요 본문",
            rdFields: [
              {
                title: "자동화 장비 신규 개발 및 고도화",
                items: ["특수목적기계 설계", "서보 프레스 연구"],
              },
            ],
            coreTechnologies: [
              {
                name: "자동화 시스템 통합 설계 기술",
                descriptions: ["로봇·센서 통합"],
              },
            ],
            projects: [
              {
                name: "비전 연동 클립 조립기",
                content: "비전 기반 자율 보정",
                budget: 95_000_000,
              },
            ],
            researchers: [
              {
                name: "김희수",
                position: "연구소장",
                degree: "박사",
                specialty: "기계공학",
              },
            ],
          },
        },
      }),
    );

    const input = await buildResearchInstituteNotificationInput("client-1");

    expect(input.companyInfo.instituteName).toBe("JET 기업부설연구소");
    expect(input.companyInfo.instituteAddress).toBe(
      "서울 강남구 테헤란로 1 3층",
    );
    expect(input.companyInfo.instituteAreaSqm).toBe(120);
    expect(input.companyInfo.instituteFoundedDate).toBe("2022-03-15");
    expect(input.overview).toBe("연구소 개요 본문");
    expect(input.rdFields).toHaveLength(1);
    expect(input.rdFields![0].title).toBe("자동화 장비 신규 개발 및 고도화");
    expect(input.coreTechnologies).toHaveLength(1);
    expect(input.projects).toHaveLength(1);
    expect(input.projects![0].budget).toBe(95_000_000);
    expect(input.researchers).toHaveLength(1);
    expect(input.researchers![0].name).toBe("김희수");
  });

  it("treats masterProfile with a non-object value as empty", async () => {
    mockClientFindUnique.mockResolvedValueOnce(
      makeClient({ masterProfile: "garbage" }),
    );
    const input = await buildResearchInstituteNotificationInput("client-1");
    expect(input.overview).toBeUndefined();
    expect(input.rdFields).toBeUndefined();
  });

  it("ignores malformed researchInstitute value (non-object)", async () => {
    mockClientFindUnique.mockResolvedValueOnce(
      makeClient({ masterProfile: { researchInstitute: "not-an-object" } }),
    );
    const input = await buildResearchInstituteNotificationInput("client-1");
    expect(input.overview).toBeUndefined();
    expect(input.rdFields).toBeUndefined();
  });

  it("treats `instituteAreaSqm: null` as explicitly empty (three-way signal)", async () => {
    mockClientFindUnique.mockResolvedValueOnce(
      makeClient({
        masterProfile: { researchInstitute: { instituteAreaSqm: null } },
      }),
    );
    const input = await buildResearchInstituteNotificationInput("client-1");
    expect(input.companyInfo.instituteAreaSqm).toBeUndefined();
  });

  it("uses '' for ceoName when null so the generator surfaces the missing-CEO error", async () => {
    mockClientFindUnique.mockResolvedValueOnce(makeClient({ ceoName: null }));
    const input = await buildResearchInstituteNotificationInput("client-1");
    expect(input.companyInfo.ceoName).toBe("");
  });

  it("omits foundedDate / businessNumber / address when null on Client", async () => {
    mockClientFindUnique.mockResolvedValueOnce(
      makeClient({
        foundedDate: null,
        businessNumber: null,
        address: null,
      }),
    );
    const input = await buildResearchInstituteNotificationInput("client-1");
    expect(input.companyInfo.foundedDate).toBeUndefined();
    expect(input.companyInfo.businessNumber).toBeUndefined();
    expect(input.companyInfo.address).toBeUndefined();
  });

  it("throws when the client does not exist", async () => {
    mockClientFindUnique.mockResolvedValueOnce(null);
    await expect(
      buildResearchInstituteNotificationInput("missing"),
    ).rejects.toThrow(/Client not found/);
  });
});

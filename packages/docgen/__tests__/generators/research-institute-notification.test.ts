import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  generateResearchInstituteNotificationDocx,
  type ResearchInstituteNotificationInput,
} from "../../src/generators/research-institute-notification.js";

const baseInput: ResearchInstituteNotificationInput = {
  companyInfo: {
    companyName: "주식회사 제이이티",
    ceoName: "김희수",
    foundedDate: "2015-03-15",
    businessNumber: "123-45-67890",
    address: "서울 강남구 테헤란로 1",
    instituteName: "JET 기업부설연구소",
    instituteAddress: "서울 강남구 테헤란로 1 3층",
    instituteAreaSqm: 120,
    instituteFoundedDate: "2022-03-15",
  },
  overview:
    "JET 기업부설연구소는 자동차 부품 산업을 중심으로 한 특수목적기계(조립기, 검사기) 개발과 자동화 시스템 설계를 선도하는 연구개발 조직입니다.",
  rdFields: [
    {
      title: "자동화 장비 신규 개발 및 고도화",
      items: [
        "자동차 부품 조립 및 검사를 위한 특수목적기계 설계 및 신규 개발",
        "로봇 클립 조립기, 글라스런 조립 검사기 등 기존 장비의 성능 개선",
        "서보 프레스의 정밀 압력 및 위치 제어 기술 연구",
      ],
    },
    {
      title: "생산 공정 최적화 및 품질 관리",
      items: [
        "자체 2차 가공 및 조립 공정의 최적화를 통한 생산성 향상 연구",
        "개발 장비의 품질 안정성을 확보하고 고객사 라인 적용을 위한 기술 지원",
      ],
    },
  ],
  coreTechnologies: [
    {
      name: "자동화 시스템 통합 설계 기술",
      descriptions: [
        "로봇, 컨베이어, 센서 등 다양한 요소를 통합하여 특정 공정을 자동화하는 시스템 설계 기술",
        "고객사의 생산 라인 환경에 최적화된 맞춤형 특수 장비 제작 기술",
      ],
    },
    {
      name: "정밀 조립 및 머신비전 검사 기술",
      descriptions: [
        "자동차 정밀 부품의 자동 조립 메커니즘 설계 및 구현 기술",
        "머신 비전 시스템을 활용한 조립 부품 형상·체결 검사 기술",
      ],
    },
  ],
  projects: [
    {
      name: "비전 시스템 연동 고속 로봇 클립 조립기 개발",
      content:
        "비전 시스템으로 클립의 위치와 방향을 실시간으로 인식하여 로봇이 스스로 보정하며 조립하는 지능형 고속 조립기를 개발합니다.",
      budget: 95_000_000,
    },
    {
      name: "AI 딥러닝 기반 자동차 부품 외관 검사 시스템 고도화",
      content:
        "기존 비전 검사 기술에 AI 딥러닝 알고리즘을 적용하여 미세 스크래치, 이물질 등 비정형적 불량 검출률을 향상시키는 기술을 연구합니다.",
      budget: 120_000_000,
    },
    {
      name: "IoT 기반 실시간 모니터링 스마트 서보 프레스 개발",
      content:
        "서보 프레스에 IoT 센서를 탑재하여 압력, 온도, 진동 등을 실시간 모니터링하고 예지보전이 가능한 솔루션을 개발합니다.",
      budget: 80_000_000,
    },
  ],
  researchers: [
    { name: "김희수", position: "연구소장", degree: "박사", specialty: "기계공학" },
    { name: "박지훈", position: "책임연구원", degree: "석사", specialty: "로보틱스" },
    { name: "이수민", position: "선임연구원", degree: "석사", specialty: "머신비전" },
  ],
};

async function readDocumentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("word/document.xml missing from DOCX");
  return entry.async("string");
}

describe("generateResearchInstituteNotificationDocx", () => {
  it("returns a DOCX buffer + KOITA filename containing company name", async () => {
    const { docxBuffer, fileName } =
      await generateResearchInstituteNotificationDocx(baseInput);
    expect(docxBuffer).toBeInstanceOf(Buffer);
    expect(docxBuffer.byteLength).toBeGreaterThan(2000);
    expect(fileName).toContain("주식회사 제이이티");
    expect(fileName).toMatch(/연구소설립신고서\.docx$/);
  });

  it("renders the cover with company + institute details", async () => {
    const { docxBuffer } = await generateResearchInstituteNotificationDocx(baseInput);
    const xml = await readDocumentXml(docxBuffer);
    expect(xml).toContain("주식회사 제이이티");
    expect(xml).toContain("김희수");
    expect(xml).toContain("123-45-67890");
    expect(xml).toContain("JET 기업부설연구소");
    // Area is rendered with thin-space separator: "120 ㎡"
    expect(xml).toContain("120");
    expect(xml).toContain("㎡");
    expect(xml).toContain("2022-03-15");
  });

  it("defaults the institute name to '{company} 기업부설연구소'", async () => {
    const { docxBuffer } = await generateResearchInstituteNotificationDocx({
      ...baseInput,
      companyInfo: { ...baseInput.companyInfo, instituteName: undefined },
    });
    const xml = await readDocumentXml(docxBuffer);
    expect(xml).toContain("주식회사 제이이티 기업부설연구소");
  });

  it("renders overview prose across paragraph breaks", async () => {
    const { docxBuffer } = await generateResearchInstituteNotificationDocx({
      ...baseInput,
      overview: "첫 번째 문단.\n\n두 번째 문단.",
    });
    const xml = await readDocumentXml(docxBuffer);
    expect(xml).toContain("첫 번째 문단.");
    expect(xml).toContain("두 번째 문단.");
  });

  it("uses '(미작성)' placeholder when overview is missing", async () => {
    const { docxBuffer } = await generateResearchInstituteNotificationDocx({
      ...baseInput,
      overview: undefined,
    });
    const xml = await readDocumentXml(docxBuffer);
    expect(xml).toContain("1. 연구소 개요");
    expect(xml).toContain("(미작성)");
  });

  it("renders every R&D field title and its bullet items", async () => {
    const { docxBuffer } = await generateResearchInstituteNotificationDocx(baseInput);
    const xml = await readDocumentXml(docxBuffer);
    expect(xml).toContain("자동화 장비 신규 개발 및 고도화");
    expect(xml).toContain("생산 공정 최적화 및 품질 관리");
    expect(xml).toContain("서보 프레스의 정밀 압력");
    expect(xml).toContain("자체 2차 가공");
  });

  it("renders core technologies with numbered headings", async () => {
    const { docxBuffer } = await generateResearchInstituteNotificationDocx(baseInput);
    const xml = await readDocumentXml(docxBuffer);
    expect(xml).toContain("1. 자동화 시스템 통합 설계 기술");
    expect(xml).toContain("2. 정밀 조립 및 머신비전 검사 기술");
    expect(xml).toContain("로봇, 컨베이어, 센서");
  });

  it("renders projects table with budget total row", async () => {
    const { docxBuffer } = await generateResearchInstituteNotificationDocx(baseInput);
    const xml = await readDocumentXml(docxBuffer);
    expect(xml).toContain("비전 시스템 연동 고속 로봇 클립 조립기 개발");
    expect(xml).toContain("AI 딥러닝");
    expect(xml).toContain("95,000,000");
    expect(xml).toContain("120,000,000");
    expect(xml).toContain("총계");
    // 95 + 120 + 80 = 295M
    expect(xml).toContain("295,000,000");
  });

  it("omits the projects total row when no budgets supplied", async () => {
    const { docxBuffer } = await generateResearchInstituteNotificationDocx({
      ...baseInput,
      projects: [
        { name: "과제 1", content: "내용" },
        { name: "과제 2", content: "내용" },
      ],
    });
    const xml = await readDocumentXml(docxBuffer);
    expect(xml).toContain("과제 1");
    expect(xml).not.toContain("총계");
  });

  it("renders researchers appendix only when supplied", async () => {
    const withResearchers = await generateResearchInstituteNotificationDocx(baseInput);
    const withoutResearchers = await generateResearchInstituteNotificationDocx({
      ...baseInput,
      researchers: undefined,
    });

    const xmlWith = await readDocumentXml(withResearchers.docxBuffer);
    const xmlWithout = await readDocumentXml(withoutResearchers.docxBuffer);

    expect(xmlWith).toContain("부록. 연구원 현황");
    expect(xmlWith).toContain("김희수");
    expect(xmlWith).toContain("책임연구원");
    expect(xmlWithout).not.toContain("부록. 연구원 현황");
  });

  it("shows a friendly placeholder when rdFields is empty", async () => {
    const { docxBuffer } = await generateResearchInstituteNotificationDocx({
      ...baseInput,
      rdFields: [],
    });
    const xml = await readDocumentXml(docxBuffer);
    expect(xml).toContain("2. 주요 업무 및 R&amp;D 분야");
    expect(xml).toContain("(미작성)");
  });

  it("sanitizes filename of filesystem-special characters", async () => {
    const { fileName } = await generateResearchInstituteNotificationDocx({
      ...baseInput,
      companyInfo: { ...baseInput.companyInfo, companyName: "Acme/Co: *v1?" },
    });
    expect(fileName).not.toMatch(/[\\/:*?"<>|]/);
    expect(fileName).toMatch(/연구소설립신고서\.docx$/);
  });

  it("falls back to 'research-institute' when companyName is entirely reserved chars", async () => {
    const { fileName } = await generateResearchInstituteNotificationDocx({
      ...baseInput,
      companyInfo: { ...baseInput.companyInfo, companyName: "//\\\\::" },
    });
    expect(fileName).toBe("research-institute-연구소설립신고서.docx");
  });

  it("throws when companyName is missing", async () => {
    await expect(
      generateResearchInstituteNotificationDocx({
        ...baseInput,
        companyInfo: { ...baseInput.companyInfo, companyName: "" },
      }),
    ).rejects.toThrow(/companyName/);
  });

  it("throws when ceoName is missing", async () => {
    await expect(
      generateResearchInstituteNotificationDocx({
        ...baseInput,
        companyInfo: { ...baseInput.companyInfo, ceoName: "" },
      }),
    ).rejects.toThrow(/ceoName/);
  });
});

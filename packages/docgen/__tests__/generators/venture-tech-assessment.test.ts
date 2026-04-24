import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  generateVentureTechAssessmentDocx,
  PROBLEM_IMPORTANCE_OPTIONS,
  PRODUCT_DIFFERENTIATION_OPTIONS,
  FUNDING_SOURCE_OPTIONS,
  type VentureTechAssessmentInput,
} from "../../src/generators/venture-tech-assessment.js";
import { VENTURE_BUSINESS_PLAN_SECTIONS } from "../../src/types.js";

const baseInput: VentureTechAssessmentInput = {
  companyInfo: {
    companyName: "주식회사 제이이티",
    ceoName: "김희수",
    foundedDate: "2022-03-15",
    businessNumber: "123-45-67890",
    address: "서울 강남구 테헤란로 1",
    capitalAmount: 100_000_000,
  },
  sections: {
    background: "기존 시장에서 사용자들이 반복적으로 겪고 있는 불편을 해결하기 위해 본 솔루션을 개발했다.",
    solution: "AI 기반 자동화 엔진과 사용자 친화적 UI를 통해 기존 대비 처리 시간을 50% 단축한다.",
    tech_progress: "2022년 PoC 완료, 2023년 베타 출시, 2024년 누적 가입자 5천명 확보.",
    tech_roadmap: "2025: 모델 고도화, 2026: 해외 확장, 2027: 차세대 플랫폼 출시.",
    team: "대표 외 핵심 인력 8명 (개발 5, 영업 2, 운영 1) 구성.",
    market: "TAM 1.2조원, SAM 3000억원, SOM 300억원 규모 추정.",
    competitors: "주요 경쟁사 3개사 분석 결과 자사가 가격·UX에서 우위.",
    go_to_market: "직접 영업 + 채널 파트너십 + 온라인 마케팅 3-track 전략.",
    finance: "자본금 1억 + 정부지원 5천만 + Pre-A 라운드 5억 조달 계획.",
  },
  checks: {
    problemImportance: ["많은 사람들이 겪고 있는 문제임", "시급히 해결되어야 하는 문제임"],
    productDifferentiation: ["기존제품대비 고성능", "기존 제품 대비 편리함"],
    fundingSources: ["자본금", "정부지원(R&D 지원)", "투자(VC)"],
  },
  finance: [
    { year: 2022, revenue: 50_000_000, operatingProfit: -10_000_000, netProfit: -12_000_000 },
    { year: 2023, revenue: 200_000_000, operatingProfit: 5_000_000, netProfit: 3_000_000 },
    { year: 2024, revenue: 500_000_000, operatingProfit: 50_000_000, netProfit: 40_000_000 },
  ],
  achievements: {
    domesticSales: 700_000_000,
    exports: 50_000_000,
    employeeCount: 9,
  },
  intellectualProperty: {
    patents: 2,
    trademarks: 3,
    designs: 1,
    softwareCopyrights: 4,
  },
};

async function readDocumentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("word/document.xml missing from DOCX");
  return entry.async("string");
}

describe("generateVentureTechAssessmentDocx", () => {
  it("returns a DOCX buffer + filename containing company name", async () => {
    const { docxBuffer, fileName } = await generateVentureTechAssessmentDocx(baseInput);
    expect(docxBuffer).toBeInstanceOf(Buffer);
    expect(docxBuffer.byteLength).toBeGreaterThan(2000);
    expect(fileName).toContain("주식회사 제이이티");
    expect(fileName).toMatch(/기술성평가서\.docx$/);
  });

  it("renders the cover with company name, CEO, business number and capital", async () => {
    const { docxBuffer } = await generateVentureTechAssessmentDocx(baseInput);
    const xml = await readDocumentXml(docxBuffer);
    expect(xml).toContain("주식회사 제이이티");
    expect(xml).toContain("김희수");
    expect(xml).toContain("123-45-67890");
    expect(xml).toContain("100,000,000");
  });

  it("renders all 9 SSOT section titles", async () => {
    const { docxBuffer } = await generateVentureTechAssessmentDocx(baseInput);
    const xml = await readDocumentXml(docxBuffer);
    for (const section of VENTURE_BUSINESS_PLAN_SECTIONS) {
      expect(xml).toContain(section.title);
    }
  });

  it("renders the body text of every supplied section", async () => {
    const { docxBuffer } = await generateVentureTechAssessmentDocx(baseInput);
    const xml = await readDocumentXml(docxBuffer);
    expect(xml).toContain("AI 기반 자동화 엔진");
    expect(xml).toContain("TAM 1.2조원");
    expect(xml).toContain("Pre-A 라운드");
  });

  it("uses '(미작성)' placeholder for sections that were not supplied", async () => {
    const { docxBuffer } = await generateVentureTechAssessmentDocx({
      ...baseInput,
      sections: { background: "본문만 한 섹션 작성" },
    });
    const xml = await readDocumentXml(docxBuffer);
    // background 본문은 그대로
    expect(xml).toContain("본문만 한 섹션 작성");
    // 나머지 섹션은 placeholder
    const placeholderCount = (xml.match(/\(미작성\)/g) ?? []).length;
    expect(placeholderCount).toBeGreaterThanOrEqual(8);
  });

  it("renders checked vs unchecked options for problem importance, differentiation, funding", async () => {
    const { docxBuffer } = await generateVentureTechAssessmentDocx(baseInput);
    const xml = await readDocumentXml(docxBuffer);
    // checked label + unchecked option both appear
    expect(xml).toContain("많은 사람들이 겪고 있는 문제임");
    expect(xml).toContain("자주 발생하는 문제임"); // unchecked
    expect(xml).toContain("기존제품대비 고성능");
    // The label "정부지원(R&D 지원)" is XML-encoded in document.xml as `R&amp;D`
    expect(xml).toContain("정부지원(R&amp;D 지원)");
    // checked marker should appear
    expect(xml).toMatch(/\[v\]|☑/);
    // unchecked marker should appear
    expect(xml).toMatch(/\[ \]|☐/);
  });

  it("renders 3-year financial table with revenue/profit numbers", async () => {
    const { docxBuffer } = await generateVentureTechAssessmentDocx(baseInput);
    const xml = await readDocumentXml(docxBuffer);
    expect(xml).toContain("2022");
    expect(xml).toContain("2024");
    // 500,000,000 -> formatted as 500,000,000원
    expect(xml).toContain("500,000,000");
    expect(xml).toContain("매출");
  });

  it("renders achievements (sales, exports, employees) and IP counts", async () => {
    const { docxBuffer } = await generateVentureTechAssessmentDocx(baseInput);
    const xml = await readDocumentXml(docxBuffer);
    expect(xml).toContain("700,000,000");
    expect(xml).toContain("50,000,000");
    expect(xml).toContain("특허");
    expect(xml).toContain("상표");
  });

  it("omits optional sections (finance/achievements/IP) cleanly when not supplied", async () => {
    const { docxBuffer } = await generateVentureTechAssessmentDocx({
      ...baseInput,
      finance: undefined,
      achievements: undefined,
      intellectualProperty: undefined,
    });
    const xml = await readDocumentXml(docxBuffer);
    // Cover and main 9 sections still present
    expect(xml).toContain("주식회사 제이이티");
    expect(xml).toContain("개발 배경 및 필요성");
    // Optional appendix tables should not crash; content should not appear
    expect(xml).not.toContain("700,000,000");
  });

  it("sanitizes filename of filesystem-special characters", async () => {
    const { fileName } = await generateVentureTechAssessmentDocx({
      ...baseInput,
      companyInfo: { ...baseInput.companyInfo, companyName: "Acme/Co: *v1?" },
    });
    expect(fileName).not.toMatch(/[\\/:*?"<>|]/);
    expect(fileName).toMatch(/기술성평가서\.docx$/);
  });

  it("throws when companyName is missing", async () => {
    await expect(
      generateVentureTechAssessmentDocx({
        ...baseInput,
        companyInfo: { ...baseInput.companyInfo, companyName: "" },
      }),
    ).rejects.toThrow(/companyName/);
  });

  it("throws when ceoName is missing", async () => {
    await expect(
      generateVentureTechAssessmentDocx({
        ...baseInput,
        companyInfo: { ...baseInput.companyInfo, ceoName: "" },
      }),
    ).rejects.toThrow(/ceoName/);
  });

  it("ignores unknown check options (forward-compat)", async () => {
    const { docxBuffer } = await generateVentureTechAssessmentDocx({
      ...baseInput,
      checks: {
        problemImportance: ["많은 사람들이 겪고 있는 문제임", "존재하지않는옵션"],
      },
    });
    const xml = await readDocumentXml(docxBuffer);
    expect(xml).not.toContain("존재하지않는옵션");
    expect(xml).toContain("많은 사람들이 겪고 있는 문제임");
  });

  it("ignores unknown section ids (forward-compat)", async () => {
    const { docxBuffer } = await generateVentureTechAssessmentDocx({
      ...baseInput,
      sections: {
        ...baseInput.sections,
        unknown_section: "이 섹션은 SSOT에 없으므로 무시되어야 함",
      } as Record<string, string>,
    });
    const xml = await readDocumentXml(docxBuffer);
    expect(xml).not.toContain("이 섹션은 SSOT에 없으므로 무시되어야 함");
  });

  it("renders finance years in chronological order regardless of input order", async () => {
    const { docxBuffer } = await generateVentureTechAssessmentDocx({
      ...baseInput,
      // Strip section bodies to remove year noise so we measure only the table
      sections: {},
      finance: [
        { year: 2024, revenue: 3, operatingProfit: 0, netProfit: 0 },
        { year: 2022, revenue: 1, operatingProfit: 0, netProfit: 0 },
        { year: 2023, revenue: 2, operatingProfit: 0, netProfit: 0 },
      ],
    });
    const xml = await readDocumentXml(docxBuffer);
    const i2022 = xml.indexOf("2022");
    const i2023 = xml.indexOf("2023");
    const i2024 = xml.indexOf("2024");
    expect(i2022).toBeGreaterThan(0);
    expect(i2022).toBeLessThan(i2023);
    expect(i2023).toBeLessThan(i2024);
  });

  it("exposes the fixed option lists matching the 2024 official form", () => {
    expect(PROBLEM_IMPORTANCE_OPTIONS).toContain("많은 사람들이 겪고 있는 문제임");
    expect(PROBLEM_IMPORTANCE_OPTIONS).toContain("자주 발생하는 문제임");
    expect(PROBLEM_IMPORTANCE_OPTIONS.length).toBe(6);

    expect(PRODUCT_DIFFERENTIATION_OPTIONS).toContain("기존에 없는 제품");
    expect(PRODUCT_DIFFERENTIATION_OPTIONS).toContain("기타");
    expect(PRODUCT_DIFFERENTIATION_OPTIONS.length).toBe(6);

    expect(FUNDING_SOURCE_OPTIONS).toContain("영업이익");
    expect(FUNDING_SOURCE_OPTIONS).toContain("투자(VC)");
    expect(FUNDING_SOURCE_OPTIONS).toContain("정부지원(R&D 지원)");
    expect(FUNDING_SOURCE_OPTIONS).toContain("대출(시중은행)");
  });

  it("produces deterministic output for identical input", async () => {
    const a = await generateVentureTechAssessmentDocx(baseInput);
    const b = await generateVentureTechAssessmentDocx(baseInput);
    // DOCX zip metadata may differ on timestamps; compare the document.xml body
    const ax = await readDocumentXml(a.docxBuffer);
    const bx = await readDocumentXml(b.docxBuffer);
    expect(ax).toBe(bx);
    expect(a.fileName).toBe(b.fileName);
  });
});

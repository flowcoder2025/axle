import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { generatePatentDraftDocx, PatentDraftInput } from "../../src/generators/patent-draft.js";

const SAMPLE_INPUT: PatentDraftInput = {
  inventionTitle: "인공지능 기반 특허 명세서 자동 생성 시스템 및 방법",
  inventorName: "홍길동",
  applicantName: "플로우코더 주식회사",
  technicalField:
    "본 발명은 인공지능 기술을 이용한 특허 명세서 자동 생성에 관한 것으로, 더욱 상세하게는 대형 언어 모델을 활용하여 발명 내용을 입력받아 특허 명세서 초안을 자동으로 생성하는 시스템 및 방법에 관한 것이다.",
  backgroundArt:
    "종래의 특허 명세서 작성은 전문 변리사가 수작업으로 작성하는 방식으로 이루어져 왔다.\n이러한 방식은 많은 시간과 비용이 소요되며, 작성자의 역량에 따라 품질이 달라지는 문제점이 있었다.",
  problemToSolve:
    "본 발명이 해결하고자 하는 과제는 인공지능 기술을 이용하여 특허 명세서 초안을 자동으로 생성함으로써 특허 출원에 소요되는 시간과 비용을 절감하는 것이다.",
  solutionMeans:
    "상기 과제를 해결하기 위하여, 본 발명은 발명 정보를 입력받는 입력 모듈; 대형 언어 모델을 이용하여 특허 명세서를 생성하는 생성 모듈; 및 생성된 명세서를 출력하는 출력 모듈을 포함하는 특허 명세서 자동 생성 시스템을 제공한다.",
  effectOfInvention:
    "본 발명에 따르면, 특허 명세서 작성에 소요되는 시간을 90% 이상 단축할 수 있으며, 일관된 품질의 명세서 초안을 제공할 수 있다.",
  detailedDescription:
    "이하, 첨부된 도면을 참조하여 본 발명의 바람직한 실시예를 상세히 설명한다.\n\n본 발명의 특허 명세서 자동 생성 시스템은 입력 모듈(100), 생성 모듈(200) 및 출력 모듈(300)을 포함한다.\n\n상기 입력 모듈(100)은 사용자로부터 발명의 명칭, 기술 분야, 배경 기술 등의 발명 정보를 입력받는다.",
  claims: [
    "발명 정보를 입력받는 입력 모듈; 대형 언어 모델을 이용하여 특허 명세서 초안을 생성하는 생성 모듈; 및 상기 생성된 특허 명세서 초안을 출력 형식으로 변환하여 제공하는 출력 모듈을 포함하는, 인공지능 기반 특허 명세서 자동 생성 시스템.",
    "제1항에 있어서, 상기 생성 모듈은 특허 명세서 형식에 특화된 프롬프트 템플릿을 사용하여 상기 대형 언어 모델에 발명 정보를 입력하는 것을 특징으로 하는, 인공지능 기반 특허 명세서 자동 생성 시스템.",
    "발명 정보를 입력받는 단계; 대형 언어 모델을 이용하여 상기 발명 정보를 기반으로 특허 명세서 초안을 생성하는 단계; 및 상기 생성된 특허 명세서 초안을 출력하는 단계를 포함하는, 인공지능 기반 특허 명세서 자동 생성 방법.",
  ],
  abstractText:
    "본 발명은 인공지능 기반 특허 명세서 자동 생성 시스템 및 방법에 관한 것이다. 본 발명의 시스템은 발명 정보를 입력받는 입력 모듈, 대형 언어 모델을 이용하여 특허 명세서 초안을 생성하는 생성 모듈, 및 생성된 명세서를 출력하는 출력 모듈을 포함한다. 이를 통해 특허 명세서 작성에 소요되는 시간과 비용을 획기적으로 절감할 수 있다.",
};

describe("generatePatentDraftDocx", () => {
  it("returns a non-empty Buffer", async () => {
    const buf = await generatePatentDraftDocx(SAMPLE_INPUT);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("produces a valid DOCX (PK zip magic bytes)", async () => {
    const buf = await generatePatentDraftDocx(SAMPLE_INPUT);
    // DOCX files are ZIP archives — starts with PK\x03\x04
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });

  it("returns a buffer larger than 5 KB (has real content)", async () => {
    const buf = await generatePatentDraftDocx(SAMPLE_INPUT);
    expect(buf.length).toBeGreaterThan(5 * 1024);
  });

  it("document.xml contains 【】 bracket section headers", async () => {
    const buf = await generatePatentDraftDocx(SAMPLE_INPUT);
    const zip = await JSZip.loadAsync(buf);
    const docXmlFile = zip.file("word/document.xml");
    expect(docXmlFile).not.toBeNull();
    const xml = await docXmlFile!.async("string");

    // Korean patent standard sections must appear
    expect(xml).toContain("【발명의 명칭】");
    expect(xml).toContain("【기술 분야】");
    expect(xml).toContain("【배경 기술】");
    expect(xml).toContain("【발명의 내용】");
    expect(xml).toContain("【해결하고자 하는 과제】");
    expect(xml).toContain("【과제의 해결 수단】");
    expect(xml).toContain("【발명의 효과】");
    expect(xml).toContain("【발명을 실시하기 위한 구체적인 내용】");
    expect(xml).toContain("【청구의 범위】");
    expect(xml).toContain("【요약서】");
    expect(xml).toContain("【요약】");
  });

  it("claims are numbered starting from 1", async () => {
    const buf = await generatePatentDraftDocx(SAMPLE_INPUT);
    const zip = await JSZip.loadAsync(buf);
    const docXmlFile = zip.file("word/document.xml");
    const xml = await docXmlFile!.async("string");

    // Each claim should appear as 【청구항 N】
    for (let i = 1; i <= SAMPLE_INPUT.claims.length; i++) {
      expect(xml).toContain(`【청구항 ${i}】`);
    }
  });

  it("invention title appears in the document", async () => {
    const buf = await generatePatentDraftDocx(SAMPLE_INPUT);
    const zip = await JSZip.loadAsync(buf);
    const docXmlFile = zip.file("word/document.xml");
    const xml = await docXmlFile!.async("string");
    expect(xml).toContain(SAMPLE_INPUT.inventionTitle);
  });

  it("works with a single claim", async () => {
    const singleClaim: PatentDraftInput = {
      ...SAMPLE_INPUT,
      claims: ["단독 청구항 텍스트이다."],
    };
    const buf = await generatePatentDraftDocx(singleClaim);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);

    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("【청구항 1】");
    // 청구항 2 should NOT exist
    expect(xml).not.toContain("【청구항 2】");
  });

  it("multi-line fields are split into separate paragraphs", async () => {
    // The backgroundArt has two lines separated by \n
    // Both should appear in the document XML
    const buf = await generatePatentDraftDocx(SAMPLE_INPUT);
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("종래의 특허 명세서 작성은");
    expect(xml).toContain("이러한 방식은 많은 시간과");
  });
});

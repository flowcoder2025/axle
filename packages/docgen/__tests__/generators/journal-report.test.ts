import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  generateJournalReportDocx,
  JournalReportInput,
} from "../../src/generators/journal-report.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FULL_INPUT: JournalReportInput = {
  clientName: "주식회사 테스트연구소",
  researcherName: "홍길동",
  year: 2024,
  month: 3,
  journals: [
    {
      date: "2024-03-05",
      title: "딥러닝 모델 설계 연구",
      objectives: "ResNet 기반 분류 모델 구조 설계",
      results: "3개 레이어 구조 확정, 정확도 82% 달성",
      nextSteps: "하이퍼파라미터 튜닝 진행 예정",
      hours: 6,
    },
    {
      date: "2024-03-12",
      title: "데이터 전처리 파이프라인 구축",
      objectives: "원시 데이터 정규화 및 증강 처리",
      results: "전처리 파이프라인 완성, 처리 속도 2배 향상",
      nextSteps: "대용량 데이터셋 적용 테스트",
      hours: 8,
    },
    {
      date: "2024-03-20",
      title: "모델 학습 및 평가",
      results: "최종 정확도 91.3% 달성",
      hours: 10,
    },
  ],
};

const MINIMAL_INPUT: JournalReportInput = {
  clientName: "미래기술연구원",
  researcherName: "이순신",
  year: 2024,
  month: 1,
  journals: [],
};

// ── Helper ────────────────────────────────────────────────────────────────────

async function extractDocumentXml(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("word/document.xml not found");
  return file.async("string");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("generateJournalReportDocx", () => {
  it("returns a non-empty Buffer", async () => {
    const buf = await generateJournalReportDocx(FULL_INPUT);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("produces a valid DOCX ZIP (PK magic bytes)", async () => {
    const buf = await generateJournalReportDocx(FULL_INPUT);
    expect(buf[0]).toBe(0x50); // P
    expect(buf[1]).toBe(0x4b); // K
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });

  it("output is larger than 5 KB (has real content)", async () => {
    const buf = await generateJournalReportDocx(FULL_INPUT);
    expect(buf.length).toBeGreaterThan(5 * 1024);
  });

  it("embeds report title 연구일지 월간 보고서 in document XML", async () => {
    const buf = await generateJournalReportDocx(FULL_INPUT);
    const xml = await extractDocumentXml(buf);
    expect(xml).toContain("연구일지 월간 보고서");
  });

  it("embeds year and month in document XML", async () => {
    const buf = await generateJournalReportDocx(FULL_INPUT);
    const xml = await extractDocumentXml(buf);
    expect(xml).toContain("2024");
    expect(xml).toContain("03");
  });

  it("embeds client name in document XML", async () => {
    const buf = await generateJournalReportDocx(FULL_INPUT);
    const xml = await extractDocumentXml(buf);
    expect(xml).toContain("주식회사 테스트연구소");
  });

  it("embeds researcher name in document XML", async () => {
    const buf = await generateJournalReportDocx(FULL_INPUT);
    const xml = await extractDocumentXml(buf);
    expect(xml).toContain("홍길동");
  });

  it("embeds journal titles in document XML", async () => {
    const buf = await generateJournalReportDocx(FULL_INPUT);
    const xml = await extractDocumentXml(buf);
    expect(xml).toContain("딥러닝 모델 설계 연구");
    expect(xml).toContain("데이터 전처리 파이프라인 구축");
    expect(xml).toContain("모델 학습 및 평가");
  });

  it("embeds 연구 목표 label in document XML", async () => {
    const buf = await generateJournalReportDocx(FULL_INPUT);
    const xml = await extractDocumentXml(buf);
    expect(xml).toContain("연구 목표");
  });

  it("embeds 연구 결과 label in document XML", async () => {
    const buf = await generateJournalReportDocx(FULL_INPUT);
    const xml = await extractDocumentXml(buf);
    expect(xml).toContain("연구 결과");
  });

  it("embeds 차기 계획 label in document XML", async () => {
    const buf = await generateJournalReportDocx(FULL_INPUT);
    const xml = await extractDocumentXml(buf);
    expect(xml).toContain("차기 계획");
  });

  it("includes total hours at the bottom", async () => {
    const buf = await generateJournalReportDocx(FULL_INPUT);
    const xml = await extractDocumentXml(buf);
    // Total = 6 + 8 + 10 = 24시간
    expect(xml).toContain("24");
    expect(xml).toContain("총 연구 시간");
  });

  it("embeds objectives and results text in document XML", async () => {
    const buf = await generateJournalReportDocx(FULL_INPUT);
    const xml = await extractDocumentXml(buf);
    expect(xml).toContain("ResNet 기반 분류 모델 구조 설계");
    expect(xml).toContain("3개 레이어 구조 확정");
    expect(xml).toContain("하이퍼파라미터 튜닝 진행 예정");
  });

  it("handles empty journal list gracefully", async () => {
    const buf = await generateJournalReportDocx(MINIMAL_INPUT);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("handles entries without optional fields (objectives/results/nextSteps/hours)", async () => {
    const input: JournalReportInput = {
      clientName: "테스트기관",
      researcherName: "연구원",
      year: 2024,
      month: 6,
      journals: [
        { date: "2024-06-01", title: "기초 탐색 연구" },
      ],
    };
    const buf = await generateJournalReportDocx(input);
    expect(buf).toBeInstanceOf(Buffer);
    const xml = await extractDocumentXml(buf);
    expect(xml).toContain("기초 탐색 연구");
  });

  it("uses 맑은 고딕 Korean font in styles XML", async () => {
    const buf = await generateJournalReportDocx(FULL_INPUT);
    const zip = await JSZip.loadAsync(buf);
    const stylesFile = zip.file("word/styles.xml");
    expect(stylesFile).not.toBeNull();
    const stylesXml = await stylesFile!.async("string");
    expect(stylesXml).toContain("맑은 고딕");
  });
});

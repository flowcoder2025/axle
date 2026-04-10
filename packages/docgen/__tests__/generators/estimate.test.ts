import { describe, it, expect } from "vitest";
import { generateEstimateDocx, EstimateDocInput } from "../../src/generators/estimate.js";

const SAMPLE_INPUT: EstimateDocInput = {
  estimateNumber: "EST-2024-001",
  clientName: "주식회사 테스트클라이언트",
  clientAddress: "서울특별시 강남구 테헤란로 123",
  items: [
    { name: "웹사이트 개발", quantity: 1, unitPrice: 3000000, amount: 3000000 },
    { name: "UI/UX 디자인", quantity: 1, unitPrice: 1000000, amount: 1000000 },
    { name: "유지보수 (월)", quantity: 3, unitPrice: 300000, amount: 900000 },
  ],
  totalAmount: 5390000,
  taxAmount: 490000,
  validUntil: "2024-03-31",
  memo: "VAT 포함 금액입니다. 견적 유효기간 내 계약 체결 시 적용됩니다.",
  issuerName: "홍길동",
  issuerCompany: "플로우코더 주식회사",
};

describe("generateEstimateDocx", () => {
  it("returns a non-empty Buffer", async () => {
    const buf = await generateEstimateDocx(SAMPLE_INPUT);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("produces a valid DOCX (PK zip magic bytes)", async () => {
    const buf = await generateEstimateDocx(SAMPLE_INPUT);
    // DOCX is a ZIP archive — magic bytes: 50 4B 03 04
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });

  it("returns a buffer larger than 5 KB (has real content)", async () => {
    const buf = await generateEstimateDocx(SAMPLE_INPUT);
    expect(buf.length).toBeGreaterThan(5 * 1024);
  });

  it("works without optional fields", async () => {
    const minimal: EstimateDocInput = {
      estimateNumber: "EST-0001",
      clientName: "테스트 클라이언트",
      items: [{ name: "컨설팅", quantity: 2, unitPrice: 500000, amount: 1000000 }],
      totalAmount: 1000000,
      issuerName: "이순신",
      issuerCompany: "테스트 컴퍼니",
    };
    const buf = await generateEstimateDocx(minimal);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("handles zero items gracefully", async () => {
    const input: EstimateDocInput = {
      ...SAMPLE_INPUT,
      items: [],
      totalAmount: 0,
    };
    const buf = await generateEstimateDocx(input);
    expect(buf).toBeInstanceOf(Buffer);
  });
});

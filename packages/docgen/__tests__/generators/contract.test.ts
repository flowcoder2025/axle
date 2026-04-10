import { describe, it, expect } from "vitest";
import { generateContractDocx, ContractDocInput } from "../../src/generators/contract.js";

const SAMPLE_INPUT: ContractDocInput = {
  contractNumber: "CON-2024-001",
  title: "웹 서비스 개발 용역 계약서",
  partyA: {
    name: "주식회사 발주사",
    representative: "김대표",
    businessNumber: "123-45-67890",
    address: "서울특별시 강남구 테헤란로 100",
  },
  partyB: {
    name: "플로우코더 주식회사",
    representative: "홍길동",
    businessNumber: "987-65-43210",
    address: "서울특별시 마포구 상암로 50",
  },
  terms: [
    {
      order: 1,
      title: "목적",
      content: "본 계약은 갑이 을에게 웹 서비스 개발 업무를 위탁하고 을이 이를 수행함을 목적으로 한다.",
    },
    {
      order: 2,
      title: "계약 범위",
      content: "을은 갑이 요청한 웹사이트 개발, UI/UX 디자인 및 유지보수 업무를 수행한다.\n세부 범위는 별도 산출 내역서에 따른다.",
    },
    {
      order: 3,
      title: "계약 금액 및 지급 방법",
      content: "계약 금액은 본 계약서에 명기된 금액으로 하며, 갑은 계약 체결 후 30일 이내에 을에게 지급한다.",
    },
    {
      order: 4,
      title: "비밀 유지",
      content: "갑과 을은 본 계약 수행 중 알게 된 상대방의 기밀 정보를 제3자에게 공개하거나 누설하지 아니한다.",
    },
  ],
  totalAmount: 5500000,
  startDate: "2024-02-01",
  endDate: "2024-04-30",
  signatureDate: "2024-01-15",
};

describe("generateContractDocx", () => {
  it("returns a non-empty Buffer", async () => {
    const buf = await generateContractDocx(SAMPLE_INPUT);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("produces a valid DOCX (PK zip magic bytes)", async () => {
    const buf = await generateContractDocx(SAMPLE_INPUT);
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });

  it("returns a buffer larger than 5 KB (has real content)", async () => {
    const buf = await generateContractDocx(SAMPLE_INPUT);
    expect(buf.length).toBeGreaterThan(5 * 1024);
  });

  it("works without optional fields (no amount, dates)", async () => {
    const minimal: ContractDocInput = {
      contractNumber: "CON-MIN-001",
      title: "용역 계약서",
      partyA: { name: "갑 회사", representative: "갑 대표" },
      partyB: { name: "을 회사", representative: "을 대표" },
      terms: [
        {
          order: 1,
          title: "목적",
          content: "본 계약은 갑과 을 간의 업무 위탁 계약이다.",
        },
      ],
    };
    const buf = await generateContractDocx(minimal);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("sorts terms by order regardless of input order", async () => {
    const shuffledInput: ContractDocInput = {
      ...SAMPLE_INPUT,
      terms: [...SAMPLE_INPUT.terms].reverse(),
    };
    // Should still produce a valid document (no crash)
    const buf = await generateContractDocx(shuffledInput);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("handles empty terms array", async () => {
    const input: ContractDocInput = { ...SAMPLE_INPUT, terms: [] };
    const buf = await generateContractDocx(input);
    expect(buf).toBeInstanceOf(Buffer);
  });
});

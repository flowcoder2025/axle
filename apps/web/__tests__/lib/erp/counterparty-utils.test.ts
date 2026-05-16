import { describe, it, expect } from "vitest";
import {
  normalizeCounterpartyName,
  canonicalizeBizRegNo,
  formatBizRegNo,
} from "../../../lib/erp/counterparty-utils";

describe("normalizeCounterpartyName", () => {
  it("trims and lowercases", () => {
    expect(normalizeCounterpartyName("  ABC  ")).toBe("abc");
  });

  it("strips Korean company prefixes", () => {
    expect(normalizeCounterpartyName("(주)에이비씨")).toBe("에이비씨");
    expect(normalizeCounterpartyName("주식회사 한솔물류")).toBe("한솔물류");
    expect(normalizeCounterpartyName("㈜한국")).toBe("한국");
    expect(normalizeCounterpartyName("(유)서울무역")).toBe("서울무역");
  });

  it("strips English company suffixes (case-insensitive)", () => {
    expect(normalizeCounterpartyName("ABC Co., Ltd.")).toBe("abc");
    expect(normalizeCounterpartyName("Acme Inc.")).toBe("acme");
    expect(normalizeCounterpartyName("Globex CORP")).toBe("globex");
  });

  it("strips both prefix and suffix together", () => {
    expect(normalizeCounterpartyName("(주)에이비씨 Inc.")).toBe("에이비씨");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeCounterpartyName("한솔   물류")).toBe("한솔 물류");
  });

  it("NFC normalization (precomposed vs decomposed Hangul)", () => {
    // U+AC00 (가) is precomposed; same string decomposed differs in bytes but
    // should normalize to the same NFC form.
    const precomposed = "가";
    const decomposed = "가"; // ᄀ + ᅡ
    expect(normalizeCounterpartyName(precomposed)).toBe(
      normalizeCounterpartyName(decomposed),
    );
  });

  it("returns empty string for empty input", () => {
    expect(normalizeCounterpartyName("")).toBe("");
    expect(normalizeCounterpartyName("   ")).toBe("");
  });

  it("longest-prefix-match: 주식회사 wins over (주)", () => {
    // Both prefixes have separate semantics; longest match should apply once
    // and not double-strip.
    expect(normalizeCounterpartyName("주식회사 (주)테스트")).toBe("(주)테스트");
  });

  it("deterministic — same input always produces same output (upsert safe)", () => {
    const a = normalizeCounterpartyName("(주)한솔물류  Inc.");
    const b = normalizeCounterpartyName("(주)한솔물류  Inc.");
    expect(a).toBe(b);
    expect(a).toBe("한솔물류");
  });
});

describe("canonicalizeBizRegNo", () => {
  it("strips dashes and spaces", () => {
    expect(canonicalizeBizRegNo("123-45-67890")).toBe("1234567890");
    expect(canonicalizeBizRegNo("123 45 67890")).toBe("1234567890");
    expect(canonicalizeBizRegNo("  123-45-67890  ")).toBe("1234567890");
  });

  it("returns null for nullish or empty after strip", () => {
    expect(canonicalizeBizRegNo(null)).toBeNull();
    expect(canonicalizeBizRegNo(undefined)).toBeNull();
    expect(canonicalizeBizRegNo("")).toBeNull();
    expect(canonicalizeBizRegNo("   ")).toBeNull();
    expect(canonicalizeBizRegNo("---")).toBeNull();
  });

  it("preserves digits even if length is wrong (caller validates)", () => {
    expect(canonicalizeBizRegNo("12345")).toBe("12345");
    expect(canonicalizeBizRegNo("12345678901")).toBe("12345678901");
  });
});

describe("formatBizRegNo", () => {
  it("formats 10-digit canonical as XXX-XX-XXXXX", () => {
    expect(formatBizRegNo("1234567890")).toBe("123-45-67890");
  });

  it("returns null for nullish", () => {
    expect(formatBizRegNo(null)).toBeNull();
    expect(formatBizRegNo(undefined)).toBeNull();
  });

  it("returns input as-is for wrong length (defensive)", () => {
    expect(formatBizRegNo("12345")).toBe("12345");
  });
});

describe("normalizeCounterpartyName + canonicalizeBizRegNo composition (WI-723b backfill key)", () => {
  // 백필 매칭 키는 (normalizedName, canonicalBizRegNo). 두 함수 모두 deterministic해야
  // dry-run에서 같은 결과가 두 번 나옴. RED 케이스: 다음 두 입력이 같은 키로 매칭되어야.
  const inputs = [
    { name: "(주)에이비씨", biz: "123-45-67890" },
    { name: "  주식회사 에이비씨  ", biz: "1234567890" },
  ];

  it("different display forms with same identity → same matching key", () => {
    const keyA = `${normalizeCounterpartyName(inputs[0].name)}|${canonicalizeBizRegNo(inputs[0].biz)}`;
    const keyB = `${normalizeCounterpartyName(inputs[1].name)}|${canonicalizeBizRegNo(inputs[1].biz)}`;
    expect(keyA).toBe(keyB);
    expect(keyA).toBe("에이비씨|1234567890");
  });
});

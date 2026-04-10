import { describe, it, expect } from "vitest";
import {
  normalizeDate,
  normalizeFunding,
  categorize,
  deduplicate,
  normalizePrograms,
} from "../src/normalizer.js";
import { ProgramCategory } from "../src/types.js";
import type { CrawledProgram } from "../src/types.js";

// ---------------------------------------------------------------------------
// normalizeDate
// ---------------------------------------------------------------------------

describe("normalizeDate", () => {
  it("parses ISO-like date with dashes", () => {
    expect(normalizeDate("2024-03-15")).toBe("2024-03-15");
  });

  it("parses ISO-like date with dots", () => {
    expect(normalizeDate("2024.03.15")).toBe("2024-03-15");
  });

  it("parses full Korean date", () => {
    expect(normalizeDate("2024년 3월 15일")).toBe("2024-03-15");
  });

  it("parses Korean year-month only (uses day 01)", () => {
    expect(normalizeDate("2024년 3월")).toBe("2024-03-01");
  });

  it("pads single-digit month and day", () => {
    expect(normalizeDate("2024.1.5")).toBe("2024-01-05");
  });

  it("parses two-digit year", () => {
    expect(normalizeDate("24.03.15")).toBe("2024-03-15");
  });

  it("returns null for unparseable input", () => {
    expect(normalizeDate("상시")).toBeNull();
    expect(normalizeDate("")).toBeNull();
    expect(normalizeDate(null)).toBeNull();
    expect(normalizeDate(undefined)).toBeNull();
  });

  it("handles dates with slashes", () => {
    expect(normalizeDate("2024/03/15")).toBe("2024-03-15");
  });
});

// ---------------------------------------------------------------------------
// normalizeFunding
// ---------------------------------------------------------------------------

describe("normalizeFunding", () => {
  it("parses 억 unit", () => {
    expect(normalizeFunding("5억원")).toBe(500_000_000);
  });

  it("parses 만 unit", () => {
    expect(normalizeFunding("1000만원")).toBe(10_000_000);
  });

  it("parses 억 + 만 combined", () => {
    // 1억(100,000,000) + 5000만(50,000,000) = 150,000,000
    expect(normalizeFunding("1억5000만원")).toBe(100_000_000 + 50_000_000);
  });

  it("parses with 최대 prefix", () => {
    expect(normalizeFunding("최대 3억원")).toBe(300_000_000);
  });

  it("parses with commas", () => {
    expect(normalizeFunding("1,000만원")).toBe(10_000_000);
  });

  it("parses decimal 억", () => {
    expect(normalizeFunding("1.5억원")).toBe(150_000_000);
  });

  it("returns null for empty / undefined", () => {
    expect(normalizeFunding(null)).toBeNull();
    expect(normalizeFunding(undefined)).toBeNull();
    expect(normalizeFunding("")).toBeNull();
  });

  it("parses plain number as-is", () => {
    expect(normalizeFunding("500000")).toBe(500_000);
  });
});

// ---------------------------------------------------------------------------
// categorize
// ---------------------------------------------------------------------------

describe("categorize", () => {
  const prog = (overrides: Partial<CrawledProgram>): CrawledProgram => ({
    name: "",
    ...overrides,
  });

  it("classifies R&D programs", () => {
    expect(categorize(prog({ name: "중소기업 R&D 지원사업" }))).toBe(ProgramCategory.RD);
  });

  it("classifies by Korean keyword in name", () => {
    expect(categorize(prog({ name: "수출 바우처 프로그램" }))).toBe(ProgramCategory.EXPORT);
  });

  it("classifies by rawText", () => {
    expect(
      categorize(prog({ name: "사업화 지원", rawText: "창업 초기 기업을 대상으로 합니다." }))
    ).toBe(ProgramCategory.STARTUP);
  });

  it("defaults to OTHER when no keyword matches", () => {
    expect(categorize(prog({ name: "기타 프로그램" }))).toBe(ProgramCategory.OTHER);
  });

  it("classifies employment programs", () => {
    expect(categorize(prog({ name: "청년 일자리 창출 지원" }))).toBe(ProgramCategory.EMPLOYMENT);
  });

  it("classifies finance programs", () => {
    expect(categorize(prog({ name: "중소기업 정책융자" }))).toBe(ProgramCategory.FINANCE);
  });
});

// ---------------------------------------------------------------------------
// deduplicate
// ---------------------------------------------------------------------------

describe("deduplicate", () => {
  const prog = (name: string): CrawledProgram => ({ name });

  it("removes exact duplicates", () => {
    const result = deduplicate([prog("테스트 사업"), prog("테스트 사업")]);
    expect(result).toHaveLength(1);
  });

  it("removes fuzzy duplicates (whitespace + punctuation differ)", () => {
    const result = deduplicate([prog("테스트  지원사업"), prog("테스트지원사업")]);
    expect(result).toHaveLength(1);
  });

  it("keeps genuinely different programs", () => {
    const result = deduplicate([prog("R&D 지원사업"), prog("수출 바우처")]);
    expect(result).toHaveLength(2);
  });

  it("keeps first occurrence on dedup", () => {
    const a = { name: "테스트", agency: "기관A" };
    const b = { name: "테스트", agency: "기관B" };
    const result = deduplicate([a, b]);
    expect(result[0].agency).toBe("기관A");
  });
});

// ---------------------------------------------------------------------------
// normalizePrograms (integration)
// ---------------------------------------------------------------------------

describe("normalizePrograms", () => {
  it("normalizes dates and deduplicates in one pass", () => {
    const input: CrawledProgram[] = [
      {
        name: "스마트 제조 R&D",
        applicationStart: "2024년 1월 1일",
        applicationEnd: "2024.03.31",
        rawText: "최대 2억원",
      },
      { name: "스마트 제조 R&D" }, // duplicate
      {
        name: "수출 바우처",
        applicationEnd: "2024-06-30",
      },
    ];

    const result = normalizePrograms(input);

    expect(result).toHaveLength(2);

    const rd = result.find((p) => p.name === "스마트 제조 R&D")!;
    expect(rd.applicationStart).toBe("2024-01-01");
    expect(rd.applicationEnd).toBe("2024-03-31");
    expect(rd.maxFunding).toBe(200_000_000);
    expect(rd.category).toBe(ProgramCategory.RD);

    const exp = result.find((p) => p.name === "수출 바우처")!;
    expect(exp.applicationEnd).toBe("2024-06-30");
    expect(exp.category).toBe(ProgramCategory.EXPORT);
  });
});

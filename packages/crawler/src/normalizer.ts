/**
 * Normalizer: deduplication, date parsing, funding amount parsing,
 * and category assignment for crawled programs.
 */
import { ProgramCategory } from "./types.js";
import type { CrawledProgram } from "./types.js";

// ---------------------------------------------------------------------------
// Date normalization
// ---------------------------------------------------------------------------

/** Patterns and their handlers — ordered most-specific first. */
const DATE_PATTERNS: Array<{ re: RegExp; parse: (m: RegExpMatchArray) => string }> = [
  // 2024-01-15, 2024.01.15
  {
    re: /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/,
    parse: (m) => `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`,
  },
  // 2024년 1월 15일
  {
    re: /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/,
    parse: (m) => `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`,
  },
  // 2024년 1월 (no day)
  {
    re: /(\d{4})년\s*(\d{1,2})월/,
    parse: (m) => `${m[1]}-${m[2].padStart(2, "0")}-01`,
  },
  // 24.01.15 (two-digit year)
  {
    re: /^(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})$/,
    parse: (m) => `20${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`,
  },
];

/**
 * Normalizes a Korean/ISO date string to YYYY-MM-DD.
 * Returns null if the input cannot be parsed.
 */
export function normalizeDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  for (const { re, parse } of DATE_PATTERNS) {
    const m = cleaned.match(re);
    if (m) return parse(m);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Funding amount normalization
// ---------------------------------------------------------------------------

/**
 * Parses Korean funding amount strings into a plain number (KRW).
 * Examples: "최대 5억원" → 500_000_000, "1,000만원" → 10_000_000
 * Returns null if parsing fails.
 */
export function normalizeFunding(raw: string | undefined | null): number | null {
  if (!raw) return null;

  const cleaned = raw.replace(/,/g, "").replace(/\s+/g, "");

  // 억 unit (100,000,000)
  const eok = cleaned.match(/(\d+(?:\.\d+)?)억/);
  if (eok) {
    const base = parseFloat(eok[1]) * 100_000_000;
    // may also have a 만 suffix: "1억5천만원"
    const man = cleaned.match(/억(\d+(?:\.\d+)?)만/);
    return man ? base + parseFloat(man[1]) * 10_000 : base;
  }

  // 만 unit (10,000)
  const man = cleaned.match(/(\d+(?:\.\d+)?)만/);
  if (man) return parseFloat(man[1]) * 10_000;

  // plain number (assume KRW)
  const plain = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (plain) return parseFloat(plain[1]);

  return null;
}

// ---------------------------------------------------------------------------
// Category classification
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Array<{ category: ProgramCategory; keywords: string[] }> = [
  { category: ProgramCategory.RD, keywords: ["R&D", "연구개발", "기술개발", "연구"] },
  { category: ProgramCategory.EXPORT, keywords: ["수출", "해외", "글로벌", "무역"] },
  { category: ProgramCategory.STARTUP, keywords: ["창업", "스타트업", "벤처"] },
  { category: ProgramCategory.EMPLOYMENT, keywords: ["고용", "채용", "인력", "일자리", "취업"] },
  { category: ProgramCategory.FINANCE, keywords: ["융자", "대출", "보증", "투자", "금융"] },
  { category: ProgramCategory.MARKETING, keywords: ["마케팅", "홍보", "광고", "브랜드"] },
  { category: ProgramCategory.CONSULTING, keywords: ["컨설팅", "멘토링", "자문"] },
];

/**
 * Assigns a ProgramCategory based on program name, category string, and
 * requirements text.
 */
export function categorize(program: CrawledProgram): ProgramCategory {
  const haystack = [program.name, program.category, program.requirements, program.rawText]
    .filter(Boolean)
    .join(" ");

  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => haystack.includes(kw))) return category;
  }
  return ProgramCategory.OTHER;
}

// ---------------------------------------------------------------------------
// Deduplication (fuzzy name matching)
// ---------------------------------------------------------------------------

/** Strips whitespace, punctuation, and common filler words for comparison. */
function normalizeForDedup(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w가-힣]/g, "")
    .replace(/지원사업|지원|사업/g, "");
}

/**
 * Deduplicates programs by fuzzy name.
 * When two names normalize to the same string, the first occurrence wins.
 */
export function deduplicate(programs: CrawledProgram[]): CrawledProgram[] {
  const seen = new Set<string>();
  return programs.filter((p) => {
    const key = normalizeForDedup(p.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Top-level normalize pipeline
// ---------------------------------------------------------------------------

/**
 * Applies all normalization steps to a list of crawled programs:
 * 1. Date normalization
 * 2. Funding amount normalization
 * 3. Category classification
 * 4. Deduplication
 */
export function normalizePrograms(programs: CrawledProgram[]): CrawledProgram[] {
  const normalized = programs.map((p) => ({
    ...p,
    applicationStart: normalizeDate(p.applicationStart) ?? p.applicationStart,
    applicationEnd: normalizeDate(p.applicationEnd) ?? p.applicationEnd,
    maxFunding: p.maxFunding ?? normalizeFunding(p.rawText) ?? undefined,
    category: p.category ?? categorize(p),
  }));

  return deduplicate(normalized);
}

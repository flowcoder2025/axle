/**
 * ErpCounterparty normalization utilities (WI-721/722).
 *
 * `normalizedName` is the search key indexed for fuzzy matching (WI-724a).
 * `bizRegNoDigits` is the canonical storage form for the partial unique
 * constraint `(orgId, bizRegNo) WHERE bizRegNo IS NOT NULL`.
 *
 * Both are deterministic so the same input always produces the same key —
 * required for upsert semantics (WI-723b backfill) and merge dedup (WI-724b).
 */

const KOREAN_COMPANY_PREFIXES = [
  "주식회사",
  "유한회사",
  "합자회사",
  "합명회사",
  "유한책임회사",
  "(주)",
  "(유)",
  "(합)",
  "(재)",
  "(사)",
  "㈜",
] as const;

const ENGLISH_COMPANY_SUFFIXES = [
  "co.,ltd.",
  "co., ltd.",
  "co.,ltd",
  "co., ltd",
  "co.ltd",
  "ltd.",
  "ltd",
  "inc.",
  "inc",
  "llc",
  "corp.",
  "corp",
  "company",
] as const;

/**
 * Normalize a display name to the search key.
 *
 *  1. NFC unicode normalization (Hangul jamo decomposition collapse)
 *  2. Trim outer whitespace
 *  3. Strip leading Korean company prefixes ("(주)", "주식회사", ...)
 *  4. Strip trailing English company suffixes ("Co., Ltd.", "Inc.", ...)
 *  5. Collapse internal whitespace to a single space
 *  6. Lowercase
 *
 * Examples:
 *   "(주)에이비씨 컴퍼니"   → "에이비씨 컴퍼니"
 *   "주식회사 한솔물류"     → "한솔물류"
 *   "ABC Co., Ltd."         → "abc"
 *   "  한솔물류  Inc.  "    → "한솔물류"
 */
export function normalizeCounterpartyName(input: string): string {
  let s = input.normalize("NFC").trim();
  if (s.length === 0) return "";

  // Strip Korean prefixes (longest match first)
  const prefixesByLength = [...KOREAN_COMPANY_PREFIXES].sort(
    (a, b) => b.length - a.length,
  );
  for (const prefix of prefixesByLength) {
    if (s.startsWith(prefix)) {
      s = s.slice(prefix.length).trimStart();
      break;
    }
  }

  // Strip English suffixes (longest match first, case-insensitive)
  const lowered = s.toLowerCase();
  const suffixesByLength = [...ENGLISH_COMPANY_SUFFIXES].sort(
    (a, b) => b.length - a.length,
  );
  for (const suffix of suffixesByLength) {
    if (lowered.endsWith(suffix)) {
      // Strip from original (preserves any non-suffix mixed case in middle).
      s = s.slice(0, s.length - suffix.length).trimEnd();
      // Also remove trailing punctuation/space-comma residue.
      s = s.replace(/[,\s]+$/, "").trimEnd();
      break;
    }
  }

  // Collapse whitespace and lowercase
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Convert bizRegNo input ("123-45-67890" or "1234567890") to canonical
 * 10-digit string. Returns null if input is null/empty after stripping.
 *
 * Validation (length, format) is the caller's responsibility (Zod).
 * This function only canonicalizes — invalid input returns its stripped form
 * so the caller can decide whether to accept or reject.
 */
export function canonicalizeBizRegNo(input: string | null | undefined): string | null {
  if (input == null) return null;
  const stripped = input.trim().replace(/[-\s]/g, "");
  return stripped.length === 0 ? null : stripped;
}

/** Format a canonical 10-digit bizRegNo as "123-45-67890" for display. */
export function formatBizRegNo(canonical: string | null | undefined): string | null {
  if (!canonical) return null;
  if (canonical.length !== 10) return canonical; // unknown format — return as-is
  return `${canonical.slice(0, 3)}-${canonical.slice(3, 5)}-${canonical.slice(5)}`;
}

/**
 * Fuzzy matching for ERP Product/Client names.
 *
 * Korean-aware normalization (NFC + lowercase + unit/whitespace/punctuation strip)
 * combined with Levenshtein-based similarity, producing top-k results.
 *
 * Used by IntakeDraft API to suggest existing Products for OCR-extracted item names.
 */

// Units must be preceded by a digit (so "cola" / "1L" are distinguished — "L" alone in "cola" stays).
const UNIT_RE = /(\d+(\.\d+)?)\s*(ml|l|kg|g|개입|박스|포대|병|캔|팩|ea\.|ea|개|입)/gi;

export function normalizeName(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(UNIT_RE, "")
    .replace(/[\s\-_,.()]/g, "")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[a.length][b.length];
}

export function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

export interface MatchResult<T> {
  item: T;
  score: number;
  needsNew: boolean;
}

export function topMatches<T>(
  query: string,
  candidates: readonly T[],
  getName: (item: T) => string,
  k = 3,
  needsNewThreshold = 0.6,
): MatchResult<T>[] {
  const nq = normalizeName(query);
  const scored: MatchResult<T>[] = candidates.map((item) => {
    const score = similarity(nq, normalizeName(getName(item)));
    return { item, score, needsNew: score < needsNewThreshold };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

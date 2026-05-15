/**
 * Korean-specific fuzzy match coverage (WI-715).
 *
 * Goal: regression prevention on real-world ERP product naming patterns,
 * NOT aspirational scoring. Each threshold below was measured against the
 * current Levenshtein + unit-stripping implementation and set ~0.05 below
 * the observed value so a future normalizer regression trips the suite.
 *
 * Measured scores (apps/web/lib/erp/fuzzy-match.ts as of WI-714):
 *   코카콜라 vs 코카콜라 500ml   → 1.0000  (unit stripped)
 *   콜라 vs 코카콜라             → 0.5000
 *   오리지널 콜라 vs 콜라 오리지널 → 0.3333  (word-order penalty)
 *   우유 1L vs 우유 1리터        → 0.4000  (L↔리터 not normalized)
 *   환타 오렌지 vs 환타 포도     → 0.4000
 *   라면 5개입 vs 라면 5팩       → 1.0000  (both units stripped)
 *   신라면 vs 안성탕면           → 0.2500  (different products — should stay low)
 *   박카스 vs 박카스D            → 0.7500
 *   삼다수 2L vs 삼다수          → 1.0000  (unit stripped)
 *   쌀 10kg vs 백미 10kg         → 0.0000  (synonyms not handled)
 *   Coca-Cola vs 코카콜라        → 0.0000  (script-switch not handled)
 *
 * Phase 21+ may add Hangul jamo decomposition / synonym dictionary / token
 * reordering; when that happens, these thresholds will go UP and the assertions
 * should be tightened, not loosened.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeName,
  similarity,
  topMatches,
} from "../../../lib/erp/fuzzy-match";

function sim(a: string, b: string): number {
  return similarity(normalizeName(a), normalizeName(b));
}

describe("fuzzy-match — Korean real-world cases", () => {
  it("코카콜라 vs 코카콜라 500ml — unit-stripped identical", () => {
    // Unit stripping ("500ml") collapses both to "코카콜라" → score 1.0
    expect(sim("코카콜라", "코카콜라 500ml")).toBeGreaterThanOrEqual(0.99);
  });

  it("콜라 vs 코카콜라 — partial substring match", () => {
    // "콜라" is half of "코카콜라" → exactly 0.5 under Levenshtein
    expect(sim("콜라", "코카콜라")).toBeGreaterThanOrEqual(0.45);
  });

  it("오리지널 콜라 vs 콜라 오리지널 — word-order penalty acknowledged", () => {
    // Levenshtein is order-sensitive; today's implementation scores ~0.33.
    // Threshold pinned at 0.28 so a regression that breaks Hangul handling
    // (e.g. NFD vs NFC) drops the score further and trips the test.
    const score = sim("오리지널 콜라", "콜라 오리지널");
    expect(score).toBeGreaterThanOrEqual(0.28);
    // Document the gap explicitly: a synonym-aware matcher (Phase 21+)
    // should push this above 0.6. Until then it stays below the needs-new
    // threshold and the UI flags it for confirmation.
    expect(score).toBeLessThan(0.6);
  });

  it("우유 1L vs 우유 1리터 — Hangul 'liter' transliteration NOT normalized", () => {
    // The unit regex matches "L" digit-prefixed but not the Hangul "리터".
    // Today: "우유" vs "우유1리터" → 0.4. Pin at 0.35.
    const score = sim("우유 1L", "우유 1리터");
    expect(score).toBeGreaterThanOrEqual(0.35);
    expect(score).toBeLessThan(0.6);
  });

  it("환타 오렌지 vs 환타 포도 — flavor variants stay below needs-new", () => {
    // Common prefix "환타" keeps these around 0.4. They are DIFFERENT
    // products and must remain below 0.6 so UI prompts for confirmation.
    const score = sim("환타 오렌지", "환타 포도");
    expect(score).toBeGreaterThanOrEqual(0.35);
    expect(score).toBeLessThan(0.6);
  });

  it("라면 5개입 vs 라면 5팩 — both quantity-units stripped → identical", () => {
    // "개입" and "팩" are both in UNIT_RE → both collapse to "라면".
    // This is intentional: pack count is metadata, not product identity.
    expect(sim("라면 5개입", "라면 5팩")).toBeGreaterThanOrEqual(0.99);
  });

  it("신라면 vs 안성탕면 — unrelated ramen brands stay low", () => {
    // Different brands → must score below 0.4 so UI flags as new product.
    expect(sim("신라면", "안성탕면")).toBeLessThanOrEqual(0.4);
  });

  it("박카스 vs 박카스D — single-char suffix variant clears 0.7", () => {
    // 4 chars vs 3 chars, 1 edit → 1 - 1/4 = 0.75.
    expect(sim("박카스", "박카스D")).toBeGreaterThanOrEqual(0.7);
  });

  it("삼다수 2L vs 삼다수 — unit stripped → identical", () => {
    expect(sim("삼다수 2L", "삼다수")).toBeGreaterThanOrEqual(0.99);
  });

  it("쌀 10kg vs 백미 10kg — synonym matching NOT supported", () => {
    // Unit "10kg" strips on both sides → "쌀" vs "백미" share no
    // characters → score 0. Documents the synonym-dictionary gap that
    // Phase 21+ may close. Until then both belong to "needs new".
    const score = sim("쌀 10kg", "백미 10kg");
    expect(score).toBeLessThanOrEqual(0.05);
  });

  it("Coca-Cola vs 코카콜라 — Roman↔Hangul script switch NOT supported", () => {
    // No characters overlap → 0. Documents the romanization gap.
    expect(sim("Coca-Cola", "코카콜라")).toBeLessThanOrEqual(0.05);
  });

  it("topMatches over a 10-candidate catalog returns top-k sorted desc and flags needs-new correctly", () => {
    const catalog = [
      { id: "p1", name: "코카콜라 500ml" },
      { id: "p2", name: "코카콜라 1.5L" },
      { id: "p3", name: "펩시콜라 500ml" },
      { id: "p4", name: "사이다 500ml" },
      { id: "p5", name: "환타 오렌지 500ml" },
      { id: "p6", name: "환타 포도 500ml" },
      { id: "p7", name: "박카스" },
      { id: "p8", name: "삼다수 2L" },
      { id: "p9", name: "신라면" },
      { id: "p10", name: "안성탕면" },
    ];

    const top3 = topMatches("코카콜라", catalog, (p) => p.name, 3);
    expect(top3).toHaveLength(3);
    // Sorted descending
    expect(top3[0].score).toBeGreaterThanOrEqual(top3[1].score);
    expect(top3[1].score).toBeGreaterThanOrEqual(top3[2].score);
    // Top two should be the two 코카콜라 variants (both score 1.0 after unit strip)
    const topIds = top3.slice(0, 2).map((m) => m.item.id).sort();
    expect(topIds).toEqual(["p1", "p2"]);
    expect(top3[0].score).toBeGreaterThanOrEqual(0.99);
    expect(top3[0].needsNew).toBe(false);

    // Querying a brand-new product should mark the best candidate as needs-new
    const topForNew = topMatches(
      "처음보는상품",
      catalog,
      (p) => p.name,
      3,
    );
    expect(topForNew).toHaveLength(3);
    expect(topForNew[0].needsNew).toBe(true);
    expect(topForNew[0].score).toBeLessThan(0.6);

    // k larger than catalog returns all candidates without throwing
    const all = topMatches("콜라", catalog, (p) => p.name, 100);
    expect(all).toHaveLength(catalog.length);
  });

  it("normalizeName handles NFC composition + mixed-case ASCII suffix", () => {
    // Combining-jamo input ("코카콜라" decomposed) must round-trip to NFC
    // so it compares equal to the precomposed form.
    const decomposed = "코카콜라".normalize("NFD");
    expect(normalizeName(decomposed)).toBe("코카콜라");
    expect(normalizeName("Bacchus D")).toBe("bacchusd");
  });

  it("needsNew flag uses default 0.6 threshold from topMatches", () => {
    const result = topMatches(
      "콜라",
      [
        { id: "a", name: "코카콜라" }, // 0.5 → needs new
        { id: "b", name: "콜라" }, // 1.0 → not needs new
      ],
      (p) => p.name,
      2,
    );
    const byId = Object.fromEntries(result.map((r) => [r.item.id, r]));
    expect(byId.a.needsNew).toBe(true);
    expect(byId.b.needsNew).toBe(false);
  });
});

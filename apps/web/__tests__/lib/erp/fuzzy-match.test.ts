import { describe, it, expect } from "vitest";
import { normalizeName, similarity, topMatches } from "../../../lib/erp/fuzzy-match";

describe("normalizeName", () => {
  it("NFC + lowercase + strip whitespace/punctuation", () => {
    expect(normalizeName("코카-콜라 500ML")).toBe("코카콜라");
    expect(normalizeName("Coca Cola, 1L")).toBe("cocacola");
  });
  it("strips trailing units 개/박스/포대/병/캔/팩/ea", () => {
    expect(normalizeName("우유 1L 1팩")).toBe("우유");
    expect(normalizeName("쌀 10kg 2포대")).toBe("쌀");
  });
});

describe("similarity", () => {
  it("identical = 1.0", () => expect(similarity("콜라", "콜라")).toBe(1));
  it("totally different = low", () => expect(similarity("콜라", "사이다")).toBeLessThan(0.5));
  it("substring partial — 콜라 vs 코카콜라 normalized", () => {
    expect(similarity(normalizeName("콜라"), normalizeName("코카콜라"))).toBeGreaterThan(0.4);
  });
});

describe("topMatches", () => {
  it("returns top-3 sorted descending by score", () => {
    const products = [
      { id: "p1", name: "코카콜라" },
      { id: "p2", name: "사이다" },
      { id: "p3", name: "콜라 500ml" },
      { id: "p4", name: "환타" },
    ];
    const top = topMatches("콜라", products, (p) => p.name, 3);
    expect(top).toHaveLength(3);
    expect(top[0].score).toBeGreaterThanOrEqual(top[1].score);
    expect(top[0].score).toBeGreaterThanOrEqual(top[2].score);
    expect(top[0].item.id).toMatch(/^p[13]$/); // 코카콜라 또는 콜라 500ml
  });
  it("returns empty when candidates empty", () => {
    expect(topMatches("x", [], (p: { name: string }) => p.name, 3)).toEqual([]);
  });
  it("score < 0.6 flagged as needs-new", () => {
    const top = topMatches("완전다른상품", [{ id: "p1", name: "콜라" }], (p) => p.name, 3);
    expect(top[0].score).toBeLessThan(0.6);
    expect(top[0].needsNew).toBe(true);
  });
});

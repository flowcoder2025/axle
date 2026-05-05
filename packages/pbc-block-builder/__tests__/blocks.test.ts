import { describe, expect, it } from "vitest";
import {
  BLOCK_CATEGORIES,
  BLOCK_CATEGORY_NAMES,
  BLOCKS,
  getBlock,
  getCategoryMeta,
  listBlockIds,
  listBlocksByCategory,
  RENDER_OUTPUTS,
  A1_HERO_VISUAL,
  C2_REVIEWS,
  E1_CTA_BANNER,
  F3_DIVIDER,
  type BlockCategory,
  type BlockId,
} from "../src/index.js";

describe("WI-502 — 23-block registry shape", () => {
  it("registers exactly 23 blocks", () => {
    const ids = listBlockIds();
    expect(ids).toHaveLength(23);
    expect(new Set(ids).size).toBe(23);
  });

  it("hits the per-category counts confirmed in the visuals spec", () => {
    // From docs/specs/meta-platform/pbc-block-builder-visuals.md §1
    const expected: Record<BlockCategory, number> = {
      A: 3,
      B: 4,
      C: 5,
      D: 4,
      E: 4,
      F: 3,
    };
    for (const cat of BLOCK_CATEGORIES) {
      expect(listBlocksByCategory(cat).length).toBe(expected[cat]);
    }
  });

  it("every BlockId starts with its category short name", () => {
    for (const [id, def] of Object.entries(BLOCKS)) {
      expect(id.startsWith(def.category)).toBe(true);
    }
  });

  it("every block declares at least one variant + a non-empty name", () => {
    for (const def of Object.values(BLOCKS)) {
      expect(def.variants?.length ?? 0).toBeGreaterThan(0);
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
    }
  });

  it("getBlock returns the same definition by id", () => {
    expect(getBlock("A1")).toBe(A1_HERO_VISUAL);
    expect(getBlock("E1")).toBe(E1_CTA_BANNER);
    expect(getBlock("Z9" as BlockId)).toBeUndefined();
  });
});

describe("WI-502 — schemas validate sample payloads", () => {
  it("A1 hero accepts a minimal headline + rejects empty string", () => {
    expect(A1_HERO_VISUAL.schema.safeParse({ headline: "Welcome" }).success).toBe(true);
    expect(A1_HERO_VISUAL.schema.safeParse({ headline: "" }).success).toBe(false);
    expect(A1_HERO_VISUAL.schema.safeParse({}).success).toBe(false);
  });

  it("C2 reviews require at least one review entry", () => {
    expect(
      C2_REVIEWS.schema.safeParse({
        reviews: [{ rating: 5, quote: "Great", author: "Kim" }],
      }).success,
    ).toBe(true);
    expect(C2_REVIEWS.schema.safeParse({ reviews: [] }).success).toBe(false);
  });

  it("E1 CTA banner requires price + ctaText + ctaHref", () => {
    expect(
      E1_CTA_BANNER.schema.safeParse({
        price: "₩39,000",
        ctaText: "Buy now",
        ctaHref: "/checkout",
      }).success,
    ).toBe(true);
    expect(
      E1_CTA_BANNER.schema.safeParse({ price: "₩39,000" }).success,
    ).toBe(false);
  });

  it("F3 divider stays minimal (all fields optional)", () => {
    expect(F3_DIVIDER.schema.safeParse({}).success).toBe(true);
    expect(F3_DIVIDER.schema.safeParse({ height: 32 }).success).toBe(true);
  });
});

describe("WI-502 — placeholder render emits a stable marker", () => {
  it("returns a self-describing string + placeholder metadata", () => {
    const result = A1_HERO_VISUAL.render(
      { headline: "Hello" },
      { output: "html" },
    );
    expect(result.content).toContain("[pbc-block-builder placeholder]");
    expect(result.content).toContain("A1");
    expect(result.content).toContain("html");
    expect(result.metadata?.placeholder).toBe(true);
    expect(result.metadata?.output).toBe("html");
    expect(result.metadata?.followupWi).toBe("WI-503..WI-506");
  });

  it("produces a placeholder for every (block × output) pair", () => {
    for (const def of Object.values(BLOCKS)) {
      for (const output of RENDER_OUTPUTS) {
        const r = def.render({} as never, { output });
        expect(typeof r.content).toBe("string");
        expect(r.metadata?.blockId).toBe(def.id);
        expect(r.metadata?.output).toBe(output);
      }
    }
  });
});

describe("WI-502 — category metadata is complete + consistent", () => {
  it("BLOCK_CATEGORY_NAMES covers every category in BLOCK_CATEGORIES", () => {
    for (const cat of BLOCK_CATEGORIES) {
      const meta = BLOCK_CATEGORY_NAMES[cat];
      expect(meta).toBeDefined();
      expect(meta.id).toBe(cat);
      expect(meta.en.length).toBeGreaterThan(0);
      expect(meta.ko.length).toBeGreaterThan(0);
      expect(meta.purpose.length).toBeGreaterThan(0);
      expect(meta.moodKeywords.length).toBeGreaterThan(0);
    }
  });

  it("getCategoryMeta returns canonical names from the visuals spec", () => {
    expect(getCategoryMeta("A").en).toBe("Opening");
    expect(getCategoryMeta("B").en).toBe("Core Value");
    expect(getCategoryMeta("C").en).toBe("Trust");
    expect(getCategoryMeta("D").en).toBe("Detail");
    expect(getCategoryMeta("E").en).toBe("Conversion");
    expect(getCategoryMeta("F").en).toBe("Mood");
  });

  it("Korean names match the FlowStudio v2 source spec", () => {
    expect(getCategoryMeta("A").ko).toBe("도입부");
    expect(getCategoryMeta("F").ko).toBe("감성 연출");
  });
});

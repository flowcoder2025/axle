/**
 * WI-508 — 4 PRESETS tests.
 *
 * The four canonical presets named in `pbc-block-builder.md` §3.2:
 *
 *   - landing-saas       : SaaS landing page (hero → features → proof → CTA)
 *   - detail-ecommerce   : product detail page (hero → features → reviews → spec → CTA)
 *   - sns-card           : compact SNS post (hero → hook → CTA)
 *   - business-doc       : business document / proposal (cover → problem → solution → spec → next steps)
 *
 * Each preset is a `PageComposition` with placeholder content that:
 *   - validates against every block's zod schema (so apps can drop the
 *     preset straight into `renderComposition()` without surgery)
 *   - uses only registered block ids
 *   - exercises a meaningful slice of the 23-block catalog (no preset is a
 *     single-block stub)
 *
 * The tests also smoke-render every preset through all four output
 * adapters to catch regressions where a renderer breaks on a specific
 * block payload shape.
 */

import { describe, expect, it } from "vitest";
import {
  BLOCKS,
  PRESETS,
  PRESET_NAMES,
  renderComposition,
  validateBlockData,
  type RenderContext,
  type RenderOutput,
} from "../src/index.js";

describe("WI-508 — PRESETS catalog", () => {
  it("exposes exactly four named presets", () => {
    expect(PRESET_NAMES).toEqual([
      "landing-saas",
      "detail-ecommerce",
      "sns-card",
      "business-doc",
    ]);
  });

  it("PRESETS map covers every name", () => {
    for (const name of PRESET_NAMES) {
      expect(PRESETS[name]).toBeDefined();
      expect(Array.isArray(PRESETS[name].blocks)).toBe(true);
      expect(PRESETS[name].blocks.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("each preset uses only registered block ids", () => {
    for (const name of PRESET_NAMES) {
      for (const entry of PRESETS[name].blocks) {
        expect(BLOCKS[entry.id], `${name} → ${entry.id}`).toBeDefined();
      }
    }
  });

  it("each preset's block payloads validate against their zod schemas", () => {
    for (const name of PRESET_NAMES) {
      for (const entry of PRESETS[name].blocks) {
        const result = validateBlockData(entry.id, entry.data);
        expect(
          result.ok,
          `${name} → ${entry.id} failed: ${result.errors?.join("; ")}`,
        ).toBe(true);
      }
    }
  });

  it("each preset's blocks declare a stable theme name (or omit it)", () => {
    for (const name of PRESET_NAMES) {
      const theme = PRESETS[name].theme;
      if (theme !== undefined) {
        expect(typeof theme).toBe("string");
        expect(theme.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("WI-508 — preset characterization (catches accidental rewrites)", () => {
  it("landing-saas leads with A1 hero and ends with an E-category CTA", () => {
    const blocks = PRESETS["landing-saas"].blocks;
    expect(blocks[0].id).toBe("A1");
    expect(blocks[blocks.length - 1].id.startsWith("E")).toBe(true);
  });

  it("detail-ecommerce includes a spec table (D1) and a CTA banner (E1)", () => {
    const ids = PRESETS["detail-ecommerce"].blocks.map((b) => b.id);
    expect(ids).toContain("D1");
    expect(ids).toContain("E1");
  });

  it("sns-card stays compact (≤ 5 blocks)", () => {
    expect(PRESETS["sns-card"].blocks.length).toBeLessThanOrEqual(5);
  });

  it("business-doc emphasizes detail blocks (≥ 2 D-category)", () => {
    const dCount = PRESETS["business-doc"].blocks.filter((b) =>
      b.id.startsWith("D"),
    ).length;
    expect(dCount).toBeGreaterThanOrEqual(2);
  });
});

describe("WI-508 — renderComposition smoke for every preset × output", () => {
  const outputs: RenderOutput[] = ["html", "markdown", "react", "docx-element"];

  for (const name of [
    "landing-saas",
    "detail-ecommerce",
    "sns-card",
    "business-doc",
  ] as const) {
    for (const output of outputs) {
      it(`${name} renders cleanly with output=${output}`, async () => {
        const context: RenderContext = { output };
        const results = await renderComposition(PRESETS[name], context);
        expect(results.length).toBe(PRESETS[name].blocks.length);
        for (const r of results) {
          // No placeholder marker should leak — every output adapter is
          // shipped (WI-503..WI-506).
          if (typeof r.content === "string") {
            expect(r.content).not.toContain("[pbc-block-builder placeholder]");
          }
        }
      });
    }
  }
});

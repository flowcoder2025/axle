/**
 * WI-510 — 4-output snapshot regression for every preset.
 *
 * `pbc-block-builder.md` §9 explicitly cites "4 출력 포맷 간 일관성 검증
 * 어려움 → snapshot 테스트로 회귀 방지" as the mitigation for the cross-
 * format consistency risk. This file pins:
 *
 *   - the full HTML / Markdown / DOCX-element output for each of the four
 *     presets (4 × 3 = 12 snapshots — React is excluded because the React
 *     element tree is structurally cyclic and isn't snapshot-friendly;
 *     it's covered by the renderer-level test against
 *     `renderToStaticMarkup`)
 *   - that every block id present in the composition appears in every
 *     output's metadata (no silent drops between adapters)
 *
 * Snapshot updates require `vitest --update` and human review of the
 * diff. Most renderer changes should be intentional and visible here.
 */

import { describe, expect, it } from "vitest";
import {
  PRESETS,
  PRESET_NAMES,
  renderComposition,
  type DocxElement,
  type RenderContext,
} from "../../src/index.js";

describe("WI-510 — preset × output snapshots", () => {
  for (const name of PRESET_NAMES) {
    const composition = PRESETS[name];
    const blockIds = composition.blocks.map((b) => b.id);

    it(`${name} — html snapshot`, async () => {
      const ctx: RenderContext = { output: "html" };
      const results = await renderComposition(composition, ctx);
      const combined = results.map((r) => r.content as string).join("\n\n");
      expect(combined).toMatchSnapshot();
      // Cross-output sanity — every requested block id appears in metadata.
      expect(results.map((r) => r.metadata?.blockId)).toEqual(blockIds);
    });

    it(`${name} — markdown snapshot`, async () => {
      const ctx: RenderContext = { output: "markdown" };
      const results = await renderComposition(composition, ctx);
      const combined = results.map((r) => r.content as string).join("\n");
      expect(combined).toMatchSnapshot();
      expect(results.map((r) => r.metadata?.blockId)).toEqual(blockIds);
    });

    it(`${name} — docx-element snapshot`, async () => {
      const ctx: RenderContext = { output: "docx-element" };
      const results = await renderComposition(composition, ctx);
      // For DOCX-element we snapshot the structural array — easier to read
      // and still detects accidental renderer regressions.
      const combined = results.map((r) => r.content as DocxElement[]);
      expect(combined).toMatchSnapshot();
      expect(results.map((r) => r.metadata?.blockId)).toEqual(blockIds);
    });
  }
});

describe("WI-510 — output count parity across the four adapters", () => {
  for (const name of PRESET_NAMES) {
    it(`${name}: every adapter emits exactly one result per composition entry`, async () => {
      const expected = PRESETS[name].blocks.length;
      for (const output of ["html", "markdown", "react", "docx-element"] as const) {
        const results = await renderComposition(PRESETS[name], { output });
        expect(results, `${name} × ${output}`).toHaveLength(expected);
      }
    });
  }
});

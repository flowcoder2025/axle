/**
 * WI-509 — FlowStudio v2 → @axle/pbc-block-builder migration shim tests.
 *
 * Per `pbc-block-builder.md` §2 the original FlowStudio v2 codebase lives
 * in a separate repo (`FlowStudio_v2/lib/detail-page/...`). The AXLE
 * deliverable for the migration is therefore (1) a v2-compat facade that
 * mirrors the old public surface, (2) a step-by-step playbook, and
 * (3) automated regression tests — same shape as WI-407 / WI-408 for
 * `pbc-image-engine`.
 *
 * The compat surface this WI ships:
 *   - `BLOCKS` registry re-exported (keyed by v2 block ids — same A1..F3)
 *   - `renderBlock(id, data, options)` with v2's flat options shape:
 *       `{ format: 'html' | 'react' | 'markdown' | 'docx', theme?, variant? }`
 *     `format: 'docx'` is the v2 spelling — translated to PBC's
 *     `'docx-element'`.
 *   - `renderComposition(composition, options)` analogous translator
 *   - `validateBlockData` / `getBlock` / `listBlockIds` re-exported
 *
 * The migration is "1-line import swap" oriented — these tests pin that
 * the v2 callsite shape works without surgery.
 */

import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  BLOCKS as V2_BLOCKS,
  getBlock,
  listBlockIds,
  renderBlock,
  renderComposition,
  validateBlockData,
  type V2Composition,
  type V2Format,
} from "../../src/compat/flowstudio-v2/index.js";
import { BLOCKS as PBC_BLOCKS } from "../../src/index.js";

describe("WI-509 — v2 compat: registry + utilities re-exports", () => {
  it("V2_BLOCKS exposes the same 23-block registry as the PBC", () => {
    expect(Object.keys(V2_BLOCKS).sort()).toEqual(Object.keys(PBC_BLOCKS).sort());
  });

  it("getBlock / listBlockIds work against the same registry", () => {
    expect(getBlock("A1")).toBe(V2_BLOCKS.A1);
    expect(listBlockIds()).toHaveLength(23);
  });

  it("validateBlockData accepts a valid payload", () => {
    expect(validateBlockData("A1", { headline: "Hi" }).ok).toBe(true);
    expect(validateBlockData("A1", {}).ok).toBe(false);
  });
});

describe("WI-509 — v2 compat: renderBlock format translation", () => {
  it("format: 'html' produces a string with the pbc-* wrapper class", () => {
    const result = renderBlock("A1", { headline: "Hi" }, { format: "html" });
    expect(typeof result.content).toBe("string");
    expect(result.content as string).toContain("pbc-A1");
    expect(result.content as string).toContain('data-block-id="A1"');
  });

  it("format: 'markdown' returns the marker comment + body", () => {
    const result = renderBlock("A1", { headline: "Hi" }, { format: "markdown" });
    expect(typeof result.content).toBe("string");
    expect(result.content as string).toContain("<!-- pbc:A1 -->");
  });

  it("format: 'react' returns a renderable React node", () => {
    const result = renderBlock("A1", { headline: "Hi" }, { format: "react" });
    const markup = renderToStaticMarkup(result.content as ReactNode);
    expect(markup).toContain("pbc-A1");
  });

  it("format: 'docx' (v2 spelling) routes through to the docx-element adapter", () => {
    const result = renderBlock("A1", { headline: "Hi" }, { format: "docx" });
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.metadata?.output).toBe("docx-element");
  });

  it("forwards variant through to the wrapper class", () => {
    const result = renderBlock(
      "A1",
      { headline: "Hi" },
      { format: "html", variant: "split-half" },
    );
    expect(result.content as string).toContain("pbc-A1--split-half");
  });
});

describe("WI-509 — v2 compat: renderComposition orchestration", () => {
  it("translates a v2 composition into PBC results", async () => {
    const composition: V2Composition = {
      blocks: [
        { id: "A1", data: { headline: "Top" } },
        { id: "F3", data: {} },
      ],
    };
    const results = await renderComposition(composition, { format: "html" });
    expect(results).toHaveLength(2);
    expect(results[0].content as string).toContain("pbc-A1");
    expect(results[1].content as string).toContain("pbc-F3");
  });

  it("propagates per-block variant and the docx format alias", async () => {
    const composition: V2Composition = {
      blocks: [{ id: "A1", data: { headline: "Hi" }, variant: "overlay-text" }],
    };
    const [result] = await renderComposition(composition, { format: "docx" });
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.metadata?.variant).toBe("overlay-text");
  });
});

describe("WI-509 — v2 compat: format value validation", () => {
  it("throws on an unknown format value", () => {
    // @ts-expect-error — runtime guard for v2 callers passing bad input
    const bad: { format: V2Format } = { format: "pdf" };
    expect(() => renderBlock("A1", { headline: "Hi" }, bad)).toThrow(/format/i);
  });
});

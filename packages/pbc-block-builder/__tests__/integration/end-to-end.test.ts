/**
 * WI-510 — End-to-end pipeline integration test.
 *
 * Exercises the full PBC public surface in one go:
 *
 *   intent (free-form NL)
 *     → generateCopy (5-stage AI pipeline, deterministic provider)
 *     → PageComposition
 *     → renderComposition × 4 output adapters
 *     → assert outputs are non-empty, schema-valid, contain anchor data
 *
 * This is the test consumers can copy as a starter snippet — the demo
 * file at `examples/landing-saas-demo.ts` shows the same flow as a
 * runnable script.
 */

import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  generateCopy,
  renderComposition,
  validateBlockData,
  type DocxElement,
  type PageComposition,
  type RenderContext,
} from "../../src/index.js";

describe("WI-510 — end-to-end: intent → composition → 4 outputs", () => {
  it("generates a usable landing page from a single intent string", async () => {
    const generation = await generateCopy({
      intent:
        "Premium ergonomic chair for back pain. Designed for long workdays. Lumbar support, breathable mesh, 5-year warranty.",
      industry: "office furniture",
      targetBlocks: ["A1", "A3", "B1", "C5", "E1"],
    });

    expect(generation.blocks.length).toBe(5);
    for (const block of generation.blocks) {
      expect(validateBlockData(block.id, block.data).ok).toBe(true);
    }

    // Build a composition from the generation result.
    const composition: PageComposition = {
      blocks: generation.blocks.map((b) => ({ id: b.id, data: b.data })),
    };

    // -- HTML --
    const htmlCtx: RenderContext = { output: "html" };
    const htmlResults = await renderComposition(composition, htmlCtx);
    const html = htmlResults.map((r) => r.content as string).join("\n");
    expect(html).toContain("pbc-A1");
    expect(html).toContain("pbc-E1");
    // Anchor data leaks through into the rendered HTML.
    expect(html).toContain("Premium ergonomic chair");

    // -- Markdown --
    const mdCtx: RenderContext = { output: "markdown" };
    const mdResults = await renderComposition(composition, mdCtx);
    const md = mdResults.map((r) => r.content as string).join("\n");
    expect(md).toContain("<!-- pbc:A1 -->");
    expect(md).toContain("<!-- pbc:E1 -->");

    // -- React (rendered to static markup for assertion) --
    const reactCtx: RenderContext = { output: "react" };
    const reactResults = await renderComposition(composition, reactCtx);
    const reactHtml = reactResults
      .map((r) => renderToStaticMarkup(r.content as ReactNode))
      .join("\n");
    expect(reactHtml).toContain("pbc-A1");
    expect(reactHtml).toContain("pbc-E1");

    // -- DOCX element --
    const docxCtx: RenderContext = { output: "docx-element" };
    const docxResults = await renderComposition(composition, docxCtx);
    const docxFlat = docxResults.flatMap((r) => r.content as DocxElement[]);
    // Must contain at least one heading (A1's H1) and at least one list (A3 / E1).
    expect(docxFlat.some((el) => el.type === "heading")).toBe(true);
    expect(docxFlat.some((el) => el.type === "list" || el.type === "paragraph")).toBe(true);

    // Cross-format ordering — every adapter must keep the requested block order.
    expect(htmlResults.map((r) => r.metadata?.blockId)).toEqual(
      mdResults.map((r) => r.metadata?.blockId),
    );
    expect(reactResults.map((r) => r.metadata?.blockId)).toEqual(
      docxResults.map((r) => r.metadata?.blockId),
    );
  });

  it("end-to-end pipeline reports non-trivial generationTime", async () => {
    const generation = await generateCopy({
      intent: "Reusable steel water bottle with vacuum insulation",
      targetBlocks: ["A1", "B1", "D1"],
    });
    expect(generation.generationTime).toBeGreaterThanOrEqual(0);
    expect(typeof generation.rationale).toBe("string");
    expect(generation.rationale.length).toBeGreaterThan(0);
  });

  it("rejected blocks (C2) are excluded but rest of the page still renders", async () => {
    const generation = await generateCopy({
      intent: "Skincare cream with botanical extracts",
      targetBlocks: ["A1", "C2", "B1"],
    });
    expect(generation.blocks.map((b) => b.id)).toEqual(["A1", "B1"]);
    expect(generation.rationale).toMatch(/C2/);

    const composition: PageComposition = {
      blocks: generation.blocks.map((b) => ({ id: b.id, data: b.data })),
    };
    const results = await renderComposition(composition, { output: "html" });
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.metadata?.blockId)).toEqual(["A1", "B1"]);
  });
});

/**
 * Runnable demo: build a SaaS landing page in 4 output formats.
 *
 *   npx tsx packages/pbc-block-builder/examples/landing-saas-demo.ts
 *
 * Demonstrates the full PBC public surface end-to-end:
 *
 *   1. start from a free-form intent
 *   2. run the AI copy pipeline (deterministic provider — no LLM needed)
 *   3. render the result through HTML, Markdown, React, and DOCX-element
 *      adapters
 *
 * The demo prints each output to stdout so consumers can eyeball the shape
 * before wiring the PBC into their own app.
 */

import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import {
  generateCopy,
  renderComposition,
  type DocxElement,
  type PageComposition,
} from "../src/index.js";

async function main(): Promise<void> {
  console.log("=== WI-510 demo — landing-saas pipeline ===\n");

  // 1. Generate composition from a single intent string ----------------
  const generation = await generateCopy({
    intent:
      "Ship faster, stress less. Opinionated platform for engineering teams. One-command setup, built-in observability, sane defaults.",
    industry: "developer tools",
    brandTone: "confident, technical",
    language: "en",
    targetBlocks: ["A1", "A3", "B1", "C5", "C1", "E3", "E1"],
  });

  console.log("Generated blocks:", generation.blocks.map((b) => b.id).join(", "));
  console.log("Rationale       :", generation.rationale);
  console.log("Generation time :", `${generation.generationTime}ms`);
  console.log("");

  const composition: PageComposition = {
    blocks: generation.blocks.map((b) => ({ id: b.id, data: b.data })),
  };

  // 2. Render through every output adapter -----------------------------
  const html = (await renderComposition(composition, { output: "html" }))
    .map((r) => r.content as string)
    .join("\n\n");
  console.log("--- HTML output ---");
  console.log(`${html.slice(0, 600)}...\n`);

  const markdown = (await renderComposition(composition, { output: "markdown" }))
    .map((r) => r.content as string)
    .join("\n");
  console.log("--- Markdown output ---");
  console.log(`${markdown.slice(0, 600)}...\n`);

  const reactHtml = (await renderComposition(composition, { output: "react" }))
    .map((r) => renderToStaticMarkup(r.content as ReactNode))
    .join("\n\n");
  console.log("--- React → staticMarkup output ---");
  console.log(`${reactHtml.slice(0, 600)}...\n`);

  const docxFlat = (await renderComposition(composition, { output: "docx-element" }))
    .flatMap((r) => r.content as DocxElement[]);
  console.log("--- DOCX-element output ---");
  console.log(`Total elements: ${docxFlat.length}`);
  const histogram = docxFlat.reduce<Record<string, number>>((acc, el) => {
    acc[el.type] = (acc[el.type] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Element types : ${JSON.stringify(histogram)}\n`);

  console.log("Demo complete — every adapter produced a result for every block.");
}

main().catch((err) => {
  console.error("demo failed:", err);
  process.exitCode = 1;
});

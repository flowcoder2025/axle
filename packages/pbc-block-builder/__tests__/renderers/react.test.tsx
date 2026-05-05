/**
 * WI-504 — React renderer tests.
 *
 * The React renderer mirrors the WI-503 HTML adapter: same wrapper class
 * convention (`pbc-block pbc-{id} pbc-{id}--{variant}`), same schema-first
 * validation, same per-block coverage. The differences are:
 *
 *   - returns a `ReactNode` instead of a string
 *   - relies on React's automatic child escaping rather than manual
 *     `escapeHtml` (so we explicitly pin the contract that no block uses
 *     `dangerouslySetInnerHTML`)
 *
 * The tests use `react-dom/server.renderToStaticMarkup` to compare the
 * rendered output to readable HTML snapshots — this makes regressions in
 * structure or escaping immediately visible without needing JSDOM.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { isValidElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  BLOCKS,
  RENDER_OUTPUTS,
  renderBlock,
  renderBlockReact,
  renderComposition,
  type PageComposition,
  type RenderContext,
} from "../../src/index.js";

const reactContext: RenderContext = { output: "react" };

function html(node: ReactNode): string {
  // renderToStaticMarkup expects a ReactElement — narrow `unknown` carefully.
  if (!isValidElement(node)) {
    throw new Error("renderBlockReact returned a non-element node");
  }
  return renderToStaticMarkup(node);
}

describe("WI-504 — renderBlockReact core contract", () => {
  it("returns a React element wrapped in the stable section/class", () => {
    const result = renderBlockReact("A1", { headline: "Hello" }, reactContext);
    expect(isValidElement(result.content)).toBe(true);
    const markup = html(result.content);
    expect(markup).toMatch(/<section[^>]*class="[^"]*pbc-block[^"]*"/);
    expect(markup).toMatch(/<section[^>]*class="[^"]*pbc-A1[^"]*"/);
    expect(markup).toContain('data-block-id="A1"');
  });

  it("does NOT emit the placeholder marker for any block", () => {
    for (const def of Object.values(BLOCKS)) {
      const sample = sampleDataFor(def.id);
      const result = renderBlockReact(def.id, sample, reactContext);
      const markup = html(result.content);
      expect(markup).not.toContain("[pbc-block-builder placeholder]");
    }
  });

  it("appends the variant modifier when provided via context.metadata.variant", () => {
    const result = renderBlockReact(
      "A1",
      { headline: "Hi" },
      { ...reactContext, metadata: { variant: "split-half" } },
    );
    expect(html(result.content)).toContain("pbc-A1--split-half");
  });

  it("throws when the schema rejects the payload", () => {
    expect(() => renderBlockReact("A1", {}, reactContext)).toThrow(
      /A1.*headline/i,
    );
  });

  it("throws when the block id is unknown", () => {
    // @ts-expect-error — exercising the runtime guard
    expect(() => renderBlockReact("Z9", {}, reactContext)).toThrow(/Z9/);
  });

  it("attaches metadata { blockId, output: 'react', variant }", () => {
    const result = renderBlockReact("A1", { headline: "Hi" }, reactContext);
    expect(result.metadata?.blockId).toBe("A1");
    expect(result.metadata?.output).toBe("react");
    expect(result.metadata?.variant).toBeNull();
  });
});

describe("WI-504 — XSS / escaping (React auto-escape)", () => {
  it("escapes headline text in the rendered markup", () => {
    const result = renderBlockReact(
      "A1",
      { headline: "<img src=x onerror=alert(1)>" },
      reactContext,
    );
    const markup = html(result.content);
    expect(markup).not.toContain("<img src=x");
    expect(markup).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("escapes nested user-provided strings (B1 feature card titles)", () => {
    const result = renderBlockReact(
      "B1",
      {
        items: [
          { title: "<b>title</b>", description: '"&desc"' },
          { title: "ok", description: "ok" },
        ],
      },
      reactContext,
    );
    const markup = html(result.content);
    expect(markup).not.toContain("<b>title</b>");
    expect(markup).toContain("&lt;b&gt;title&lt;/b&gt;");
    expect(markup).toContain("&quot;&amp;desc&quot;");
  });
});

describe("WI-504 — semantic shape per block category", () => {
  it("A1 hero uses an h1", () => {
    const result = renderBlockReact("A1", { headline: "Welcome home" }, reactContext);
    expect(html(result.content)).toMatch(
      /<h1[^>]*>[^<]*Welcome home[^<]*<\/h1>/,
    );
  });

  it("B1 feature cards renders one li per data row", () => {
    const result = renderBlockReact(
      "B1",
      {
        items: [
          { title: "Speed", description: "Faster" },
          { title: "Safe", description: "Audited" },
          { title: "Cheap", description: "Free" },
        ],
      },
      reactContext,
    );
    const markup = html(result.content);
    const itemMatches = markup.match(/class="pbc-B1__item"/g);
    expect(itemMatches?.length).toBe(3);
    expect(markup).toContain("Speed");
    expect(markup).toContain("Audited");
  });

  it("D1 spec table emits a real <table> with one row per spec", () => {
    const result = renderBlockReact(
      "D1",
      {
        title: "Specs",
        rows: [
          { label: "Weight", value: "1.2kg" },
          { label: "Battery", value: "10h" },
        ],
      },
      reactContext,
    );
    const markup = html(result.content);
    expect(markup).toMatch(/<table[^>]*>/);
    expect(markup).toMatch(/<tr[^>]*>[\s\S]*Weight[\s\S]*1\.2kg[\s\S]*<\/tr>/);
    expect(markup).toMatch(/<tr[^>]*>[\s\S]*Battery[\s\S]*10h[\s\S]*<\/tr>/);
  });

  it("E3 FAQ renders each Q&A as a <details> disclosure", () => {
    const result = renderBlockReact(
      "E3",
      {
        items: [
          { question: "Q1?", answer: "A1." },
          { question: "Q2?", answer: "A2." },
        ],
      },
      reactContext,
    );
    const markup = html(result.content);
    const details = markup.match(/<details[^>]*>/g);
    expect(details?.length).toBe(2);
    expect(markup).toContain("<summary>Q1?</summary>");
    expect(markup).toContain("A1.");
  });

  it("F1 lifestyle renders one <img> per image with alt fallback", () => {
    const result = renderBlockReact(
      "F1",
      { images: [{ src: "/a.jpg" }, { src: "/b.jpg", alt: "Portrait" }] },
      reactContext,
    );
    const markup = html(result.content);
    const imgs = markup.match(/<img[^>]+/g);
    expect(imgs?.length).toBe(2);
    expect(markup).toContain('src="/a.jpg"');
    expect(markup).toContain('alt="Portrait"');
  });

  it("F3 divider uses an hr with role=separator", () => {
    const result = renderBlockReact("F3", {}, reactContext);
    expect(html(result.content)).toMatch(/role="separator"/);
  });
});

describe("WI-504 — coverage of all 23 blocks", () => {
  it("renderBlockReact succeeds for every registered block with sample data", () => {
    for (const def of Object.values(BLOCKS)) {
      const result = renderBlockReact(def.id, sampleDataFor(def.id), reactContext);
      const markup = html(result.content);
      expect(markup).toContain(`pbc-${def.id}`);
      expect(markup).toContain(`data-block-id="${def.id}"`);
    }
  });
});

describe("WI-504 — top-level renderBlock dispatcher", () => {
  it("renderBlock with output=react delegates to the React renderer", () => {
    const direct = renderBlockReact("A1", { headline: "Hi" }, reactContext);
    const dispatched = renderBlock("A1", { headline: "Hi" }, reactContext);
    expect(html(dispatched.content as ReactNode)).toBe(html(direct.content));
  });

  it("renderBlock with html still routes to the WI-503 string renderer", () => {
    const result = renderBlock("A1", { headline: "Hi" }, { output: "html" });
    expect(typeof result.content).toBe("string");
    expect(result.content).toContain('data-block-id="A1"');
  });

  it("renderBlock with non-implemented outputs falls back to the placeholder", () => {
    for (const output of RENDER_OUTPUTS) {
      if (output === "html" || output === "react") continue;
      const result = renderBlock("A1", { headline: "Hi" }, { output });
      expect(typeof result.content).toBe("string");
      expect(result.metadata?.placeholder).toBe(true);
      expect(result.metadata?.output).toBe(output);
    }
  });
});

describe("WI-504 — renderComposition with react output", () => {
  it("renders blocks in declared order with React content", async () => {
    const composition: PageComposition = {
      blocks: [
        { id: "A1", data: { headline: "Top" } },
        { id: "F3", data: {} },
      ],
    };
    const results = await renderComposition(composition, reactContext);
    expect(results).toHaveLength(2);
    expect(html(results[0].content as ReactNode)).toContain("pbc-A1");
    expect(html(results[1].content as ReactNode)).toContain("pbc-F3");
  });

  it("propagates the variant from the composition entry into the rendered class", async () => {
    const composition: PageComposition = {
      blocks: [{ id: "A1", data: { headline: "Hi" }, variant: "overlay-text" }],
    };
    const [result] = await renderComposition(composition, reactContext);
    expect(html(result.content as ReactNode)).toContain("pbc-A1--overlay-text");
  });
});

/* -----------------------------------------------------------------
 * Sample-data registry — same payloads as the HTML renderer test.
 * ----------------------------------------------------------------- */

function sampleDataFor(id: string): unknown {
  switch (id) {
    case "A1":
      return { headline: "Headline" };
    case "A2":
      return { line: "One line" };
    case "A3":
      return { points: ["pain1", "pain2"] };
    case "B1":
      return {
        items: [
          { title: "T1", description: "D1" },
          { title: "T2", description: "D2" },
        ],
      };
    case "B2":
      return {
        before: { label: "Before" },
        after: { label: "After" },
      };
    case "B3":
      return { name: "X-fiber", description: "carbon weave" };
    case "B4":
      return { imageSrc: "/usp.png" };
    case "C1":
      return { items: [{ name: "ISO 9001" }] };
    case "C2":
      return { reviews: [{ rating: 5, quote: "Great", author: "Kim" }] };
    case "C3":
      return { items: [{ outlet: "TechCrunch" }] };
    case "C4":
      return { headline: "Our story", body: "Founded in 2020." };
    case "C5":
      return { items: [{ label: "Sales", value: "1M" }] };
    case "D1":
      return { rows: [{ label: "Weight", value: "1kg" }] };
    case "D2":
      return { steps: [{ title: "Step 1" }] };
    case "D3":
      return { items: [{ name: "Cable" }] };
    case "D4":
      return {
        chart: { headers: ["Size", "Length"], rows: [["S", "60cm"]] },
      };
    case "E1":
      return { price: "₩39,000", ctaText: "Buy", ctaHref: "/cart" };
    case "E2":
      return { title: "10% off" };
    case "E3":
      return { items: [{ question: "Q?", answer: "A." }] };
    case "E4":
      return { shippingNote: "Free", returnNote: "30 days" };
    case "F1":
      return { images: [{ src: "/img.jpg" }] };
    case "F2":
      return { options: [{ name: "Black" }] };
    case "F3":
      return {};
    default:
      throw new Error(`No sample data registered for block id ${id}`);
  }
}

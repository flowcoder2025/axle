/**
 * WI-503 — HTML renderer tests.
 *
 * The HTML renderer is the first of the four output adapters declared in
 * `pbc-block-builder.md` §8. Per the spec acceptance criteria the renderer
 * must:
 *   - cover all 23 blocks (no `[placeholder]` strings allowed)
 *   - validate input via the block's zod schema before rendering
 *   - escape user-provided text to prevent XSS
 *   - emit a stable wrapper class (`pbc-block pbc-{id} pbc-{id}--{variant}`)
 *     so consumer apps can theme via `RenderContext.theme`
 *   - be reachable via the top-level `renderBlock` / `renderComposition`
 *     dispatcher when `context.output === "html"`
 */

import { describe, expect, it } from "vitest";
import {
  BLOCKS,
  RENDER_OUTPUTS,
  escapeHtml,
  renderBlock,
  renderBlockHtml,
  renderComposition,
  type PageComposition,
  type RenderContext,
} from "../../src/index.js";

const htmlContext: RenderContext = { output: "html" };

describe("WI-503 — escapeHtml utility", () => {
  it("escapes the five HTML metacharacters", () => {
    expect(escapeHtml(`<script>alert("x") & 'y'</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;",
    );
  });

  it("treats null/undefined as empty string", () => {
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(null)).toBe("");
  });

  it("coerces numbers to strings", () => {
    expect(escapeHtml(42)).toBe("42");
  });
});

describe("WI-503 — renderBlockHtml core contract", () => {
  it("returns html content as a string", () => {
    const result = renderBlockHtml("A1", { headline: "Hello" }, htmlContext);
    expect(typeof result.content).toBe("string");
    expect(result.content.length).toBeGreaterThan(0);
  });

  it("does NOT emit the placeholder marker for any block", () => {
    for (const def of Object.values(BLOCKS)) {
      const sample = sampleDataFor(def.id);
      const result = renderBlockHtml(def.id, sample, htmlContext);
      expect(result.content).not.toContain("[pbc-block-builder placeholder]");
    }
  });

  it("wraps every block in a stable pbc-* class", () => {
    const result = renderBlockHtml("A1", { headline: "Hi" }, htmlContext);
    expect(result.content).toMatch(/class="[^"]*pbc-block[^"]*"/);
    expect(result.content).toMatch(/class="[^"]*pbc-A1[^"]*"/);
    expect(result.content).toContain('data-block-id="A1"');
  });

  it("appends the variant modifier when provided via context.metadata.variant", () => {
    const result = renderBlockHtml(
      "A1",
      { headline: "Hi" },
      { ...htmlContext, metadata: { variant: "split-half" } },
    );
    expect(result.content).toContain("pbc-A1--split-half");
  });

  it("throws when the schema rejects the payload", () => {
    expect(() => renderBlockHtml("A1", {}, htmlContext)).toThrow(
      /A1.*headline/i,
    );
  });

  it("throws when the block id is unknown", () => {
    // @ts-expect-error — exercising the runtime guard
    expect(() => renderBlockHtml("Z9", {}, htmlContext)).toThrow(/Z9/);
  });
});

describe("WI-503 — XSS / escaping", () => {
  it("escapes headline text inside the rendered HTML", () => {
    const result = renderBlockHtml(
      "A1",
      { headline: "<img src=x onerror=alert(1)>" },
      htmlContext,
    );
    expect(result.content).not.toContain("<img src=x");
    expect(result.content).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("escapes nested user-provided strings (B1 feature card titles)", () => {
    const result = renderBlockHtml(
      "B1",
      {
        items: [
          { title: "<b>title</b>", description: '"&desc"' },
          { title: "ok", description: "ok" },
        ],
      },
      htmlContext,
    );
    expect(result.content).not.toContain("<b>title</b>");
    expect(result.content).toContain("&lt;b&gt;title&lt;/b&gt;");
    expect(result.content).toContain("&quot;&amp;desc&quot;");
  });
});

describe("WI-503 — semantic shape per block category", () => {
  it("A1 hero uses a heading element", () => {
    const result = renderBlockHtml("A1", { headline: "Welcome home" }, htmlContext);
    expect(result.content).toMatch(/<h1[^>]*>[^<]*Welcome home[^<]*<\/h1>/);
  });

  it("B1 feature cards renders one item per data row", () => {
    const result = renderBlockHtml(
      "B1",
      {
        items: [
          { title: "Speed", description: "Faster" },
          { title: "Safe", description: "Audited" },
          { title: "Cheap", description: "Free" },
        ],
      },
      htmlContext,
    );
    const itemMatches = result.content.match(/class="pbc-B1__item"/g);
    expect(itemMatches?.length).toBe(3);
    expect(result.content).toContain("Speed");
    expect(result.content).toContain("Audited");
  });

  it("D1 spec table emits a real <table> with one row per spec", () => {
    const result = renderBlockHtml(
      "D1",
      {
        title: "Specs",
        rows: [
          { label: "Weight", value: "1.2kg" },
          { label: "Battery", value: "10h" },
        ],
      },
      htmlContext,
    );
    expect(result.content).toMatch(/<table[^>]*>/);
    expect(result.content).toMatch(/<tr[^>]*>[\s\S]*Weight[\s\S]*1\.2kg[\s\S]*<\/tr>/);
    expect(result.content).toMatch(/<tr[^>]*>[\s\S]*Battery[\s\S]*10h[\s\S]*<\/tr>/);
  });

  it("E3 FAQ renders each Q&A as a <details> disclosure", () => {
    const result = renderBlockHtml(
      "E3",
      {
        items: [
          { question: "Q1?", answer: "A1." },
          { question: "Q2?", answer: "A2." },
        ],
      },
      htmlContext,
    );
    const details = result.content.match(/<details[^>]*>/g);
    expect(details?.length).toBe(2);
    expect(result.content).toContain("<summary>Q1?</summary>");
    expect(result.content).toContain("A1.");
  });

  it("F1 lifestyle renders one <img> per image with alt fallback", () => {
    const result = renderBlockHtml(
      "F1",
      { images: [{ src: "/a.jpg" }, { src: "/b.jpg", alt: "Portrait" }] },
      htmlContext,
    );
    const imgs = result.content.match(/<img[^>]+>/g);
    expect(imgs?.length).toBe(2);
    expect(result.content).toContain('src="/a.jpg"');
    expect(result.content).toContain('alt="Portrait"');
  });

  it("F3 divider emits a self-closing element with role=separator", () => {
    const result = renderBlockHtml("F3", {}, htmlContext);
    expect(result.content).toMatch(/role="separator"/);
  });
});

describe("WI-503 — coverage of all 23 blocks", () => {
  it("renderBlockHtml succeeds for every registered block with sample data", () => {
    for (const def of Object.values(BLOCKS)) {
      const result = renderBlockHtml(def.id, sampleDataFor(def.id), htmlContext);
      expect(typeof result.content).toBe("string");
      expect(result.content).toContain(`pbc-${def.id}`);
      expect(result.content).toContain(`data-block-id="${def.id}"`);
    }
  });
});

describe("WI-503 — top-level renderBlock dispatcher", () => {
  it("renderBlock with output=html delegates to the HTML renderer", () => {
    const direct = renderBlockHtml("A1", { headline: "Hi" }, htmlContext);
    const dispatched = renderBlock("A1", { headline: "Hi" }, htmlContext);
    expect(dispatched.content).toBe(direct.content);
  });

  it("every RENDER_OUTPUT now has a real renderer (no placeholder fallback after WI-506)", () => {
    for (const output of RENDER_OUTPUTS) {
      const result = renderBlock("A1", { headline: "Hi" }, { output });
      expect(result.metadata?.placeholder).not.toBe(true);
      expect(result.metadata?.output).toBe(output);
    }
  });
});

describe("WI-503 — renderComposition orchestration", () => {
  it("renders blocks in declared order and returns one result per entry", async () => {
    const composition: PageComposition = {
      blocks: [
        { id: "A1", data: { headline: "Top" } },
        { id: "B1", data: { items: [{ title: "X", description: "Y" }, { title: "X2", description: "Y2" }] } },
        { id: "F3", data: {} },
      ],
    };
    const results = await renderComposition(composition, htmlContext);
    expect(results).toHaveLength(3);
    expect(results[0].content).toContain("pbc-A1");
    expect(results[1].content).toContain("pbc-B1");
    expect(results[2].content).toContain("pbc-F3");
  });

  it("propagates the variant from the composition entry into the rendered class", async () => {
    const composition: PageComposition = {
      blocks: [{ id: "A1", data: { headline: "Hi" }, variant: "overlay-text" }],
    };
    const [result] = await renderComposition(composition, htmlContext);
    expect(result.content).toContain("pbc-A1--overlay-text");
  });
});

/* -----------------------------------------------------------------
 * Sample-data registry — the smallest payload that satisfies each
 * block's zod schema. Keeps the cross-cutting tests above terse.
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

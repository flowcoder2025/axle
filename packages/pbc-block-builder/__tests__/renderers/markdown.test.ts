/**
 * WI-505 — Markdown renderer tests.
 *
 * Markdown is the third of four output adapters from `pbc-block-builder.md`
 * §8. Unlike the HTML / React adapters, Markdown has no wrapper element —
 * each block emits a `<!-- pbc:{id} variant=… -->` HTML comment marker
 * (preserved by CommonMark + most processors) so consumers can locate
 * blocks in mixed-source documents and so snapshot tests have a stable
 * grep target.
 *
 * Markdown control characters (`*`, `_`, `[`, `]`, `\``, `|`, `<`, `>`,
 * `\\`) are escaped in user-provided content; otherwise a headline like
 * "Buy *now*" would render bold rather than the literal text. URL-bearing
 * fields encode parentheses to avoid breaking `[label](url)` syntax.
 */

import { describe, expect, it } from "vitest";
import {
  BLOCKS,
  RENDER_OUTPUTS,
  escapeMarkdown,
  renderBlock,
  renderBlockMarkdown,
  renderComposition,
  type PageComposition,
  type RenderContext,
} from "../../src/index.js";

const mdContext: RenderContext = { output: "markdown" };

describe("WI-505 — escapeMarkdown utility", () => {
  it("escapes the markdown control characters", () => {
    expect(escapeMarkdown("a*b_c[d]e`f|g<h>i\\j")).toBe(
      "a\\*b\\_c\\[d\\]e\\`f\\|g\\<h\\>i\\\\j",
    );
  });

  it("treats null/undefined as empty string", () => {
    expect(escapeMarkdown(undefined)).toBe("");
    expect(escapeMarkdown(null)).toBe("");
  });

  it("coerces numbers to strings", () => {
    expect(escapeMarkdown(42)).toBe("42");
  });
});

describe("WI-505 — renderBlockMarkdown core contract", () => {
  it("returns a string containing a pbc-marker comment", () => {
    const result = renderBlockMarkdown("A1", { headline: "Hello" }, mdContext);
    expect(typeof result.content).toBe("string");
    expect(result.content).toContain("<!-- pbc:A1 -->");
  });

  it("includes the variant in the marker when supplied", () => {
    const result = renderBlockMarkdown(
      "A1",
      { headline: "Hi" },
      { ...mdContext, metadata: { variant: "split-half" } },
    );
    expect(result.content).toContain("<!-- pbc:A1 variant=split-half -->");
  });

  it("does NOT emit the placeholder marker for any block", () => {
    for (const def of Object.values(BLOCKS)) {
      const sample = sampleDataFor(def.id);
      const result = renderBlockMarkdown(def.id, sample, mdContext);
      expect(result.content).not.toContain("[pbc-block-builder placeholder]");
    }
  });

  it("throws when the schema rejects the payload", () => {
    expect(() => renderBlockMarkdown("A1", {}, mdContext)).toThrow(
      /A1.*headline/i,
    );
  });

  it("throws when the block id is unknown", () => {
    // @ts-expect-error — exercising the runtime guard
    expect(() => renderBlockMarkdown("Z9", {}, mdContext)).toThrow(/Z9/);
  });

  it("attaches metadata { blockId, output: 'markdown', variant }", () => {
    const result = renderBlockMarkdown(
      "A1",
      { headline: "Hi" },
      { ...mdContext, metadata: { variant: "v1" } },
    );
    expect(result.metadata?.blockId).toBe("A1");
    expect(result.metadata?.output).toBe("markdown");
    expect(result.metadata?.variant).toBe("v1");
  });
});

describe("WI-505 — escaping inside rendered markdown", () => {
  it("escapes markdown control chars in headline text", () => {
    const result = renderBlockMarkdown(
      "A1",
      { headline: "Buy *now* [today]" },
      mdContext,
    );
    expect(result.content).toContain("Buy \\*now\\* \\[today\\]");
    // The asterisks must NOT introduce an emphasized run.
    expect(result.content).not.toMatch(/Buy \*now\*/);
  });

  it("escapes pipe characters inside table cells (D1)", () => {
    const result = renderBlockMarkdown(
      "D1",
      {
        rows: [
          { label: "Pipe|in|label", value: "Pipe|in|value" },
        ],
      },
      mdContext,
    );
    expect(result.content).toContain("Pipe\\|in\\|label");
    expect(result.content).toContain("Pipe\\|in\\|value");
  });
});

describe("WI-505 — semantic shape per block category", () => {
  it("A1 hero uses an H1 line", () => {
    const result = renderBlockMarkdown(
      "A1",
      { headline: "Welcome home" },
      mdContext,
    );
    expect(result.content).toMatch(/^# Welcome home$/m);
  });

  it("A3 problem statement uses a bullet list", () => {
    const result = renderBlockMarkdown(
      "A3",
      { points: ["pain1", "pain2", "pain3"] },
      mdContext,
    );
    const bulletLines = result.content.match(/^- /gm);
    expect(bulletLines?.length).toBe(3);
    expect(result.content).toMatch(/^- pain1$/m);
    expect(result.content).toMatch(/^- pain3$/m);
  });

  it("D1 spec table emits a CommonMark pipe table", () => {
    const result = renderBlockMarkdown(
      "D1",
      {
        title: "Specs",
        rows: [
          { label: "Weight", value: "1.2kg" },
          { label: "Battery", value: "10h" },
        ],
      },
      mdContext,
    );
    // Header divider line is the pipe-table fingerprint.
    expect(result.content).toMatch(/\|\s*-+\s*\|\s*-+\s*\|/);
    expect(result.content).toMatch(/\|\s*Weight\s*\|\s*1\.2kg\s*\|/);
    expect(result.content).toMatch(/\|\s*Battery\s*\|\s*10h\s*\|/);
  });

  it("D2 usage guide uses a numbered list", () => {
    const result = renderBlockMarkdown(
      "D2",
      {
        steps: [
          { title: "First" },
          { title: "Second" },
        ],
      },
      mdContext,
    );
    expect(result.content).toMatch(/^1\.\s+\*\*First\*\*/m);
    expect(result.content).toMatch(/^2\.\s+\*\*Second\*\*/m);
  });

  it("E1 CTA banner emits a markdown link", () => {
    const result = renderBlockMarkdown(
      "E1",
      { price: "₩39,000", ctaText: "Buy now", ctaHref: "/cart" },
      mdContext,
    );
    expect(result.content).toContain("[Buy now](/cart)");
  });

  it("E3 FAQ formats each Q as bold + answer paragraph", () => {
    const result = renderBlockMarkdown(
      "E3",
      {
        items: [
          { question: "Q1?", answer: "A1." },
          { question: "Q2?", answer: "A2." },
        ],
      },
      mdContext,
    );
    expect(result.content).toContain("**Q1?**");
    expect(result.content).toContain("A1.");
    expect(result.content).toContain("**Q2?**");
  });

  it("F1 lifestyle uses ![alt](src) image syntax", () => {
    const result = renderBlockMarkdown(
      "F1",
      { images: [{ src: "/a.jpg" }, { src: "/b.jpg", alt: "Portrait" }] },
      mdContext,
    );
    expect(result.content).toContain("![](/a.jpg)");
    expect(result.content).toContain("![Portrait](/b.jpg)");
  });

  it("F3 divider emits a horizontal rule", () => {
    const result = renderBlockMarkdown("F3", {}, mdContext);
    expect(result.content).toMatch(/^---$/m);
  });
});

describe("WI-505 — coverage of all 23 blocks", () => {
  it("renderBlockMarkdown succeeds for every registered block with sample data", () => {
    for (const def of Object.values(BLOCKS)) {
      const result = renderBlockMarkdown(def.id, sampleDataFor(def.id), mdContext);
      expect(typeof result.content).toBe("string");
      expect(result.content).toContain(`<!-- pbc:${def.id}`);
      expect(result.content.length).toBeGreaterThan(0);
    }
  });
});

describe("WI-505 — top-level renderBlock dispatcher", () => {
  it("renderBlock with output=markdown delegates to the Markdown renderer", () => {
    const direct = renderBlockMarkdown("A1", { headline: "Hi" }, mdContext);
    const dispatched = renderBlock("A1", { headline: "Hi" }, mdContext);
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

describe("WI-505 — renderComposition orchestration", () => {
  it("renders blocks in declared order with markdown content", async () => {
    const composition: PageComposition = {
      blocks: [
        { id: "A1", data: { headline: "Top" } },
        { id: "F3", data: {} },
      ],
    };
    const results = await renderComposition(composition, mdContext);
    expect(results).toHaveLength(2);
    expect(results[0].content).toContain("<!-- pbc:A1 -->");
    expect(results[1].content).toContain("<!-- pbc:F3 -->");
  });

  it("propagates the variant from the composition entry into the marker", async () => {
    const composition: PageComposition = {
      blocks: [{ id: "A1", data: { headline: "Hi" }, variant: "overlay-text" }],
    };
    const [result] = await renderComposition(composition, mdContext);
    expect(result.content).toContain("<!-- pbc:A1 variant=overlay-text -->");
  });
});

/* -----------------------------------------------------------------
 * Sample-data registry — shared with html/react renderer tests.
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

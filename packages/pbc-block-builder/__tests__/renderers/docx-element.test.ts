/**
 * WI-506 — DOCX-element renderer tests.
 *
 * The DOCX-element renderer is the fourth output adapter (`pbc-block-builder.md`
 * §3.1, §8). The spec scopes v1 to text / image / list only — every block
 * must still return *something*, but blocks that can't be expressed with
 * the v1 element vocabulary degrade to text + list approximations rather
 * than emitting unsupported types.
 *
 * Element model:
 *   - paragraph  — runs of formatted text
 *   - heading    — paragraph with a heading level (1..4)
 *   - list       — ordered or unordered, items are runs
 *   - image      — src / alt / optional dimensions
 *
 * Tables and complex layouts (D1 spec table, D4 size guide, B2 before/after,
 * B4 callouts) degrade to a heading + list of `Label: Value` rows so the
 * downstream DOCX writer never sees an unknown element kind.
 */

import { describe, expect, it } from "vitest";
import {
  BLOCKS,
  RENDER_OUTPUTS,
  renderBlock,
  renderBlockDocxElement,
  renderComposition,
  type DocxElement,
  type PageComposition,
  type RenderContext,
} from "../../src/index.js";

const docxContext: RenderContext = { output: "docx-element" };

const SUPPORTED_ELEMENT_TYPES = new Set(["paragraph", "heading", "list", "image"]);

function flatten(elements: DocxElement[]): DocxElement[] {
  return elements;
}

function findFirst<T extends DocxElement["type"]>(
  elements: DocxElement[],
  type: T,
): Extract<DocxElement, { type: T }> | undefined {
  return elements.find((el) => el.type === type) as
    | Extract<DocxElement, { type: T }>
    | undefined;
}

function plainText(el: DocxElement): string {
  if (el.type === "paragraph" || el.type === "heading") {
    return el.runs.map((r) => r.text).join("");
  }
  if (el.type === "list") {
    return el.items
      .map((it) => it.runs.map((r) => r.text).join(""))
      .join("\n");
  }
  return "";
}

describe("WI-506 — renderBlockDocxElement core contract", () => {
  it("returns an array of DocxElement", () => {
    const result = renderBlockDocxElement("A1", { headline: "Hello" }, docxContext);
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);
  });

  it("attaches metadata { blockId, output, variant }", () => {
    const result = renderBlockDocxElement(
      "A1",
      { headline: "Hi" },
      { ...docxContext, metadata: { variant: "split-half" } },
    );
    expect(result.metadata?.blockId).toBe("A1");
    expect(result.metadata?.output).toBe("docx-element");
    expect(result.metadata?.variant).toBe("split-half");
  });

  it("throws when the schema rejects the payload", () => {
    expect(() => renderBlockDocxElement("A1", {}, docxContext)).toThrow(
      /A1.*headline/i,
    );
  });

  it("throws when the block id is unknown", () => {
    // @ts-expect-error — exercising the runtime guard
    expect(() => renderBlockDocxElement("Z9", {}, docxContext)).toThrow(/Z9/);
  });
});

describe("WI-506 — element vocabulary stays inside text/image/list", () => {
  it("every block's elements use only supported types", () => {
    for (const def of Object.values(BLOCKS)) {
      const result = renderBlockDocxElement(def.id, sampleDataFor(def.id), docxContext);
      for (const el of flatten(result.content)) {
        expect(SUPPORTED_ELEMENT_TYPES.has(el.type)).toBe(true);
      }
    }
  });
});

describe("WI-506 — semantic shape per block", () => {
  it("A1 hero emits a level-1 heading with the headline", () => {
    const result = renderBlockDocxElement(
      "A1",
      { headline: "Welcome home" },
      docxContext,
    );
    const heading = findFirst(result.content, "heading");
    expect(heading).toBeDefined();
    expect(heading!.level).toBe(1);
    expect(plainText(heading!)).toBe("Welcome home");
  });

  it("A3 problem statement emits an unordered list with one item per point", () => {
    const result = renderBlockDocxElement(
      "A3",
      { points: ["pain1", "pain2", "pain3"] },
      docxContext,
    );
    const list = findFirst(result.content, "list");
    expect(list).toBeDefined();
    expect(list!.ordered).toBe(false);
    expect(list!.items).toHaveLength(3);
    expect(list!.items.map((it) => it.runs.map((r) => r.text).join(""))).toEqual([
      "pain1",
      "pain2",
      "pain3",
    ]);
  });

  it("D2 usage guide emits an ORDERED list (numbered steps)", () => {
    const result = renderBlockDocxElement(
      "D2",
      {
        steps: [
          { title: "First" },
          { title: "Second" },
        ],
      },
      docxContext,
    );
    const list = findFirst(result.content, "list");
    expect(list).toBeDefined();
    expect(list!.ordered).toBe(true);
    expect(list!.items).toHaveLength(2);
  });

  it("D1 spec table degrades to a list of 'Label: Value' items", () => {
    const result = renderBlockDocxElement(
      "D1",
      {
        rows: [
          { label: "Weight", value: "1.2kg" },
          { label: "Battery", value: "10h" },
        ],
      },
      docxContext,
    );
    const list = findFirst(result.content, "list");
    expect(list).toBeDefined();
    const texts = list!.items.map((it) => it.runs.map((r) => r.text).join(""));
    expect(texts).toContain("Weight: 1.2kg");
    expect(texts).toContain("Battery: 10h");
  });

  it("F1 lifestyle emits image elements (one per photo)", () => {
    const result = renderBlockDocxElement(
      "F1",
      { images: [{ src: "/a.jpg" }, { src: "/b.jpg", alt: "Portrait" }] },
      docxContext,
    );
    const images = result.content.filter((el) => el.type === "image");
    expect(images).toHaveLength(2);
    expect(images[0].type === "image" && images[0].src).toBe("/a.jpg");
    expect(images[1].type === "image" && images[1].alt).toBe("Portrait");
  });

  it("E1 CTA banner emits paragraph runs with the CTA link text", () => {
    const result = renderBlockDocxElement(
      "E1",
      { price: "₩39,000", ctaText: "Buy now", ctaHref: "/cart" },
      docxContext,
    );
    const flat = result.content
      .map(plainText)
      .filter((t) => t.length > 0)
      .join("\n");
    expect(flat).toContain("₩39,000");
    expect(flat).toContain("Buy now");
  });

  it("F3 divider degrades to a paragraph (no native divider element in v1)", () => {
    const result = renderBlockDocxElement("F3", {}, docxContext);
    expect(result.content.length).toBeGreaterThan(0);
    for (const el of result.content) {
      expect(SUPPORTED_ELEMENT_TYPES.has(el.type)).toBe(true);
    }
  });
});

describe("WI-506 — text formatting (bold / italic) on runs", () => {
  it("B1 feature card titles are emitted as bold runs", () => {
    const result = renderBlockDocxElement(
      "B1",
      {
        items: [
          { title: "Speed", description: "Faster" },
          { title: "Safe", description: "Audited" },
        ],
      },
      docxContext,
    );
    // Find the bolded title runs anywhere in the element list.
    const allRuns = result.content.flatMap((el) => {
      if (el.type === "paragraph" || el.type === "heading") return el.runs;
      if (el.type === "list") return el.items.flatMap((it) => it.runs);
      return [];
    });
    const boldedTitles = allRuns
      .filter((r) => r.bold)
      .map((r) => r.text);
    expect(boldedTitles).toContain("Speed");
    expect(boldedTitles).toContain("Safe");
  });
});

describe("WI-506 — coverage of all 23 blocks", () => {
  it("renderBlockDocxElement succeeds for every registered block with sample data", () => {
    for (const def of Object.values(BLOCKS)) {
      const result = renderBlockDocxElement(def.id, sampleDataFor(def.id), docxContext);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
    }
  });
});

describe("WI-506 — top-level renderBlock dispatcher", () => {
  it("renderBlock with output=docx-element delegates to the DOCX renderer", () => {
    const direct = renderBlockDocxElement("A1", { headline: "Hi" }, docxContext);
    const dispatched = renderBlock("A1", { headline: "Hi" }, docxContext);
    expect(dispatched.content).toEqual(direct.content);
  });

  it("renderBlock now covers every RENDER_OUTPUT (no placeholder fallback)", () => {
    for (const output of RENDER_OUTPUTS) {
      const result = renderBlock("A1", { headline: "Hi" }, { output });
      expect(result.metadata?.placeholder).not.toBe(true);
      expect(result.metadata?.output).toBe(output);
    }
  });
});

describe("WI-506 — renderComposition orchestration", () => {
  it("renders blocks in declared order with DOCX content", async () => {
    const composition: PageComposition = {
      blocks: [
        { id: "A1", data: { headline: "Top" } },
        { id: "F3", data: {} },
      ],
    };
    const results = await renderComposition(composition, docxContext);
    expect(results).toHaveLength(2);
    expect(results[0].metadata?.blockId).toBe("A1");
    expect(results[1].metadata?.blockId).toBe("F3");
    for (const r of results) {
      expect(Array.isArray(r.content)).toBe(true);
    }
  });

  it("propagates the variant from the composition entry into metadata", async () => {
    const composition: PageComposition = {
      blocks: [{ id: "A1", data: { headline: "Hi" }, variant: "overlay-text" }],
    };
    const [result] = await renderComposition(composition, docxContext);
    expect(result.metadata?.variant).toBe("overlay-text");
  });
});

/* -----------------------------------------------------------------
 * Sample-data registry — shared with html/react/markdown renderers.
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

import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  BLOCK_CATEGORIES,
  LOCALES,
  RENDER_OUTPUTS,
  type BlockBuilderEngine,
  type BlockCategory,
  type BlockDefinition,
  type BlockId,
  type CopyGenerationRequest,
  type CopyGenerationResult,
  type PageComposition,
  type RenderContext,
  type RenderResult,
} from "../src/index.js";

describe("pbc-block-builder type contract (WI-501)", () => {
  it("declares exactly 6 block categories (spec §3.1)", () => {
    expect(BLOCK_CATEGORIES).toHaveLength(6);
    expect(new Set(BLOCK_CATEGORIES).size).toBe(6);
    expect(BLOCK_CATEGORIES).toEqual(["A", "B", "C", "D", "E", "F"]);
  });

  it("declares exactly 4 render output formats (spec §3.1)", () => {
    expect(RENDER_OUTPUTS).toHaveLength(4);
    expect(new Set(RENDER_OUTPUTS).size).toBe(4);
    expect(RENDER_OUTPUTS).toEqual(["html", "markdown", "react", "docx-element"]);
  });

  it("declares the two supported locales", () => {
    expect(LOCALES).toEqual(["ko", "en"]);
  });

  it("BlockId template literal accepts every category + numeric suffix", () => {
    // Compile-time check: each category short name composes a valid BlockId.
    const samples: BlockId[] = ["A1", "B2", "C3", "D4", "E5", "F6"];
    for (const id of samples) {
      const cat = id[0] as BlockCategory;
      expect(BLOCK_CATEGORIES).toContain(cat);
    }
  });
});

describe("pbc-block-builder type contract — structural sanity", () => {
  it("BlockDefinition accepts a zod schema and renders to RenderResult", () => {
    const heroSchema = z.object({ headline: z.string(), subhead: z.string().optional() });
    type HeroData = z.infer<typeof heroSchema>;

    const def: BlockDefinition<HeroData, string> = {
      id: "A1",
      category: "A",
      name: "Hero (skeleton sample)",
      description: "Sample block used only to exercise the type contract.",
      schema: heroSchema,
      render: (data, ctx) => ({
        content: `<h1>${data.headline}</h1>`,
        metadata: { output: ctx.output },
      }),
    };

    const result: RenderResult<string> = def.render(
      { headline: "Hello" },
      { output: "html" },
    );
    expect(result.content).toBe("<h1>Hello</h1>");
    expect(result.metadata?.output).toBe("html");
  });

  it("PageComposition holds an ordered list of block instances", () => {
    const composition: PageComposition = {
      blocks: [
        { id: "A1", data: { headline: "Welcome" } },
        { id: "F1", data: { cta: "Sign up" }, variant: "compact" },
      ],
      theme: "saas-default",
      metadata: { pageId: "home" },
    };
    expect(composition.blocks).toHaveLength(2);
    expect(composition.blocks[1]?.variant).toBe("compact");
  });

  it("RenderContext keeps imageEngine optional + free of pbc-image-engine import", () => {
    const ctxNoEngine: RenderContext = { output: "markdown" };
    const ctxWithEngine: RenderContext = {
      output: "react",
      // The skeleton accepts any value here so the package compiles without
      // @axle/pbc-image-engine present. Consumers narrow via `satisfies`.
      imageEngine: { generate: () => Promise.resolve(null) },
      theme: { colors: {}, typography: {}, spacing: {} },
      locale: "ko",
    };
    expect(ctxNoEngine.imageEngine).toBeUndefined();
    expect(ctxWithEngine.locale).toBe("ko");
  });

  it("CopyGenerationRequest / Result preserve the documented shape", () => {
    const req: CopyGenerationRequest = {
      intent: "Promote a Black Friday sale on a Korean ecommerce site",
      targetBlocks: ["A1", "B2", "F3"],
      industry: "ecommerce",
      brandTone: "playful",
      language: "ko",
    };
    const res: CopyGenerationResult = {
      blocks: [{ id: "A1", data: { headline: "최대 70% 할인" } }],
      rationale: "Selected A1 hero variant for max attention.",
      generationTime: 1234,
    };
    expect(req.targetBlocks).toContain("A1");
    expect(res.blocks).toHaveLength(1);
    expect(res.generationTime).toBeGreaterThan(0);
  });

  it("BlockBuilderEngine is a structural interface — no runtime export expected", () => {
    // Sanity: a minimal stub satisfies the engine contract at type level.
    const stub: BlockBuilderEngine = {
      renderBlock: () => ({ content: "" }),
      renderComposition: async () => [],
      generateCopy: async () => ({ blocks: [], rationale: "stub", generationTime: 0 }),
      validateBlockData: () => ({ ok: true }),
    };
    expect(typeof stub.renderBlock).toBe("function");
  });
});

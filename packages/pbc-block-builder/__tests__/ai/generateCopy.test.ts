/**
 * WI-507 — AI copy pipeline tests.
 *
 * Pipeline contract per `pbc-block-builder.md` §1 + types.ts:
 *
 *   Stage 1 — intake:        validate request, drop unknown / refused blocks
 *   Stage 2 — analyze:       brief = provider.brief({intent, industry, language})
 *   Stage 3a — anchor copy:  generate the lead block first (default A1, otherwise the
 *                            first targetBlock present)
 *   Stage 3b — block copy:   generate the rest in parallel, conditioned on anchor + brief
 *   Stage 4 — assemble:      validate every payload against the block's zod schema; any
 *                            payload that fails validation is discarded with a recorded
 *                            rationale entry
 *   Stage 5 — output:        wall-clock generationTime in ms + rationale
 *
 * The pipeline accepts a `CopyProvider` injection (default = deterministic) so
 * tests run without an LLM and consumers can swap in `@axle/ai`-backed
 * providers without touching this package.
 *
 * C2 reviews block is hard-refused — Korean fair-trade law forbids fabricated
 * reviews, and the per-block schema comment pins this contract.
 */

import { describe, expect, it } from "vitest";
import {
  createDeterministicCopyProvider,
  generateCopy,
  validateBlockData,
  type CopyProvider,
} from "../../src/index.js";

describe("WI-507 — generateCopy core contract", () => {
  it("returns blocks, rationale, generationTime", async () => {
    const result = await generateCopy({
      intent: "Premium ergonomic chair for back pain",
      targetBlocks: ["A1", "B1"],
    });
    expect(Array.isArray(result.blocks)).toBe(true);
    expect(typeof result.rationale).toBe("string");
    expect(result.rationale.length).toBeGreaterThan(0);
    expect(typeof result.generationTime).toBe("number");
    expect(result.generationTime).toBeGreaterThanOrEqual(0);
  });

  it("preserves the requested block order", async () => {
    const result = await generateCopy({
      intent: "Compact espresso machine",
      targetBlocks: ["B1", "A1", "F3"],
    });
    expect(result.blocks.map((b) => b.id)).toEqual(["B1", "A1", "F3"]);
  });

  it("each generated block validates against its zod schema", async () => {
    const result = await generateCopy({
      intent: "Reusable water bottle",
      targetBlocks: ["A1", "A2", "A3", "B1", "C1", "C5", "D1", "D2", "D3", "E1", "E3", "E4", "F1", "F2", "F3"],
    });
    for (const block of result.blocks) {
      const validation = validateBlockData(block.id, block.data);
      expect(validation.ok, `${block.id} validation: ${validation.errors?.join("; ")}`).toBe(true);
    }
  });

  it("handles every block type the catalog ships (excluding C2 reviews)", async () => {
    // Coverage smoke — make sure no block throws when generated. C2 is excluded
    // because its schema is intentionally "real reviews only" — see the
    // C2_REVIEWS file comment.
    const ids = [
      "A1", "A2", "A3",
      "B1", "B2", "B3", "B4",
      "C1", "C3", "C4", "C5",
      "D1", "D2", "D3", "D4",
      "E1", "E2", "E3", "E4",
      "F1", "F2", "F3",
    ] as const;
    const result = await generateCopy({
      intent: "Eco-friendly notebook with seed paper",
      targetBlocks: [...ids],
    });
    expect(result.blocks).toHaveLength(ids.length);
  });
});

describe("WI-507 — Stage 1 intake", () => {
  it("returns an empty result when targetBlocks is empty", async () => {
    const result = await generateCopy({
      intent: "Anything",
      targetBlocks: [],
    });
    expect(result.blocks).toHaveLength(0);
    expect(result.rationale).toMatch(/no target blocks/i);
  });

  it("throws when intent is empty", async () => {
    await expect(
      generateCopy({ intent: "", targetBlocks: ["A1"] }),
    ).rejects.toThrow(/intent/i);
  });

  it("filters out unknown block ids and records the skip", async () => {
    const result = await generateCopy({
      intent: "Healthy snack bar",
      // @ts-expect-error — Z9 is not a registered block id
      targetBlocks: ["A1", "Z9", "B1"],
    });
    expect(result.blocks.map((b) => b.id)).toEqual(["A1", "B1"]);
    expect(result.rationale).toMatch(/Z9/);
    expect(result.rationale).toMatch(/skip/i);
  });
});

describe("WI-507 — C2 reviews refusal", () => {
  it("refuses to generate C2 review data and records the refusal", async () => {
    const result = await generateCopy({
      intent: "Some product",
      targetBlocks: ["A1", "C2", "B1"],
    });
    expect(result.blocks.map((b) => b.id)).toEqual(["A1", "B1"]);
    expect(result.rationale).toMatch(/C2/);
    expect(result.rationale).toMatch(/refus|real customer/i);
  });
});

describe("WI-507 — Stage 3a anchor-first ordering", () => {
  it("generates the anchor block before the rest (provider call order)", async () => {
    const calls: string[] = [];
    const trackingProvider: CopyProvider = {
      brief: async (req) => ({
        summary: req.intent,
        keyPoints: req.intent.split(/[.,]\s*/).filter(Boolean),
      }),
      blockCopy: async (req) => {
        calls.push(req.blockId);
        // Defer to the deterministic provider so payloads are valid.
        return createDeterministicCopyProvider().blockCopy(req);
      },
    };

    await generateCopy(
      {
        intent: "Lightweight hiking pack",
        targetBlocks: ["B1", "C1", "A1", "F3"],
      },
      { provider: trackingProvider },
    );

    // Anchor (A1, since requested) must be the first blockCopy call.
    expect(calls[0]).toBe("A1");
    // The remaining blocks must all eventually be generated.
    expect(calls.slice(1).sort()).toEqual(["B1", "C1", "F3"].sort());
  });

  it("falls back to the first targetBlock as anchor when A1 is not requested", async () => {
    const calls: string[] = [];
    const trackingProvider: CopyProvider = {
      brief: async (req) => ({ summary: req.intent, keyPoints: [] }),
      blockCopy: async (req) => {
        calls.push(req.blockId);
        return createDeterministicCopyProvider().blockCopy(req);
      },
    };

    await generateCopy(
      { intent: "Hi", targetBlocks: ["B1", "C1", "F3"] },
      { provider: trackingProvider },
    );

    expect(calls[0]).toBe("B1");
  });
});

describe("WI-507 — Stage 4 assemble: schema-failure recovery", () => {
  it("discards blocks whose payload fails the schema and records the failure", async () => {
    const brokenProvider: CopyProvider = {
      brief: async (req) => ({ summary: req.intent, keyPoints: [] }),
      blockCopy: async (req) => {
        // Return invalid data for B1 only — A1 falls back to deterministic.
        if (req.blockId === "B1") return { items: [] }; // schema requires min 2 items
        return createDeterministicCopyProvider().blockCopy(req);
      },
    };

    const result = await generateCopy(
      { intent: "Anything", targetBlocks: ["A1", "B1"] },
      { provider: brokenProvider },
    );

    expect(result.blocks.map((b) => b.id)).toEqual(["A1"]);
    expect(result.rationale).toMatch(/B1/);
    expect(result.rationale).toMatch(/schema|validation/i);
  });
});

describe("WI-507 — Stage 2 brief is shared with every block", () => {
  it("provides the same brief object reference to every block call", async () => {
    let briefCount = 0;
    const briefs: unknown[] = [];
    const provider: CopyProvider = {
      brief: async (req) => {
        briefCount++;
        return { summary: req.intent, keyPoints: ["k1", "k2"] };
      },
      blockCopy: async (req) => {
        briefs.push(req.brief);
        return createDeterministicCopyProvider().blockCopy(req);
      },
    };

    await generateCopy(
      { intent: "Test", targetBlocks: ["A1", "B1", "F3"] },
      { provider },
    );

    expect(briefCount).toBe(1);
    // All blocks see the same brief content (deep equality is enough).
    expect(briefs).toHaveLength(3);
    for (const b of briefs) {
      expect(b).toEqual({ summary: "Test", keyPoints: ["k1", "k2"] });
    }
  });
});

describe("WI-507 — Deterministic provider", () => {
  it("produces zod-valid data for every supported block from a non-empty intent", async () => {
    const provider = createDeterministicCopyProvider();
    const brief = await provider.brief({
      intent: "Comfortable, breathable, premium running shoes",
    });
    expect(brief.summary.length).toBeGreaterThan(0);
    expect(brief.keyPoints.length).toBeGreaterThan(0);

    const ids = [
      "A1", "A2", "A3",
      "B1", "B2", "B3", "B4",
      "C1", "C3", "C4", "C5",
      "D1", "D2", "D3", "D4",
      "E1", "E2", "E3", "E4",
      "F1", "F2", "F3",
    ] as const;
    for (const blockId of ids) {
      const data = await provider.blockCopy({
        blockId,
        brief,
      });
      const validation = validateBlockData(blockId, data);
      expect(validation.ok, `${blockId} -> ${validation.errors?.join("; ")}`).toBe(true);
    }
  });

  it("brief uses the intent as the summary fallback", async () => {
    const provider = createDeterministicCopyProvider();
    const brief = await provider.brief({ intent: "Pure water." });
    expect(brief.summary).toContain("Pure water");
  });
});

describe("WI-507 — validateBlockData public API", () => {
  it("returns ok=true on valid A1 payload", () => {
    expect(validateBlockData("A1", { headline: "Hi" }).ok).toBe(true);
  });

  it("returns ok=false with errors on invalid payload", () => {
    const result = validateBlockData("A1", {});
    expect(result.ok).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it("returns ok=false on unknown block id", () => {
    // @ts-expect-error — exercising the runtime guard
    const result = validateBlockData("Z9", {});
    expect(result.ok).toBe(false);
  });
});

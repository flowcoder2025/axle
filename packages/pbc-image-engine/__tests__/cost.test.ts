import { describe, expect, it } from "vitest";
import {
  getEstimatedCost,
  IMAGE_PROVIDERS,
  type AspectRatio,
  type GenerationRequest,
  type ImageProvider,
} from "../src/index.js";

const ASPECTS_FOR_MATRIX: AspectRatio[] = ["1:1", "16:9"];

function req(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return { prompt: "x", mode: "CREATE", ...overrides };
}

describe("getEstimatedCost — provider × aspect matrix is always positive", () => {
  it("returns positive credits and usd for every provider × aspect combination", () => {
    for (const provider of IMAGE_PROVIDERS as readonly ImageProvider[]) {
      for (const aspectRatio of ASPECTS_FOR_MATRIX) {
        const cost = getEstimatedCost(req({ provider, aspectRatio }));
        expect(cost.credits).toBeGreaterThan(0);
        expect(cost.usd).toBeGreaterThan(0);
        expect(Number.isFinite(cost.credits)).toBe(true);
        expect(Number.isFinite(cost.usd)).toBe(true);
      }
    }
  });
});

describe("getEstimatedCost — determinism", () => {
  it("is idempotent for the same input", () => {
    const r = req({ provider: "google-genai", aspectRatio: "3:4", count: 2 });
    const a = getEstimatedCost(r);
    const b = getEstimatedCost(r);
    expect(a).toEqual(b);
  });

  it("scales linearly with count", () => {
    const single = getEstimatedCost(
      req({ provider: "google-genai", count: 1, aspectRatio: "1:1" }),
    );
    const quad = getEstimatedCost(
      req({ provider: "google-genai", count: 4, aspectRatio: "1:1" }),
    );
    expect(quad.usd).toBeCloseTo(single.usd * 4, 4);
  });
});

describe("getEstimatedCost — safe defaults", () => {
  it("never throws on an unknown mode (uses default provider fallback)", () => {
    // Cast forces an invalid mode through the type system to exercise the
    // try/catch around selectProvider.
    const cost = getEstimatedCost({
      prompt: "x",
      mode: "NOT_A_MODE" as GenerationRequest["mode"],
    });
    expect(cost.credits).toBeGreaterThan(0);
    expect(cost.usd).toBeGreaterThan(0);
  });

  it("clamps count<1 to 1", () => {
    const zero = getEstimatedCost(
      req({ provider: "google-genai", count: 0, aspectRatio: "1:1" }),
    );
    const one = getEstimatedCost(
      req({ provider: "google-genai", count: 1, aspectRatio: "1:1" }),
    );
    expect(zero.usd).toBe(one.usd);
  });

  it("clamps count>8 to 8", () => {
    const huge = getEstimatedCost(
      req({ provider: "google-genai", count: 999, aspectRatio: "1:1" }),
    );
    const eight = getEstimatedCost(
      req({ provider: "google-genai", count: 8, aspectRatio: "1:1" }),
    );
    expect(huge.usd).toBe(eight.usd);
  });
});

describe("getEstimatedCost — provider ranking sanity", () => {
  it("local ComfyUI is cheaper than cloud providers", () => {
    const local = getEstimatedCost(req({ provider: "comfyui-local" }));
    const genai = getEstimatedCost(req({ provider: "google-genai" }));
    expect(local.usd).toBeLessThan(genai.usd);
  });
});

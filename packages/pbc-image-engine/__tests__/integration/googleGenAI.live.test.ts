/**
 * Live Google GenAI integration test (WI-409).
 *
 * Runs only when `GEMINI_API_KEY` is present — CI never has the secret, so
 * the test self-skips and contributes 0 cost. When invoked manually
 * (`npm run test:integration -w @axle/pbc-image-engine`), it makes ONE
 * real call to honour the spec's "cost ≤ $0.5" budget.
 *
 * Refresh procedure for the JSON fixtures lives in
 * `__tests__/fixtures/README.md`.
 */

import { describe, expect, it } from "vitest";
import { GoogleGenAIProvider } from "../../src/providers/googleGenAI.js";
import type { GenerationRequest } from "../../src/types.js";

const HAS_KEY = Boolean(
  process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENAI_API_KEY,
);

describe("live — Google GenAI (gated by GEMINI_API_KEY)", () => {
  it.skipIf(!HAS_KEY)(
    "CREATE: returns at least one image (cost ≤ ~$0.04 per call)",
    async () => {
      const provider = new GoogleGenAIProvider();
      const req: GenerationRequest = {
        prompt:
          "a single small grey cube on a white background, minimal product photo",
        mode: "CREATE",
        provider: "google-genai",
        count: 1,
      };

      const result = await provider.generate(req);

      expect(result.provider).toBe("google-genai");
      expect(result.images.length).toBeGreaterThanOrEqual(1);
      const img = result.images[0]!;
      expect(img.mimeType.startsWith("image/")).toBe(true);
      expect(img.base64.length).toBeGreaterThan(100);
      expect(result.duration).toBeGreaterThan(0);
    },
    60_000,
  );
});

describe("live — Google GenAI: skip-when-missing-key sanity", () => {
  it("documents the skip condition (visible in test output)", () => {
    if (!HAS_KEY) {
      // eslint-disable-next-line no-console
      console.log(
        "[live] Skipping Google GenAI live test — set GEMINI_API_KEY to run.",
      );
    }
    expect(true).toBe(true);
  });
});

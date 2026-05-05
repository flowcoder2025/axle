/**
 * Live ComfyUI Local integration test (WI-409).
 *
 * Runs only when `COMFYUI_LIVE=1` is set AND a ComfyUI server is reachable
 * at `COMFYUI_LOCAL_URL` (default `http://127.0.0.1:8188`). CI does not
 * set these, so the test self-skips and contributes 0 cost.
 *
 * Spec budget (`pbc-image-engine.md` §5): one ComfyUI call per integration
 * run — same as the Google live test.
 */

import { describe, expect, it } from "vitest";
import { ComfyUILocalProvider } from "../../src/providers/comfyuiLocal.js";
import type { GenerationRequest } from "../../src/types.js";

const COMFYUI_BASE_URL =
  process.env.COMFYUI_LOCAL_URL ?? "http://127.0.0.1:8188";
const RUN_LIVE = process.env.COMFYUI_LIVE === "1";

describe("live — ComfyUI Local (gated by COMFYUI_LIVE=1)", () => {
  it.skipIf(!RUN_LIVE)(
    "CREATE: submits, polls, and pulls one image",
    async () => {
      const provider = new ComfyUILocalProvider({
        baseUrl: COMFYUI_BASE_URL,
        timeoutMs: 5 * 60 * 1000,
      });

      const req: GenerationRequest = {
        prompt:
          "a single small grey cube on a white background, minimal product photo",
        mode: "CREATE",
        provider: "comfyui-local",
        aspectRatio: "1:1",
      };

      const result = await provider.generate(req);

      expect(result.provider).toBe("comfyui-local");
      expect(result.images.length).toBeGreaterThanOrEqual(1);
      const img = result.images[0]!;
      expect(img.mimeType.startsWith("image/")).toBe(true);
      expect(img.base64.length).toBeGreaterThan(100);
      expect(result.metadata?.promptId).toBeTruthy();
      expect(result.metadata?.workflowId).toBeTruthy();
    },
    10 * 60 * 1000, // 10 min ceiling — workflow can be slow on first load
  );
});

describe("live — ComfyUI Local: skip-when-not-enabled sanity", () => {
  it("documents the skip condition (visible in test output)", () => {
    if (!RUN_LIVE) {
      // eslint-disable-next-line no-console
      console.log(
        `[live] Skipping ComfyUI live test — set COMFYUI_LIVE=1 (+ COMFYUI_LOCAL_URL=${COMFYUI_BASE_URL}) to run.`,
      );
    }
    expect(true).toBe(true);
  });
});

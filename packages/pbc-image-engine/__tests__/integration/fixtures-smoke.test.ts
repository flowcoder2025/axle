/**
 * Fixtures-based smoke tests (WI-409).
 *
 * These run in CI on every push. They wire the fixture JSON files in
 * `__tests__/fixtures/` into a fake `fetch` and exercise the two
 * integration-test providers (Google GenAI + ComfyUI Local) end-to-end —
 * `generate()` returns a populated `GenerationResult`, error paths surface
 * the documented `ImageGenerationError` codes.
 *
 * Live API calls live in `*.live.test.ts` and are gated by env vars; this
 * file proves the response-decoding path stays compatible with the real
 * API shapes we captured in the fixtures.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GoogleGenAIProvider } from "../../src/providers/googleGenAI.js";
import { ComfyUILocalProvider } from "../../src/providers/comfyuiLocal.js";
import {
  ImageGenerationError,
  type GenerationRequest,
} from "../../src/types.js";
import type { FetchLike } from "../../src/providers/types.js";

const FIXTURE_DIR = resolve(__dirname, "../fixtures");

function loadFixture<T = unknown>(name: string): T {
  const raw = readFileSync(resolve(FIXTURE_DIR, name), "utf8");
  return JSON.parse(raw) as T;
}

function loadSamplePngBytes(): Uint8Array {
  const b64 = readFileSync(
    resolve(FIXTURE_DIR, "sample-png-1x1.base64.txt"),
    "utf8",
  ).trim();
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

function bytesResponse(bytes: Uint8Array): Response {
  return new Response(bytes, {
    status: 200,
    headers: { "content-type": "image/png" },
  });
}

describe("fixtures-smoke — Google GenAI decodes the captured shape", () => {
  it("CREATE: extracts inlineData and reports model + duration", async () => {
    const successFixture = loadFixture("google-genai-create-response.json");
    const fetchImpl: FetchLike = async () => jsonResponse(successFixture);

    const provider = new GoogleGenAIProvider({
      apiKey: "fixture-key",
      fetch: fetchImpl,
    });

    const req: GenerationRequest = {
      prompt: "a tiny test image",
      mode: "CREATE",
      provider: "google-genai",
    };
    const result = await provider.generate(req);

    expect(result.provider).toBe("google-genai");
    expect(result.model).toBe("gemini-3-pro-image-preview");
    expect(result.images).toHaveLength(1);
    expect(result.images[0]?.mimeType).toBe("image/png");
    expect(result.images[0]?.base64.length).toBeGreaterThan(0);
    expect(result.metadata?.finishReason).toBe("STOP");
    expect(typeof result.duration).toBe("number");
  });

  it("SAFETY-blocked response → CONTENT_FILTERED", async () => {
    const blockedFixture = loadFixture("google-genai-blocked-response.json");
    const fetchImpl: FetchLike = async () => jsonResponse(blockedFixture);

    const provider = new GoogleGenAIProvider({
      apiKey: "fixture-key",
      fetch: fetchImpl,
    });

    const req: GenerationRequest = {
      prompt: "blocked content",
      mode: "CREATE",
      provider: "google-genai",
    };

    let captured: ImageGenerationError | undefined;
    try {
      await provider.generate(req);
    } catch (e) {
      captured = e as ImageGenerationError;
    }
    expect(captured).toBeInstanceOf(ImageGenerationError);
    expect(captured?.code).toBe("CONTENT_FILTERED");
    expect(captured?.retryable).toBe(false);
  });

  it("HTTP 429 → QUOTA_EXCEEDED + retryable=true", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response("rate limit hit", { status: 429 });

    const provider = new GoogleGenAIProvider({
      apiKey: "fixture-key",
      fetch: fetchImpl,
    });

    let captured: ImageGenerationError | undefined;
    try {
      await provider.generate({
        prompt: "x",
        mode: "CREATE",
        provider: "google-genai",
      });
    } catch (e) {
      captured = e as ImageGenerationError;
    }
    expect(captured?.code).toBe("QUOTA_EXCEEDED");
    expect(captured?.retryable).toBe(true);
  });
});

describe("fixtures-smoke — ComfyUI Local decodes the captured shape", () => {
  it("submit → poll → fetch image: returns one image with metadata", async () => {
    const promptFixture = loadFixture<{ prompt_id: string }>(
      "comfyui-prompt-response.json",
    );
    const historyFixture = loadFixture("comfyui-history-success.json");
    const samplePng = loadSamplePngBytes();

    const calls: string[] = [];
    const fetchImpl: FetchLike = async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(url);
      if (url.endsWith("/prompt")) return jsonResponse(promptFixture);
      if (url.includes("/history/")) return jsonResponse(historyFixture);
      if (url.includes("/view")) return bytesResponse(samplePng);
      throw new Error(`unexpected fetch: ${url}`);
    };

    const provider = new ComfyUILocalProvider({
      baseUrl: "http://fixture.local:8188",
      fetch: fetchImpl,
      sleep: async () => {
        /* no-op for fast polling */
      },
      now: (() => {
        let t = 0;
        return () => (t += 1);
      })(),
    });

    const result = await provider.generate({
      prompt: "a small test render",
      mode: "CREATE",
      provider: "comfyui-local",
    });

    expect(result.provider).toBe("comfyui-local");
    expect(result.images).toHaveLength(1);
    expect(result.images[0]?.mimeType).toBe("image/png");
    expect(result.images[0]?.base64.length).toBeGreaterThan(0);
    expect(result.metadata?.promptId).toBe(promptFixture.prompt_id);

    expect(calls.some((u) => u.endsWith("/prompt"))).toBe(true);
    expect(calls.some((u) => u.includes("/history/"))).toBe(true);
    expect(calls.some((u) => u.includes("/view"))).toBe(true);
  });

  it("execution_error history → ImageGenerationError", async () => {
    const promptFixture = loadFixture<{ prompt_id: string }>(
      "comfyui-prompt-response.json",
    );
    // Re-key the error fixture under the same prompt_id so the adapter finds it.
    const errorFixtureRaw = loadFixture<Record<string, unknown>>(
      "comfyui-history-error.json",
    );
    const erroredEntry = errorFixtureRaw["fixture-prompt-id-error-0002"];
    const historyKeyed = { [promptFixture.prompt_id]: erroredEntry };

    const fetchImpl: FetchLike = async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/prompt")) return jsonResponse(promptFixture);
      if (url.includes("/history/")) return jsonResponse(historyKeyed);
      throw new Error(`unexpected fetch: ${url}`);
    };

    const provider = new ComfyUILocalProvider({
      baseUrl: "http://fixture.local:8188",
      fetch: fetchImpl,
      sleep: async () => {
        /* no-op */
      },
      now: (() => {
        let t = 0;
        return () => (t += 1);
      })(),
    });

    let captured: ImageGenerationError | undefined;
    try {
      await provider.generate({
        prompt: "this run will fail",
        mode: "CREATE",
        provider: "comfyui-local",
      });
    } catch (e) {
      captured = e as ImageGenerationError;
    }
    expect(captured).toBeInstanceOf(ImageGenerationError);
    // The adapter classifies workflow execution errors as UNKNOWN/retryable.
    expect(captured?.code).toBe("UNKNOWN");
    expect(captured?.retryable).toBe(true);
    expect(captured?.message).toContain("execution_error");
  });

  it("/prompt 4xx → INVALID_INPUT (non-retryable)", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response("bad workflow", { status: 400 });

    const provider = new ComfyUILocalProvider({
      baseUrl: "http://fixture.local:8188",
      fetch: fetchImpl,
      sleep: async () => {
        /* no-op */
      },
    });

    let captured: ImageGenerationError | undefined;
    try {
      await provider.generate({
        prompt: "x",
        mode: "CREATE",
        provider: "comfyui-local",
      });
    } catch (e) {
      captured = e as ImageGenerationError;
    }
    expect(captured?.code).toBe("INVALID_INPUT");
    expect(captured?.retryable).toBe(false);
  });
});

describe("fixtures-smoke — fixtures stay loadable + small", () => {
  it("all JSON fixtures parse and the PNG is a real 1x1", () => {
    expect(() =>
      loadFixture("google-genai-create-response.json"),
    ).not.toThrow();
    expect(() =>
      loadFixture("google-genai-blocked-response.json"),
    ).not.toThrow();
    expect(() => loadFixture("comfyui-prompt-response.json")).not.toThrow();
    expect(() => loadFixture("comfyui-history-success.json")).not.toThrow();
    expect(() => loadFixture("comfyui-history-error.json")).not.toThrow();

    const png = loadSamplePngBytes();
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    expect(Array.from(png.slice(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(png.length).toBeLessThan(200); // sanity: stays small
  });
});

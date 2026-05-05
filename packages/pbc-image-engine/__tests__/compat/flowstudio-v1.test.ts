import { afterEach, describe, expect, it, vi } from "vitest";
import {
  V1_DEFAULT_MODEL,
  generateImage,
  ImageGenerationError,
  type V1GenerateImageOptions,
} from "../../src/compat/flowstudio-v1/index.js";
import type { ImageProviderAdapter } from "../../src/providers/types.js";
import type { GenerationRequest, GenerationResult } from "../../src/types.js";

function makeFakeAdapter(
  id: "google-genai" | "openrouter",
): ImageProviderAdapter & { lastRequest: GenerationRequest | null; calls: number } {
  const fake = {
    id,
    lastRequest: null as GenerationRequest | null,
    calls: 0,
    isAvailable: () => true,
    defaultModel: () => V1_DEFAULT_MODEL,
    async generate(req: GenerationRequest): Promise<GenerationResult> {
      fake.lastRequest = req;
      fake.calls += 1;
      return {
        images: [{ base64: "AAAA", mimeType: "image/png" }],
        provider: id,
        model: req.model ?? V1_DEFAULT_MODEL,
        duration: 42,
        metadata: { stub: true },
      };
    },
  };
  return fake as ImageProviderAdapter & {
    lastRequest: GenerationRequest | null;
    calls: number;
  };
}

const baseOpts = (extra: Partial<V1GenerateImageOptions> = {}): V1GenerateImageOptions => ({
  prompt: "studio cat in neon alley",
  ...extra,
});

describe("v1 compat — env resolution (google default + IMAGE_PROVIDER override)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to google when env is unset", async () => {
    vi.stubEnv("IMAGE_PROVIDER", "");
    const google = makeFakeAdapter("google-genai");
    const openrouter = makeFakeAdapter("openrouter");
    await generateImage(baseOpts(), {
      googleProvider: google,
      openRouterProvider: openrouter,
    });
    expect(google.calls).toBe(1);
    expect(openrouter.calls).toBe(0);
  });

  it("respects IMAGE_PROVIDER=openrouter env override", async () => {
    vi.stubEnv("IMAGE_PROVIDER", "openrouter");
    const google = makeFakeAdapter("google-genai");
    const openrouter = makeFakeAdapter("openrouter");
    await generateImage(baseOpts(), {
      googleProvider: google,
      openRouterProvider: openrouter,
    });
    expect(google.calls).toBe(0);
    expect(openrouter.calls).toBe(1);
  });

  it("explicit options.env wins over IMAGE_PROVIDER env", async () => {
    vi.stubEnv("IMAGE_PROVIDER", "openrouter");
    const google = makeFakeAdapter("google-genai");
    const openrouter = makeFakeAdapter("openrouter");
    await generateImage(baseOpts({ env: "google" }), {
      googleProvider: google,
      openRouterProvider: openrouter,
    });
    expect(google.calls).toBe(1);
    expect(openrouter.calls).toBe(0);
  });

  it("treats unrecognized IMAGE_PROVIDER as google", async () => {
    vi.stubEnv("IMAGE_PROVIDER", "vertex"); // not a v1 env value
    const google = makeFakeAdapter("google-genai");
    const openrouter = makeFakeAdapter("openrouter");
    await generateImage(baseOpts(), {
      googleProvider: google,
      openRouterProvider: openrouter,
    });
    expect(google.calls).toBe(1);
  });
});

describe("v1 compat — request translation (v1 options → PBC GenerationRequest)", () => {
  it("CREATE mode when no sourceImage is attached, EDIT when one is", async () => {
    const google = makeFakeAdapter("google-genai");
    await generateImage(baseOpts(), { googleProvider: google });
    expect(google.lastRequest!.mode).toBe("CREATE");

    google.lastRequest = null;
    await generateImage(baseOpts({ sourceImage: "data:image/png;base64,SRC" }), {
      googleProvider: google,
    });
    expect(google.lastRequest!.mode).toBe("EDIT");
    expect(google.lastRequest!.sourceImage).toBe("data:image/png;base64,SRC");
  });

  it("uses V1_DEFAULT_MODEL when options.model is omitted", async () => {
    const google = makeFakeAdapter("google-genai");
    await generateImage(baseOpts(), { googleProvider: google });
    expect(google.lastRequest!.model).toBe("gemini-3-pro-image-preview");
    expect(V1_DEFAULT_MODEL).toBe("gemini-3-pro-image-preview");
  });

  it("forwards explicit model override", async () => {
    const openrouter = makeFakeAdapter("openrouter");
    await generateImage(baseOpts({ env: "openrouter", model: "openai/dall-e-3" }), {
      openRouterProvider: openrouter,
    });
    expect(openrouter.lastRequest!.model).toBe("openai/dall-e-3");
  });

  it("pins provider to google-genai for env=google, openrouter for env=openrouter", async () => {
    const google = makeFakeAdapter("google-genai");
    const openrouter = makeFakeAdapter("openrouter");

    await generateImage(baseOpts({ env: "google" }), { googleProvider: google });
    expect(google.lastRequest!.provider).toBe("google-genai");

    await generateImage(baseOpts({ env: "openrouter" }), { openRouterProvider: openrouter });
    expect(openrouter.lastRequest!.provider).toBe("openrouter");
  });

  it("forwards negativePrompt, aspectRatio, count, refImages, metadata as-is", async () => {
    const google = makeFakeAdapter("google-genai");
    await generateImage(
      baseOpts({
        negativePrompt: "blurry, low quality",
        aspectRatio: "9:16",
        count: 3,
        refImages: ["data:image/png;base64,REF1", "data:image/png;base64,REF2"],
        metadata: { traceId: "abc-123" },
      }),
      { googleProvider: google },
    );
    const req = google.lastRequest!;
    expect(req.negativePrompt).toBe("blurry, low quality");
    expect(req.aspectRatio).toBe("9:16");
    expect(req.count).toBe(3);
    expect(req.refImages).toEqual([
      "data:image/png;base64,REF1",
      "data:image/png;base64,REF2",
    ]);
    expect(req.metadata).toEqual({ traceId: "abc-123" });
  });

  it("does NOT forward fields the caller didn't set (clean GenerationRequest)", async () => {
    const google = makeFakeAdapter("google-genai");
    await generateImage(baseOpts(), { googleProvider: google });
    const req = google.lastRequest!;
    expect(req).not.toHaveProperty("negativePrompt");
    expect(req).not.toHaveProperty("aspectRatio");
    expect(req).not.toHaveProperty("count");
    expect(req).not.toHaveProperty("refImages");
    expect(req).not.toHaveProperty("sourceImage");
    expect(req).not.toHaveProperty("metadata");
  });
});

describe("v1 compat — result translation (PBC GenerationResult → v1 shape)", () => {
  it("maps duration → durationMs and preserves images / provider / model / metadata", async () => {
    const google = makeFakeAdapter("google-genai");
    const result = await generateImage(baseOpts(), { googleProvider: google });
    expect(result).toEqual({
      images: [{ base64: "AAAA", mimeType: "image/png" }],
      provider: "google-genai",
      model: V1_DEFAULT_MODEL,
      durationMs: 42,
      metadata: { stub: true },
    });
  });

  it("never carries PBC's `cost` field (v1 had no cost concept)", async () => {
    const google = makeFakeAdapter("google-genai");
    const result = await generateImage(baseOpts(), { googleProvider: google });
    expect(result).not.toHaveProperty("cost");
    expect(result).not.toHaveProperty("duration"); // renamed to durationMs
  });
});

describe("v1 compat — input validation", () => {
  it("throws INVALID_INPUT for missing/empty prompt", async () => {
    const google = makeFakeAdapter("google-genai");
    let captured: ImageGenerationError | undefined;
    try {
      await generateImage(
        { prompt: "  " } as V1GenerateImageOptions,
        { googleProvider: google },
      );
    } catch (e) {
      captured = e as ImageGenerationError;
    }
    expect(captured).toBeInstanceOf(ImageGenerationError);
    expect(captured!.code).toBe("INVALID_INPUT");
    expect(google.calls).toBe(0);
  });

  it("re-exports ImageGenerationError so migrating code keeps one import root", () => {
    expect(ImageGenerationError).toBeDefined();
    const err = new ImageGenerationError("boom", "QUOTA_EXCEEDED", true);
    expect(err.code).toBe("QUOTA_EXCEEDED");
    expect(err.retryable).toBe(true);
  });
});

describe("v1 compat — error normalization (BREAKING change documented in §3)", () => {
  it("propagates underlying provider errors as ImageGenerationError", async () => {
    const failing: ImageProviderAdapter = {
      id: "google-genai",
      isAvailable: () => true,
      defaultModel: () => "x",
      async generate() {
        throw new ImageGenerationError("rate limit", "QUOTA_EXCEEDED", true);
      },
    };
    let captured: ImageGenerationError | undefined;
    try {
      await generateImage(baseOpts(), { googleProvider: failing });
    } catch (e) {
      captured = e as ImageGenerationError;
    }
    expect(captured?.code).toBe("QUOTA_EXCEEDED");
    expect(captured?.retryable).toBe(true);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RE_DEFAULT_MODEL,
  generateImage,
  ImageGenerationError,
  type ReGenerateImageOptions,
} from "../../src/compat/flowstudio-re/index.js";
import { V1_DEFAULT_MODEL } from "../../src/compat/flowstudio-v1/generateImage.js";
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
    defaultModel: () => RE_DEFAULT_MODEL,
    async generate(req: GenerationRequest): Promise<GenerationResult> {
      fake.lastRequest = req;
      fake.calls += 1;
      return {
        images: [{ base64: "AAAA", mimeType: "image/png" }],
        provider: id,
        model: req.model ?? RE_DEFAULT_MODEL,
        duration: 99,
        metadata: { stub: "re" },
      };
    },
  };
  return fake as ImageProviderAdapter & {
    lastRequest: GenerationRequest | null;
    calls: number;
  };
}

const baseOpts = (extra: Partial<ReGenerateImageOptions> = {}): ReGenerateImageOptions => ({
  prompt: "re studio cat in neon alley",
  ...extra,
});

describe("re compat — pins to v1 default model (fork keeps v1 baseline)", () => {
  it("RE_DEFAULT_MODEL equals V1_DEFAULT_MODEL until divergence is documented", () => {
    expect(RE_DEFAULT_MODEL).toBe(V1_DEFAULT_MODEL);
    expect(RE_DEFAULT_MODEL).toBe("gemini-3-pro-image-preview");
  });
});

describe("re compat — env resolution (google default + IMAGE_PROVIDER override)", () => {
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
});

describe("re compat — request translation (re options → PBC GenerationRequest)", () => {
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

  it("uses RE_DEFAULT_MODEL when options.model is omitted", async () => {
    const google = makeFakeAdapter("google-genai");
    await generateImage(baseOpts(), { googleProvider: google });
    expect(google.lastRequest!.model).toBe(RE_DEFAULT_MODEL);
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
        refImages: ["data:image/png;base64,REF1"],
        metadata: { traceId: "re-abc-123" },
      }),
      { googleProvider: google },
    );
    const req = google.lastRequest!;
    expect(req.negativePrompt).toBe("blurry, low quality");
    expect(req.aspectRatio).toBe("9:16");
    expect(req.count).toBe(3);
    expect(req.refImages).toEqual(["data:image/png;base64,REF1"]);
    expect(req.metadata).toEqual({ traceId: "re-abc-123" });
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

describe("re compat — result translation (PBC GenerationResult → re shape)", () => {
  it("maps duration → durationMs and preserves images / provider / model / metadata", async () => {
    const google = makeFakeAdapter("google-genai");
    const result = await generateImage(baseOpts(), { googleProvider: google });
    expect(result).toEqual({
      images: [{ base64: "AAAA", mimeType: "image/png" }],
      provider: "google-genai",
      model: RE_DEFAULT_MODEL,
      durationMs: 99,
      metadata: { stub: "re" },
    });
  });

  it("never carries PBC's `cost` field (re inherits v1's no-cost shape)", async () => {
    const google = makeFakeAdapter("google-genai");
    const result = await generateImage(baseOpts(), { googleProvider: google });
    expect(result).not.toHaveProperty("cost");
    expect(result).not.toHaveProperty("duration");
  });
});

describe("re compat — input validation", () => {
  it("throws INVALID_INPUT for missing/empty prompt", async () => {
    const google = makeFakeAdapter("google-genai");
    let captured: ImageGenerationError | undefined;
    try {
      await generateImage(
        { prompt: "  " } as ReGenerateImageOptions,
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

describe("re compat — error normalization (BREAKING — same as v1 §3)", () => {
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

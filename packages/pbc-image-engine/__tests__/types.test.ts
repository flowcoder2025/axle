import { describe, expect, it } from "vitest";
import {
  ASPECT_RATIOS,
  ERROR_CODES,
  GENERATION_MODES,
  IMAGE_PROVIDERS,
  ImageGenerationError,
  REFERENCE_MODES,
  type GenerationMode,
  type GenerationRequest,
  type GenerationResult,
  type ImageEngine,
  type ImageProvider,
} from "../src/index.js";

describe("pbc-image-engine type contract", () => {
  it("declares exactly 5 image providers (spec §3.1)", () => {
    expect(IMAGE_PROVIDERS).toHaveLength(5);
    expect(new Set(IMAGE_PROVIDERS).size).toBe(5);
    expect(IMAGE_PROVIDERS).toEqual([
      "google-genai",
      "vertex-ai",
      "openrouter",
      "comfyui-local",
      "comfyui-cloud",
    ]);
  });

  it("declares exactly 7 generation modes (spec §3.1)", () => {
    expect(GENERATION_MODES).toHaveLength(7);
    expect(new Set(GENERATION_MODES).size).toBe(7);
    expect(GENERATION_MODES).toEqual([
      "CREATE",
      "EDIT",
      "COMPOSITE",
      "POSTER",
      "DETAIL_EDIT",
      "DETAIL_PAGE",
      "RETOUCH",
    ]);
  });

  it("declares the 4 reference modes used by FlowStudio v2", () => {
    expect(REFERENCE_MODES).toEqual(["style", "product", "composition", "full"]);
  });

  it("supports the 7 aspect ratios FlowStudio expects", () => {
    expect(ASPECT_RATIOS).toEqual(["1:1", "3:4", "4:3", "9:16", "16:9", "2:3", "3:2"]);
  });

  it("enumerates the 6 documented error codes", () => {
    expect(ERROR_CODES).toEqual([
      "INVALID_INPUT",
      "PROVIDER_UNAVAILABLE",
      "QUOTA_EXCEEDED",
      "CONTENT_FILTERED",
      "TIMEOUT",
      "UNKNOWN",
    ]);
  });
});

describe("ImageGenerationError", () => {
  it("carries code + retryable flags and is throwable", () => {
    const err = new ImageGenerationError("ratelimit hit", "QUOTA_EXCEEDED", true);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ImageGenerationError);
    expect(err.name).toBe("ImageGenerationError");
    expect(err.code).toBe("QUOTA_EXCEEDED");
    expect(err.retryable).toBe(true);
    expect(err.message).toBe("ratelimit hit");
  });

  it("defaults retryable to false", () => {
    const err = new ImageGenerationError("bad input", "INVALID_INPUT");
    expect(err.retryable).toBe(false);
  });

  it("can be caught as Error", () => {
    expect(() => {
      throw new ImageGenerationError("provider down", "PROVIDER_UNAVAILABLE", true);
    }).toThrow(ImageGenerationError);
  });
});

describe("type assignability (compile-time, exercised at runtime)", () => {
  it("accepts a CREATE request shaped per spec", () => {
    const req: GenerationRequest = {
      prompt: "a cat sitting on a desk",
      mode: "CREATE",
      aspectRatio: "1:1",
      count: 2,
    };
    expect(req.mode).toBe("CREATE");
  });

  it("accepts a RETOUCH request with sourceImage + style preset", () => {
    const req: GenerationRequest = {
      prompt: "skin retouch, preserve identity",
      mode: "RETOUCH",
      sourceImage: "data:image/png;base64,AAAA",
      style: "retouch-pro",
    };
    expect(req.style).toBe("retouch-pro");
  });

  it("accepts an EDIT request with refImages + referenceMode", () => {
    const req: GenerationRequest = {
      prompt: "change background to studio",
      mode: "EDIT",
      sourceImage: "https://example.com/a.png",
      refImages: ["https://example.com/b.png"],
      referenceMode: "style",
      provider: "google-genai",
    };
    expect(req.referenceMode).toBe("style");
  });

  it("permits all 7 modes as request mode", () => {
    const modes: GenerationMode[] = [...GENERATION_MODES];
    for (const mode of modes) {
      const req: GenerationRequest = { prompt: "x", mode };
      expect(req.mode).toBe(mode);
    }
  });

  it("permits all 5 providers in result.provider", () => {
    for (const provider of IMAGE_PROVIDERS) {
      const result: GenerationResult = {
        images: [{ base64: "AAAA", mimeType: "image/png" }],
        provider,
        model: "stub-model",
        duration: 1,
      };
      expect(result.provider).toBe(provider);
    }
  });
});

describe("ImageEngine interface (DI contract for downstream PBCs)", () => {
  it("can be implemented by a fake without runtime error", async () => {
    const fake: ImageEngine = {
      async generate(req) {
        return {
          images: [{ base64: "AAAA", mimeType: "image/png" }],
          provider: req.provider ?? "google-genai",
          model: req.model ?? "fake-1",
          duration: 0,
        };
      },
      selectProvider(): ImageProvider {
        return "google-genai";
      },
      getEstimatedCost() {
        return { credits: 1, usd: 0.02 };
      },
    };

    const result = await fake.generate({ prompt: "hi", mode: "CREATE" });
    expect(result.provider).toBe("google-genai");
    expect(fake.selectProvider({ prompt: "hi", mode: "CREATE" })).toBe("google-genai");
    expect(fake.getEstimatedCost({ prompt: "hi", mode: "CREATE" })).toEqual({
      credits: 1,
      usd: 0.02,
    });
  });
});

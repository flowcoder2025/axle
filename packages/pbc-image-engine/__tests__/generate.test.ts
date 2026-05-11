import { describe, expect, it, vi } from "vitest";
import {
  generate,
  ImageGenerationError,
  type GenerationMode,
  type GenerationRequest,
  type GenerationResult,
  type ImageProvider,
} from "../src/index.js";
import type { ImageProviderAdapter } from "../src/providers/types.js";

function makeAdapter(id: ImageProvider, opts: {
  result?: Partial<GenerationResult>;
  throwError?: Error;
  isAvailable?: boolean;
} = {}): ImageProviderAdapter {
  const generate = vi.fn(async (req: GenerationRequest): Promise<GenerationResult> => {
    if (opts.throwError) throw opts.throwError;
    return {
      images: [{ base64: "ZmFrZQ==", mimeType: "image/png" }],
      provider: id,
      model: req.model ?? "mock-model",
      duration: 10,
      ...opts.result,
    };
  });
  return {
    id,
    isAvailable: () => opts.isAvailable ?? true,
    defaultModel: () => "mock-model",
    generate,
  };
}

function baseReq(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return { prompt: "a studio cat", mode: "CREATE", ...overrides };
}

describe("generate — happy path across modes", () => {
  it("calls the adapter for each of CREATE/EDIT/POSTER/DETAIL_EDIT/RETOUCH", async () => {
    const cases: GenerationMode[] = [
      "CREATE",
      "EDIT",
      "POSTER",
      "DETAIL_EDIT",
      "RETOUCH",
    ];
    for (const mode of cases) {
      const id: ImageProvider =
        mode === "CREATE" || mode === "POSTER" ? "google-genai" : "vertex-ai";
      const adapter = makeAdapter(id);
      const result = await generate(baseReq({ mode }), {
        providers: { [id]: adapter },
      });
      expect(adapter.generate).toHaveBeenCalledTimes(1);
      expect(result.provider).toBe(id);
      expect(result.images).toHaveLength(1);
    }
  });

  it("attaches a cost estimate when the adapter doesn't supply one", async () => {
    const adapter = makeAdapter("google-genai");
    const result = await generate(baseReq(), {
      providers: { "google-genai": adapter },
    });
    expect(result.cost).toBeDefined();
    expect(result.cost!.credits).toBeGreaterThan(0);
    expect(result.cost!.usd).toBeGreaterThan(0);
  });

  it("preserves the adapter's own cost when provided", async () => {
    const adapter = makeAdapter("google-genai", {
      result: { cost: { credits: 999, usd: 1.23 } },
    });
    const result = await generate(baseReq(), {
      providers: { "google-genai": adapter },
    });
    expect(result.cost).toEqual({ credits: 999, usd: 1.23 });
  });
});

describe("generate — provider injection + selection", () => {
  it("uses options.providers[id] when present", async () => {
    const realAdapter = makeAdapter("openrouter");
    const result = await generate(
      baseReq({ provider: "openrouter" }),
      { providers: { openrouter: realAdapter } },
    );
    expect(result.provider).toBe("openrouter");
    expect(realAdapter.generate).toHaveBeenCalled();
  });

  it("honours an explicit req.provider pin even when other adapters are injected", async () => {
    const wrong = makeAdapter("google-genai");
    const right = makeAdapter("openrouter");
    await generate(baseReq({ provider: "openrouter" }), {
      providers: { "google-genai": wrong, openrouter: right },
    });
    expect(right.generate).toHaveBeenCalledTimes(1);
    expect(wrong.generate).not.toHaveBeenCalled();
  });

  it("injected adapters become candidates for auto-selection without explicit availability", async () => {
    // CREATE default order: google-genai → openrouter → vertex-ai.
    // Inject only openrouter — it should still be picked because the
    // orchestrator treats absent-from-injected ids as "unknown" not "false";
    // but when an availability hint is missing for google-genai we still
    // prefer the first preference. Pin via `available` to force the choice.
    const adapter = makeAdapter("openrouter");
    const result = await generate(baseReq({ mode: "CREATE" }), {
      providers: { openrouter: adapter },
      available: { "google-genai": false, "vertex-ai": false },
    });
    expect(result.provider).toBe("openrouter");
  });
});

describe("generate — error handling", () => {
  it("rethrows ImageGenerationError from the adapter unchanged", async () => {
    const original = new ImageGenerationError("blocked", "CONTENT_FILTERED", false);
    const adapter = makeAdapter("google-genai", { throwError: original });
    let captured: unknown;
    try {
      await generate(baseReq(), { providers: { "google-genai": adapter } });
    } catch (e) {
      captured = e;
    }
    expect(captured).toBe(original);
  });

  it("wraps non-ImageGenerationError throws as UNKNOWN", async () => {
    const adapter = makeAdapter("google-genai", {
      throwError: new Error("boom"),
    });
    let captured: ImageGenerationError | undefined;
    try {
      await generate(baseReq(), { providers: { "google-genai": adapter } });
    } catch (e) {
      captured = e as ImageGenerationError;
    }
    expect(captured).toBeInstanceOf(ImageGenerationError);
    expect(captured!.code).toBe("UNKNOWN");
    expect(captured!.message).toContain("google-genai");
    expect(captured!.message).toContain("boom");
  });

  it("rejects empty prompts with INVALID_INPUT before touching any adapter", async () => {
    const adapter = makeAdapter("google-genai");
    let captured: ImageGenerationError | undefined;
    try {
      await generate({ prompt: "   ", mode: "CREATE" }, {
        providers: { "google-genai": adapter },
      });
    } catch (e) {
      captured = e as ImageGenerationError;
    }
    expect(captured?.code).toBe("INVALID_INPUT");
    expect(adapter.generate).not.toHaveBeenCalled();
  });

  it("surfaces PROVIDER_UNAVAILABLE from selectProvider when every candidate is unavailable", async () => {
    let captured: ImageGenerationError | undefined;
    try {
      await generate(baseReq({ mode: "CREATE" }), {
        available: {
          "google-genai": false,
          openrouter: false,
          "vertex-ai": false,
        },
      });
    } catch (e) {
      captured = e as ImageGenerationError;
    }
    expect(captured?.code).toBe("PROVIDER_UNAVAILABLE");
  });
});

describe("generate — preset application", () => {
  it("merges a registered preset before calling the adapter", async () => {
    const adapter = makeAdapter("google-genai");
    await generate(
      baseReq({ mode: "RETOUCH", style: "retouch-pro", provider: "google-genai" }),
      { providers: { "google-genai": adapter } },
    );
    const callArg = (adapter.generate as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as GenerationRequest;
    // RETOUCH_PRO sets metadata.systemPrompt — confirm it survived the merge.
    expect(callArg.style).toBe("retouch-pro");
    expect(typeof callArg.metadata?.systemPrompt).toBe("string");
  });
});

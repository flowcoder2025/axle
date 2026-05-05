import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleGenAIProvider } from "../../src/providers/googleGenAI.js";
import { ImageGenerationError } from "../../src/types.js";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function makeFetch(impl: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const stub: typeof fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    return impl(url, init ?? {});
  };
  return vi.fn(stub);
}

describe("GoogleGenAIProvider.isAvailable", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns false when no API key is configured", () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GOOGLE_GENAI_API_KEY", "");
    const p = new GoogleGenAIProvider({ fetch: makeFetch(() => jsonResponse({})) });
    expect(p.isAvailable()).toBe(false);
  });

  it("reads GEMINI_API_KEY from env when constructor opt omitted", () => {
    vi.stubEnv("GEMINI_API_KEY", "env-key");
    const p = new GoogleGenAIProvider({ fetch: makeFetch(() => jsonResponse({})) });
    expect(p.isAvailable()).toBe(true);
  });

  it("explicit apiKey wins over env", () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const p = new GoogleGenAIProvider({
      apiKey: "explicit",
      fetch: makeFetch(() => jsonResponse({})),
    });
    expect(p.isAvailable()).toBe(true);
  });
});

describe("GoogleGenAIProvider.generate — success paths", () => {
  it("posts to {baseUrl}/models/{model}:generateContent with x-goog-api-key", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchStub = makeFetch((url, init) => {
      captured = { url, init };
      return jsonResponse({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { mimeType: "image/png", data: "AAAA" } }],
            },
            finishReason: "STOP",
          },
        ],
      });
    });

    const provider = new GoogleGenAIProvider({
      apiKey: "k1",
      baseUrl: "https://example.test/v1beta",
      fetch: fetchStub,
    });

    const result = await provider.generate({
      prompt: "studio cat",
      mode: "CREATE",
      model: "gemini-3-pro-image-preview",
      count: 2,
    });

    expect(captured).not.toBeNull();
    expect(captured!.url).toBe(
      "https://example.test/v1beta/models/gemini-3-pro-image-preview:generateContent",
    );
    expect(captured!.init.method).toBe("POST");
    const headers = captured!.init.headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe("k1");
    expect(headers["Content-Type"]).toBe("application/json");

    const sentBody = JSON.parse(captured!.init.body as string);
    expect(sentBody.contents[0].parts[0].text).toBe("studio cat");
    expect(sentBody.generationConfig.responseModalities).toEqual(["IMAGE"]);
    expect(sentBody.generationConfig.candidateCount).toBe(2);

    expect(result.provider).toBe("google-genai");
    expect(result.model).toBe("gemini-3-pro-image-preview");
    expect(result.images).toEqual([{ base64: "AAAA", mimeType: "image/png" }]);
    expect(typeof result.duration).toBe("number");
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it("appends negativePrompt to user text", async () => {
    let body: { contents: Array<{ parts: Array<{ text?: string }> }> } | null = null;
    const fetchStub = makeFetch((_, init) => {
      body = JSON.parse(init.body as string);
      return jsonResponse({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "AAAA" } }] } }],
      });
    });

    const provider = new GoogleGenAIProvider({
      apiKey: "k1",
      fetch: fetchStub,
    });
    await provider.generate({
      prompt: "studio cat",
      negativePrompt: "blurry",
      mode: "CREATE",
    });

    expect(body!.contents[0].parts[0].text).toBe(
      "studio cat\n\nDo NOT include: blurry",
    );
  });

  it("inlines source/mask/logo and refImages as inlineData parts", async () => {
    let body: {
      contents: Array<{ parts: Array<Record<string, unknown>> }>;
    } | null = null;
    const fetchStub = makeFetch((_, init) => {
      body = JSON.parse(init.body as string);
      return jsonResponse({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "OUT" } }] } }],
      });
    });

    const provider = new GoogleGenAIProvider({ apiKey: "k", fetch: fetchStub });
    await provider.generate({
      prompt: "edit",
      mode: "EDIT",
      sourceImage: "data:image/png;base64,SRC",
      maskImage: "data:image/png;base64,MSK",
      logoImage: "data:image/jpeg;base64,LGO",
      refImages: ["data:image/webp;base64,REF1", "rawbase64bytes"],
    });

    const inlineParts = body!.contents[0].parts.filter(
      (p) => "inlineData" in p,
    ) as Array<{ inlineData: { mimeType: string; data: string } }>;

    expect(inlineParts).toHaveLength(5);
    expect(inlineParts[0].inlineData).toEqual({ mimeType: "image/png", data: "SRC" });
    expect(inlineParts[1].inlineData).toEqual({ mimeType: "image/png", data: "MSK" });
    expect(inlineParts[2].inlineData).toEqual({ mimeType: "image/jpeg", data: "LGO" });
    expect(inlineParts[3].inlineData).toEqual({ mimeType: "image/webp", data: "REF1" });
    expect(inlineParts[4].inlineData).toEqual({ mimeType: "image/png", data: "rawbase64bytes" });
  });

  it("ignores http(s) refImages (caller must inline them)", async () => {
    let body: {
      contents: Array<{ parts: Array<Record<string, unknown>> }>;
    } | null = null;
    const fetchStub = makeFetch((_, init) => {
      body = JSON.parse(init.body as string);
      return jsonResponse({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "AAAA" } }] } }],
      });
    });
    const provider = new GoogleGenAIProvider({ apiKey: "k", fetch: fetchStub });
    await provider.generate({
      prompt: "x",
      mode: "CREATE",
      refImages: ["https://example.test/a.png"],
    });
    const inlineParts = body!.contents[0].parts.filter((p) => "inlineData" in p);
    expect(inlineParts).toHaveLength(0);
  });

  it("falls back to snake_case inline_data field in response", async () => {
    const fetchStub = makeFetch(() =>
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [{ inline_data: { mime_type: "image/png", data: "ZZZ" } }],
            },
          },
        ],
      }),
    );
    const provider = new GoogleGenAIProvider({ apiKey: "k", fetch: fetchStub });
    const result = await provider.generate({ prompt: "x", mode: "CREATE" });
    expect(result.images).toEqual([{ base64: "ZZZ", mimeType: "image/png" }]);
  });

  it("clamps count to [1, 8]", async () => {
    let body: { generationConfig: { candidateCount: number } } | null = null;
    const fetchStub = makeFetch((_, init) => {
      body = JSON.parse(init.body as string);
      return jsonResponse({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "A" } }] } }],
      });
    });
    const provider = new GoogleGenAIProvider({ apiKey: "k", fetch: fetchStub });

    await provider.generate({ prompt: "x", mode: "CREATE", count: 99 });
    expect(body!.generationConfig.candidateCount).toBe(8);

    await provider.generate({ prompt: "x", mode: "CREATE", count: 0 });
    expect(body!.generationConfig.candidateCount).toBe(1);

    await provider.generate({ prompt: "x", mode: "CREATE" });
    expect(body!.generationConfig.candidateCount).toBe(1);
  });
});

describe("GoogleGenAIProvider.generate — error paths", () => {
  it("throws INVALID_INPUT for empty prompt", async () => {
    const provider = new GoogleGenAIProvider({ apiKey: "k", fetch: makeFetch(() => jsonResponse({})) });
    await expect(provider.generate({ prompt: "   ", mode: "CREATE" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
      retryable: false,
    });
  });

  it("throws PROVIDER_UNAVAILABLE when no API key", async () => {
    const provider = new GoogleGenAIProvider({ apiKey: "", fetch: makeFetch(() => jsonResponse({})) });
    await expect(provider.generate({ prompt: "hi", mode: "CREATE" })).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
  });

  it.each([
    [400, "INVALID_INPUT", false],
    [401, "PROVIDER_UNAVAILABLE", false],
    [403, "PROVIDER_UNAVAILABLE", false],
    [429, "QUOTA_EXCEEDED", true],
    [408, "TIMEOUT", false],
    [500, "PROVIDER_UNAVAILABLE", true],
    [502, "PROVIDER_UNAVAILABLE", true],
  ])("maps HTTP %i to %s (retryable=%s)", async (status, code, retryable) => {
    const fetchStub = makeFetch(() =>
      new Response(JSON.stringify({ error: { message: "bad" } }), { status }),
    );
    const provider = new GoogleGenAIProvider({ apiKey: "k", fetch: fetchStub });

    let captured: ImageGenerationError | undefined;
    try {
      await provider.generate({ prompt: "x", mode: "CREATE" });
    } catch (e) {
      captured = e as ImageGenerationError;
    }
    expect(captured).toBeInstanceOf(ImageGenerationError);
    expect(captured!.code).toBe(code);
    expect(captured!.retryable).toBe(retryable);
  });

  it("throws CONTENT_FILTERED when promptFeedback.blockReason is set", async () => {
    const fetchStub = makeFetch(() =>
      jsonResponse({ promptFeedback: { blockReason: "SAFETY" } }),
    );
    const provider = new GoogleGenAIProvider({ apiKey: "k", fetch: fetchStub });
    await expect(provider.generate({ prompt: "x", mode: "CREATE" })).rejects.toMatchObject({
      code: "CONTENT_FILTERED",
      retryable: false,
    });
  });

  it("throws UNKNOWN when no images come back", async () => {
    const fetchStub = makeFetch(() =>
      jsonResponse({ candidates: [{ content: { parts: [{ text: "no img" }] } }] }),
    );
    const provider = new GoogleGenAIProvider({ apiKey: "k", fetch: fetchStub });
    await expect(provider.generate({ prompt: "x", mode: "CREATE" })).rejects.toMatchObject({
      code: "UNKNOWN",
      retryable: true,
    });
  });

  it("wraps fetch network errors as PROVIDER_UNAVAILABLE retryable", async () => {
    const fetchStub = vi.fn(async () => {
      throw new TypeError("network down");
    });
    const provider = new GoogleGenAIProvider({ apiKey: "k", fetch: fetchStub as unknown as typeof fetch });
    await expect(provider.generate({ prompt: "x", mode: "CREATE" })).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      retryable: true,
    });
  });
});

describe("GoogleGenAIProvider.defaultModel", () => {
  it("returns gemini-3-pro-image-preview for every mode (current spec)", () => {
    const provider = new GoogleGenAIProvider({ apiKey: "k", fetch: makeFetch(() => jsonResponse({})) });
    for (const mode of [
      "CREATE",
      "EDIT",
      "COMPOSITE",
      "POSTER",
      "DETAIL_EDIT",
      "DETAIL_PAGE",
      "RETOUCH",
    ] as const) {
      expect(provider.defaultModel(mode)).toBe("gemini-3-pro-image-preview");
    }
  });
});

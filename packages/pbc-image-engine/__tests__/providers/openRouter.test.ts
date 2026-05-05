import { describe, expect, it, vi } from "vitest";
import { OpenRouterImageProvider } from "../../src/providers/openRouter.js";
import { ImageGenerationError } from "../../src/types.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
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

describe("OpenRouterImageProvider.isAvailable", () => {
  it("returns false without OPENROUTER_API_KEY", () => {
    const p = new OpenRouterImageProvider({ apiKey: "", fetch: makeFetch(() => jsonResponse({})) });
    expect(p.isAvailable()).toBe(false);
  });
  it("returns true with explicit apiKey", () => {
    const p = new OpenRouterImageProvider({ apiKey: "k", fetch: makeFetch(() => jsonResponse({})) });
    expect(p.isAvailable()).toBe(true);
  });
});

describe("OpenRouterImageProvider.generate — success", () => {
  it("calls /chat/completions with bearer + X-Title and parses message.images", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchStub = makeFetch((url, init) => {
      captured = { url, init };
      return jsonResponse({
        model: "google/gemini-2.5-flash-image-preview",
        choices: [
          {
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: "ok",
              images: [
                { type: "image_url", image_url: { url: "data:image/png;base64,AAA" } },
                { type: "image_url", image_url: { url: "data:image/jpeg;base64,BBB" } },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 0 },
      });
    });

    const provider = new OpenRouterImageProvider({
      apiKey: "or-key",
      referer: "https://axle.test",
      fetch: fetchStub,
    });
    const result = await provider.generate({
      prompt: "city skyline at dawn",
      mode: "CREATE",
      count: 2,
    });

    expect(captured!.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const headers = captured!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer or-key");
    expect(headers["X-Title"]).toBe("AXLE");
    expect(headers["HTTP-Referer"]).toBe("https://axle.test");

    const body = JSON.parse(captured!.init.body as string);
    expect(body.model).toBe("google/gemini-2.5-flash-image-preview");
    expect(body.modalities).toEqual(["image", "text"]);
    expect(body.n).toBe(2);
    expect(body.messages[0].role).toBe("user");
    expect(body.messages[0].content).toEqual([
      { type: "text", text: "city skyline at dawn" },
    ]);

    expect(result.provider).toBe("openrouter");
    expect(result.model).toBe("google/gemini-2.5-flash-image-preview");
    expect(result.images).toEqual([
      { base64: "AAA", mimeType: "image/png" },
      { base64: "BBB", mimeType: "image/jpeg" },
    ]);
    expect(result.metadata).toMatchObject({
      finishReason: "stop",
      usage: { prompt_tokens: 10, completion_tokens: 0 },
    });
  });

  it("falls back to message.content[] image_url parts when message.images is missing", async () => {
    const fetchStub = makeFetch(() =>
      jsonResponse({
        choices: [
          {
            message: {
              role: "assistant",
              content: [
                { type: "text", text: "here you go" },
                { type: "image_url", image_url: { url: "data:image/png;base64,XYZ" } },
              ],
            },
          },
        ],
      }),
    );
    const provider = new OpenRouterImageProvider({ apiKey: "k", fetch: fetchStub });
    const result = await provider.generate({ prompt: "x", mode: "CREATE" });
    expect(result.images).toEqual([{ base64: "XYZ", mimeType: "image/png" }]);
  });

  it("attaches sourceImage / refImages as image_url content parts", async () => {
    let body: {
      messages: Array<{
        content: Array<{ type: string; text?: string; image_url?: { url: string } }>;
      }>;
    } | null = null;
    const fetchStub = makeFetch((_, init) => {
      body = JSON.parse(init.body as string);
      return jsonResponse({
        choices: [
          { message: { images: [{ image_url: { url: "data:image/png;base64,OUT" } }] } },
        ],
      });
    });
    const provider = new OpenRouterImageProvider({ apiKey: "k", fetch: fetchStub });
    await provider.generate({
      prompt: "edit me",
      mode: "EDIT",
      sourceImage: "https://example.test/src.png",
      refImages: ["data:image/jpeg;base64,REF"],
    });

    const parts = body!.messages[0].content;
    expect(parts[0]).toEqual({ type: "text", text: "edit me" });
    expect(parts[1]).toEqual({ type: "image_url", image_url: { url: "https://example.test/src.png" } });
    expect(parts[2]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64,REF" },
    });
  });

  it("appends negativePrompt and uses request.model when provided", async () => {
    let body: {
      model: string;
      messages: Array<{ content: Array<{ text?: string }> }>;
    } | null = null;
    const fetchStub = makeFetch((_, init) => {
      body = JSON.parse(init.body as string);
      return jsonResponse({
        choices: [{ message: { images: [{ image_url: { url: "data:image/png;base64,A" } }] } }],
      });
    });
    const provider = new OpenRouterImageProvider({ apiKey: "k", fetch: fetchStub });
    await provider.generate({
      prompt: "studio cat",
      negativePrompt: "blurry",
      mode: "CREATE",
      model: "openai/dall-e-3",
    });
    expect(body!.model).toBe("openai/dall-e-3");
    expect(body!.messages[0].content[0].text).toBe(
      "studio cat\n\nDo NOT include: blurry",
    );
  });
});

describe("OpenRouterImageProvider.generate — errors", () => {
  it("throws INVALID_INPUT for empty prompt", async () => {
    const provider = new OpenRouterImageProvider({ apiKey: "k", fetch: makeFetch(() => jsonResponse({})) });
    await expect(provider.generate({ prompt: "", mode: "CREATE" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("throws PROVIDER_UNAVAILABLE without API key", async () => {
    const provider = new OpenRouterImageProvider({ apiKey: "", fetch: makeFetch(() => jsonResponse({})) });
    await expect(provider.generate({ prompt: "x", mode: "CREATE" })).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
  });

  it("maps HTTP 429 to QUOTA_EXCEEDED retryable", async () => {
    const fetchStub = makeFetch(() => jsonResponse({ error: { message: "rate" } }, 429));
    const provider = new OpenRouterImageProvider({ apiKey: "k", fetch: fetchStub });
    let err: ImageGenerationError | undefined;
    try {
      await provider.generate({ prompt: "x", mode: "CREATE" });
    } catch (e) {
      err = e as ImageGenerationError;
    }
    expect(err?.code).toBe("QUOTA_EXCEEDED");
    expect(err?.retryable).toBe(true);
  });

  it("throws UNKNOWN when message has no images", async () => {
    const fetchStub = makeFetch(() =>
      jsonResponse({ choices: [{ message: { content: "no image" } }] }),
    );
    const provider = new OpenRouterImageProvider({ apiKey: "k", fetch: fetchStub });
    await expect(provider.generate({ prompt: "x", mode: "CREATE" })).rejects.toMatchObject({
      code: "UNKNOWN",
    });
  });

  it("ignores non-data-URL image_url entries", async () => {
    const fetchStub = makeFetch(() =>
      jsonResponse({
        choices: [
          {
            message: {
              images: [
                { image_url: { url: "https://cdn.example.test/out.png" } },
                { image_url: { url: "data:image/png;base64,GOOD" } },
              ],
            },
          },
        ],
      }),
    );
    const provider = new OpenRouterImageProvider({ apiKey: "k", fetch: fetchStub });
    const result = await provider.generate({ prompt: "x", mode: "CREATE" });
    expect(result.images).toEqual([{ base64: "GOOD", mimeType: "image/png" }]);
  });
});

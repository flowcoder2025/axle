import { describe, expect, it, vi } from "vitest";
import { VertexAIProvider } from "../../src/providers/vertexai.js";
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

describe("VertexAIProvider.isAvailable", () => {
  it("requires projectId AND (static token OR getAccessToken)", () => {
    expect(
      new VertexAIProvider({
        projectId: "p",
        accessToken: "t",
        fetch: makeFetch(() => jsonResponse({})),
      }).isAvailable(),
    ).toBe(true);

    expect(
      new VertexAIProvider({
        projectId: "p",
        accessToken: "",
        getAccessToken: async () => "dyn",
        fetch: makeFetch(() => jsonResponse({})),
      }).isAvailable(),
    ).toBe(true);

    expect(
      new VertexAIProvider({
        projectId: "p",
        accessToken: "",
        fetch: makeFetch(() => jsonResponse({})),
      }).isAvailable(),
    ).toBe(false);

    expect(
      new VertexAIProvider({
        projectId: "",
        accessToken: "t",
        fetch: makeFetch(() => jsonResponse({})),
      }).isAvailable(),
    ).toBe(false);
  });
});

describe("VertexAIProvider.generate", () => {
  it("posts to the correct {location}-aiplatform URL with bearer token", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchStub = makeFetch((url, init) => {
      captured = { url, init };
      return jsonResponse({
        predictions: [{ bytesBase64Encoded: "IMG", mimeType: "image/png" }],
      });
    });

    const provider = new VertexAIProvider({
      projectId: "proj-x",
      location: "asia-northeast3",
      accessToken: "tok",
      fetch: fetchStub,
    });

    const result = await provider.generate({
      prompt: "rooftop garden",
      mode: "CREATE",
      aspectRatio: "16:9",
      count: 3,
    });

    expect(captured!.url).toBe(
      "https://asia-northeast3-aiplatform.googleapis.com/v1/projects/proj-x/locations/asia-northeast3/publishers/google/models/imagen-4.0-generate-preview-06-06:predict",
    );
    const headers = captured!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(captured!.init.body as string);
    expect(body.instances[0].prompt).toBe("rooftop garden");
    expect(body.parameters).toEqual({ sampleCount: 3, aspectRatio: "16:9" });

    expect(result).toMatchObject({
      provider: "vertex-ai",
      model: "imagen-4.0-generate-preview-06-06",
      images: [{ base64: "IMG", mimeType: "image/png" }],
    });
  });

  it("forwards negativePrompt and image/mask via instance fields", async () => {
    let body: {
      instances: Array<{
        prompt: string;
        negativePrompt?: string;
        image?: { bytesBase64Encoded?: string };
        mask?: { image?: { bytesBase64Encoded?: string } };
      }>;
    } | null = null;
    const fetchStub = makeFetch((_, init) => {
      body = JSON.parse(init.body as string);
      return jsonResponse({
        predictions: [{ bytesBase64Encoded: "IMG", mimeType: "image/png" }],
      });
    });
    const provider = new VertexAIProvider({
      projectId: "p",
      accessToken: "t",
      fetch: fetchStub,
    });
    await provider.generate({
      prompt: "edit me",
      negativePrompt: "blur",
      mode: "DETAIL_EDIT",
      sourceImage: "data:image/png;base64,SRC",
      maskImage: "data:image/png;base64,MSK",
    });

    expect(body!.instances[0].negativePrompt).toBe("blur");
    expect(body!.instances[0].image?.bytesBase64Encoded).toBe("SRC");
    expect(body!.instances[0].mask?.image?.bytesBase64Encoded).toBe("MSK");
  });

  it("uses dynamic getAccessToken when provided", async () => {
    let captured: RequestInit | null = null;
    const getToken = vi.fn().mockResolvedValue("dyn-token");
    const fetchStub = makeFetch((_, init) => {
      captured = init;
      return jsonResponse({
        predictions: [{ bytesBase64Encoded: "I", mimeType: "image/png" }],
      });
    });

    const provider = new VertexAIProvider({
      projectId: "p",
      getAccessToken: getToken,
      fetch: fetchStub,
    });
    await provider.generate({ prompt: "x", mode: "CREATE" });
    expect(getToken).toHaveBeenCalledOnce();
    expect((captured!.headers as Record<string, string>).Authorization).toBe("Bearer dyn-token");
  });

  it("respects custom baseUrl override (for tests / private endpoints)", async () => {
    let url = "";
    const fetchStub = makeFetch((u) => {
      url = u;
      return jsonResponse({
        predictions: [{ bytesBase64Encoded: "I", mimeType: "image/png" }],
      });
    });
    const provider = new VertexAIProvider({
      projectId: "p",
      location: "us-central1",
      accessToken: "t",
      baseUrl: "https://fake.test/v1/",
      fetch: fetchStub,
    });
    await provider.generate({ prompt: "x", mode: "CREATE", model: "imagen-3.0-fast" });
    expect(url).toBe(
      "https://fake.test/v1/projects/p/locations/us-central1/publishers/google/models/imagen-3.0-fast:predict",
    );
  });

  it("throws CONTENT_FILTERED when all predictions are RAI-filtered", async () => {
    const fetchStub = makeFetch(() =>
      jsonResponse({
        predictions: [{ raiFilteredReason: "Sensitive content" }],
      }),
    );
    const provider = new VertexAIProvider({
      projectId: "p",
      accessToken: "t",
      fetch: fetchStub,
    });
    await expect(provider.generate({ prompt: "x", mode: "CREATE" })).rejects.toMatchObject({
      code: "CONTENT_FILTERED",
      retryable: false,
    });
  });

  it("throws UNKNOWN when no predictions returned", async () => {
    const fetchStub = makeFetch(() => jsonResponse({ predictions: [] }));
    const provider = new VertexAIProvider({
      projectId: "p",
      accessToken: "t",
      fetch: fetchStub,
    });
    await expect(provider.generate({ prompt: "x", mode: "CREATE" })).rejects.toMatchObject({
      code: "UNKNOWN",
    });
  });

  it("maps HTTP 401 to PROVIDER_UNAVAILABLE", async () => {
    const fetchStub = makeFetch(() => jsonResponse({ error: { message: "auth" } }, 401));
    const provider = new VertexAIProvider({
      projectId: "p",
      accessToken: "t",
      fetch: fetchStub,
    });
    let captured: ImageGenerationError | undefined;
    try {
      await provider.generate({ prompt: "x", mode: "CREATE" });
    } catch (e) {
      captured = e as ImageGenerationError;
    }
    expect(captured?.code).toBe("PROVIDER_UNAVAILABLE");
  });

  it("provides distinct default models per mode (EDIT differs from CREATE)", () => {
    const provider = new VertexAIProvider({
      projectId: "p",
      accessToken: "t",
      fetch: makeFetch(() => jsonResponse({})),
    });
    expect(provider.defaultModel("CREATE")).toContain("imagen-4");
    expect(provider.defaultModel("EDIT")).toContain("imagen-3");
    expect(provider.defaultModel("DETAIL_EDIT")).toBe(provider.defaultModel("EDIT"));
  });
});

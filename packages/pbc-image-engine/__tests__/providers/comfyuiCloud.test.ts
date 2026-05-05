import { describe, expect, it, vi } from "vitest";
import { ComfyUICloudProvider } from "../../src/providers/comfyuiCloud.js";
import { ImageGenerationError } from "../../src/types.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function bytesResponse(bytes: Uint8Array, contentType = "image/png"): Response {
  return new Response(bytes, {
    status: 200,
    headers: { "content-type": contentType },
  });
}

interface CallLog {
  url: string;
  method: string;
  body?: string;
  headers?: Record<string, string>;
}

function urlOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return (input as Request).url;
}

describe("ComfyUICloudProvider — basics", () => {
  it("isAvailable() requires an API key + fetch", () => {
    expect(
      new ComfyUICloudProvider({
        apiKey: "k",
        fetch: vi.fn(async () => jsonResponse({})) as unknown as typeof fetch,
      }).isAvailable(),
    ).toBe(true);

    expect(
      new ComfyUICloudProvider({
        apiKey: "",
        fetch: vi.fn(async () => jsonResponse({})) as unknown as typeof fetch,
      }).isAvailable(),
    ).toBe(false);
  });

  it("id is comfyui-cloud and defaultModel falls back to z-image-default", () => {
    const p = new ComfyUICloudProvider({
      apiKey: "k",
      fetch: vi.fn(async () => jsonResponse({})) as unknown as typeof fetch,
    });
    expect(p.id).toBe("comfyui-cloud");
    expect(p.defaultModel("CREATE")).toBe("z-image-default");
    expect(p.defaultModel("EDIT")).toBe("z-image-default");
  });
});

describe("ComfyUICloudProvider.generate — sync mode (response carries outputs)", () => {
  it("posts to {baseUrl}/runs with bearer + deployment_id + params, returns base64", async () => {
    const calls: CallLog[] = [];
    const stub: typeof fetch = async (input, init) => {
      calls.push({
        url: urlOf(input),
        method: (init?.method ?? "GET").toUpperCase(),
        body: typeof init?.body === "string" ? init.body : undefined,
        headers: init?.headers as Record<string, string>,
      });
      return jsonResponse({
        run_id: "run_abc",
        status: "succeeded",
        outputs: [
          { type: "image", base64: "AAA", mimeType: "image/png" },
          { type: "image", data: "data:image/jpeg;base64,BBB" },
        ],
      });
    };

    const provider = new ComfyUICloudProvider({
      baseUrl: "https://api.test.cloud/v1/",
      apiKey: "secret",
      fetch: vi.fn(stub),
      sleep: () => Promise.resolve(),
    });

    const result = await provider.generate({
      prompt: "neon tiger",
      mode: "CREATE",
      aspectRatio: "9:16",
      negativePrompt: "blurry",
      count: 2,
      model: "viewcomfy/z-image-prod",
    });

    // single call (sync)
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.test.cloud/v1/runs");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].headers!.Authorization).toBe("Bearer secret");
    expect(calls[0].headers!["Content-Type"]).toBe("application/json");

    const body = JSON.parse(calls[0].body!) as {
      deployment_id: string;
      params: Record<string, unknown>;
    };
    expect(body.deployment_id).toBe("viewcomfy/z-image-prod");
    expect(body.params.positive_prompt).toBe("neon tiger");
    expect(body.params.negative_prompt).toBe("blurry");
    expect(body.params.width).toBe(768);
    expect(body.params.height).toBe(1344);
    expect(body.params.batch_size).toBe(2);

    expect(result.provider).toBe("comfyui-cloud");
    expect(result.model).toBe("viewcomfy/z-image-prod");
    expect(result.images).toEqual([
      { base64: "AAA", mimeType: "image/png" },
      { base64: "BBB", mimeType: "image/jpeg" },
    ]);
    expect(result.metadata).toMatchObject({
      runId: "run_abc",
      deploymentId: "viewcomfy/z-image-prod",
      status: "succeeded",
    });
  });

  it("treats missing status with non-empty outputs as sync success", async () => {
    const stub: typeof fetch = async () =>
      jsonResponse({
        outputs: [{ type: "image", base64: "GG" }],
      });
    const provider = new ComfyUICloudProvider({
      apiKey: "k",
      fetch: vi.fn(stub),
      sleep: () => Promise.resolve(),
    });
    const result = await provider.generate({
      prompt: "x",
      mode: "CREATE",
      model: "deploy-1",
    });
    expect(result.images).toEqual([{ base64: "GG", mimeType: "image/png" }]);
  });

  it("forwards metadata seed/steps/cfg/checkpoint into params when valid", async () => {
    let body: { params: Record<string, unknown> } | null = null;
    const stub: typeof fetch = async (_, init) => {
      body = JSON.parse((init!.body as string));
      return jsonResponse({
        status: "succeeded",
        outputs: [{ type: "image", base64: "A" }],
      });
    };
    const provider = new ComfyUICloudProvider({
      apiKey: "k",
      fetch: vi.fn(stub),
      sleep: () => Promise.resolve(),
    });
    await provider.generate({
      prompt: "x",
      mode: "CREATE",
      model: "d",
      metadata: { seed: 42, steps: 30, cfg: 5.5, checkpoint: "z-image-turbo.safetensors" },
    });
    expect(body!.params.seed).toBe(42);
    expect(body!.params.steps).toBe(30);
    expect(body!.params.cfg).toBe(5.5);
    expect(body!.params.checkpoint).toBe("z-image-turbo.safetensors");
  });

  it("drops out-of-range metadata.steps/cfg silently (defaults stay omitted)", async () => {
    let body: { params: Record<string, unknown> } | null = null;
    const stub: typeof fetch = async (_, init) => {
      body = JSON.parse((init!.body as string));
      return jsonResponse({
        status: "succeeded",
        outputs: [{ type: "image", base64: "A" }],
      });
    };
    const provider = new ComfyUICloudProvider({
      apiKey: "k",
      fetch: vi.fn(stub),
      sleep: () => Promise.resolve(),
    });
    await provider.generate({
      prompt: "x",
      mode: "CREATE",
      model: "d",
      metadata: { steps: 0, cfg: 200 },
    });
    expect(body!.params.steps).toBeUndefined();
    expect(body!.params.cfg).toBeUndefined();
  });

  it("forwards source/mask/logo/style into params when present", async () => {
    let body: { params: Record<string, unknown> } | null = null;
    const stub: typeof fetch = async (_, init) => {
      body = JSON.parse((init!.body as string));
      return jsonResponse({
        status: "succeeded",
        outputs: [{ type: "image", base64: "A" }],
      });
    };
    const provider = new ComfyUICloudProvider({
      apiKey: "k",
      fetch: vi.fn(stub),
      sleep: () => Promise.resolve(),
    });
    await provider.generate({
      prompt: "edit",
      mode: "EDIT",
      model: "d",
      sourceImage: "https://cdn/src.png",
      maskImage: "data:image/png;base64,MSK",
      logoImage: "data:image/png;base64,LGO",
      style: "wedding",
    });
    expect(body!.params.source_image).toBe("https://cdn/src.png");
    expect(body!.params.mask_image).toBe("data:image/png;base64,MSK");
    expect(body!.params.logo_image).toBe("data:image/png;base64,LGO");
    expect(body!.params.style).toBe("wedding");
  });

  it("clamps count to [1, 8] in batch_size param", async () => {
    let body: { params: { batch_size: number } } | null = null;
    const stub: typeof fetch = async (_, init) => {
      body = JSON.parse((init!.body as string));
      return jsonResponse({
        status: "succeeded",
        outputs: [{ type: "image", base64: "A" }],
      });
    };
    const provider = new ComfyUICloudProvider({
      apiKey: "k",
      fetch: vi.fn(stub),
      sleep: () => Promise.resolve(),
    });
    await provider.generate({ prompt: "x", mode: "CREATE", model: "d", count: 99 });
    expect(body!.params.batch_size).toBe(8);
    await provider.generate({ prompt: "x", mode: "CREATE", model: "d", count: 0 });
    expect(body!.params.batch_size).toBe(1);
  });
});

describe("ComfyUICloudProvider.generate — async polling", () => {
  it("polls /runs/{id} until succeeded, then returns images", async () => {
    let pollCount = 0;
    const stub: typeof fetch = async (input) => {
      const url = urlOf(input);
      if (url.endsWith("/runs")) {
        return jsonResponse({ run_id: "run_xyz", status: "queued" });
      }
      if (url.endsWith("/runs/run_xyz")) {
        pollCount += 1;
        if (pollCount < 3) return jsonResponse({ run_id: "run_xyz", status: "running" });
        return jsonResponse({
          run_id: "run_xyz",
          status: "succeeded",
          outputs: [{ type: "image", base64: "ZZZ" }],
        });
      }
      return new Response("404", { status: 404 });
    };
    const provider = new ComfyUICloudProvider({
      apiKey: "k",
      fetch: vi.fn(stub),
      sleep: () => Promise.resolve(),
      pollIntervalMs: 1,
      timeoutMs: 60_000,
    });
    const result = await provider.generate({
      prompt: "x",
      mode: "CREATE",
      model: "deploy-1",
    });
    expect(result.images).toEqual([{ base64: "ZZZ", mimeType: "image/png" }]);
    expect(result.metadata).toMatchObject({ runId: "run_xyz", status: "succeeded" });
    expect(pollCount).toBe(3);
  });

  it("TIMEOUT when polling exceeds timeoutMs (clock injection)", async () => {
    let now = 0;
    const stub: typeof fetch = async (input) => {
      const url = urlOf(input);
      if (url.endsWith("/runs")) return jsonResponse({ run_id: "rr", status: "queued" });
      if (url.endsWith("/runs/rr")) return jsonResponse({ run_id: "rr", status: "running" });
      return new Response("404", { status: 404 });
    };
    const provider = new ComfyUICloudProvider({
      apiKey: "k",
      fetch: vi.fn(stub),
      sleep: () => {
        now += 5_000;
        return Promise.resolve();
      },
      now: () => now,
      pollIntervalMs: 1,
      timeoutMs: 3_000,
    });
    let captured: ImageGenerationError | undefined;
    try {
      await provider.generate({ prompt: "x", mode: "CREATE", model: "d" });
    } catch (e) {
      captured = e as ImageGenerationError;
    }
    expect(captured?.code).toBe("TIMEOUT");
    expect(captured?.retryable).toBe(true);
  });

  it("UNKNOWN retryable when /runs returns no run_id and no terminal status", async () => {
    const stub: typeof fetch = async () => jsonResponse({ status: "queued" });
    const provider = new ComfyUICloudProvider({
      apiKey: "k",
      fetch: vi.fn(stub),
      sleep: () => Promise.resolve(),
    });
    await expect(
      provider.generate({ prompt: "x", mode: "CREATE", model: "d" }),
    ).rejects.toMatchObject({ code: "UNKNOWN", retryable: true });
  });

  it("propagates terminal failure with mapped error code", async () => {
    const stub: typeof fetch = async (input) => {
      const url = urlOf(input);
      if (url.endsWith("/runs")) return jsonResponse({ run_id: "rr", status: "queued" });
      if (url.endsWith("/runs/rr"))
        return jsonResponse({
          run_id: "rr",
          status: "failed",
          error: { code: "nsfw_filtered", message: "Content blocked by safety filter" },
        });
      return new Response("404", { status: 404 });
    };
    const provider = new ComfyUICloudProvider({
      apiKey: "k",
      fetch: vi.fn(stub),
      sleep: () => Promise.resolve(),
      pollIntervalMs: 1,
    });
    let captured: ImageGenerationError | undefined;
    try {
      await provider.generate({ prompt: "x", mode: "CREATE", model: "d" });
    } catch (e) {
      captured = e as ImageGenerationError;
    }
    expect(captured?.code).toBe("CONTENT_FILTERED");
    expect(captured?.message).toMatch(/safety filter/);
  });
});

describe("ComfyUICloudProvider.generate — output URL fetching", () => {
  it("fetches output URLs and converts bytes to base64", async () => {
    const stub: typeof fetch = async (input) => {
      const url = urlOf(input);
      if (url.endsWith("/runs")) {
        return jsonResponse({
          status: "succeeded",
          outputs: [
            { type: "image", url: "https://cdn.test/out.png" },
          ],
        });
      }
      if (url === "https://cdn.test/out.png") {
        return bytesResponse(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "image/png");
      }
      return new Response("404", { status: 404 });
    };
    const provider = new ComfyUICloudProvider({
      apiKey: "k",
      fetch: vi.fn(stub),
      sleep: () => Promise.resolve(),
    });
    const result = await provider.generate({
      prompt: "x",
      mode: "CREATE",
      model: "d",
    });
    // Buffer.from([0x89,0x50,0x4e,0x47]).toString("base64") = "iVBORw=="
    expect(result.images).toEqual([{ base64: "iVBORw==", mimeType: "image/png" }]);
  });

  it("PROVIDER_UNAVAILABLE retryable when fetching the output URL 5xxs", async () => {
    const stub: typeof fetch = async (input) => {
      const url = urlOf(input);
      if (url.endsWith("/runs")) {
        return jsonResponse({
          status: "succeeded",
          outputs: [{ type: "image", url: "https://cdn.test/down.png" }],
        });
      }
      return new Response("err", { status: 502 });
    };
    const provider = new ComfyUICloudProvider({
      apiKey: "k",
      fetch: vi.fn(stub),
      sleep: () => Promise.resolve(),
    });
    await expect(
      provider.generate({ prompt: "x", mode: "CREATE", model: "d" }),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", retryable: true });
  });

  it("ignores non-image outputs (e.g. logs, masks)", async () => {
    const stub: typeof fetch = async () =>
      jsonResponse({
        status: "succeeded",
        outputs: [
          { type: "log", base64: "log-content" },
          { type: "image", base64: "GOOD" },
          { type: "video", base64: "vid" },
        ],
      });
    const provider = new ComfyUICloudProvider({
      apiKey: "k",
      fetch: vi.fn(stub),
      sleep: () => Promise.resolve(),
    });
    const result = await provider.generate({
      prompt: "x",
      mode: "CREATE",
      model: "d",
    });
    expect(result.images).toEqual([{ base64: "GOOD", mimeType: "image/png" }]);
  });
});

describe("ComfyUICloudProvider.generate — input + error paths", () => {
  it("INVALID_INPUT for empty prompt", async () => {
    const provider = new ComfyUICloudProvider({
      apiKey: "k",
      fetch: vi.fn(async () => jsonResponse({})) as unknown as typeof fetch,
    });
    await expect(
      provider.generate({ prompt: "  ", mode: "CREATE", model: "d" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("PROVIDER_UNAVAILABLE without API key", async () => {
    const provider = new ComfyUICloudProvider({
      apiKey: "",
      fetch: vi.fn(async () => jsonResponse({})) as unknown as typeof fetch,
    });
    await expect(
      provider.generate({ prompt: "x", mode: "CREATE", model: "d" }),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });

  it("INVALID_INPUT when no deployment id resolved (mode unsupported by default registry)", async () => {
    const provider = new ComfyUICloudProvider({
      apiKey: "k",
      fetch: vi.fn(async () => jsonResponse({})) as unknown as typeof fetch,
    });
    // RETOUCH has no default workflow id, no model, no metadata.deploymentId
    await expect(provider.generate({ prompt: "x", mode: "RETOUCH" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("uses metadata.deploymentId when request.model is omitted", async () => {
    let body: { deployment_id: string } | null = null;
    const stub: typeof fetch = async (_, init) => {
      body = JSON.parse((init!.body as string));
      return jsonResponse({
        status: "succeeded",
        outputs: [{ type: "image", base64: "A" }],
      });
    };
    const provider = new ComfyUICloudProvider({
      apiKey: "k",
      fetch: vi.fn(stub),
      sleep: () => Promise.resolve(),
    });
    await provider.generate({
      prompt: "x",
      mode: "CREATE",
      metadata: { deploymentId: "from-metadata" },
    });
    expect(body!.deployment_id).toBe("from-metadata");
  });

  it.each([
    [400, "INVALID_INPUT", false],
    [401, "PROVIDER_UNAVAILABLE", false],
    [403, "PROVIDER_UNAVAILABLE", false],
    [429, "QUOTA_EXCEEDED", true],
    [500, "PROVIDER_UNAVAILABLE", true],
  ])("maps /runs HTTP %i to %s (retryable=%s)", async (status, code, retryable) => {
    const stub: typeof fetch = async () => new Response("err", { status });
    const provider = new ComfyUICloudProvider({
      apiKey: "k",
      fetch: vi.fn(stub),
      sleep: () => Promise.resolve(),
    });
    let captured: ImageGenerationError | undefined;
    try {
      await provider.generate({ prompt: "x", mode: "CREATE", model: "d" });
    } catch (e) {
      captured = e as ImageGenerationError;
    }
    expect(captured?.code).toBe(code);
    expect(captured?.retryable).toBe(retryable);
  });

  it("wraps fetch network errors on /runs as PROVIDER_UNAVAILABLE retryable", async () => {
    const provider = new ComfyUICloudProvider({
      apiKey: "k",
      fetch: vi.fn(async () => {
        throw new TypeError("dns fail");
      }) as unknown as typeof fetch,
      sleep: () => Promise.resolve(),
    });
    await expect(
      provider.generate({ prompt: "x", mode: "CREATE", model: "d" }),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", retryable: true });
  });

  it("UNKNOWN retryable when terminal success has zero image outputs", async () => {
    const stub: typeof fetch = async () =>
      jsonResponse({ status: "succeeded", outputs: [] });
    const provider = new ComfyUICloudProvider({
      apiKey: "k",
      fetch: vi.fn(stub),
      sleep: () => Promise.resolve(),
    });
    await expect(
      provider.generate({ prompt: "x", mode: "CREATE", model: "d" }),
    ).rejects.toMatchObject({ code: "UNKNOWN", retryable: true });
  });
});

describe("ComfyUICloudProvider — extension hooks", () => {
  it("custom buildParams replaces the default mapping", async () => {
    let body: { params: Record<string, unknown> } | null = null;
    const stub: typeof fetch = async (_, init) => {
      body = JSON.parse((init!.body as string));
      return jsonResponse({
        status: "succeeded",
        outputs: [{ type: "image", base64: "A" }],
      });
    };
    const provider = new ComfyUICloudProvider({
      apiKey: "k",
      fetch: vi.fn(stub),
      sleep: () => Promise.resolve(),
      buildParams: (req) => ({ "6-text": req.prompt, "10-strength": 0.7 }),
    });
    await provider.generate({ prompt: "tiger", mode: "CREATE", model: "d" });
    expect(body!.params).toEqual({ "6-text": "tiger", "10-strength": 0.7 });
  });

  it("custom resolveDeployment overrides default lookup", async () => {
    let body: { deployment_id: string } | null = null;
    const stub: typeof fetch = async (_, init) => {
      body = JSON.parse((init!.body as string));
      return jsonResponse({
        status: "succeeded",
        outputs: [{ type: "image", base64: "A" }],
      });
    };
    const provider = new ComfyUICloudProvider({
      apiKey: "k",
      fetch: vi.fn(stub),
      sleep: () => Promise.resolve(),
      resolveDeployment: () => "always-this-deployment",
    });
    await provider.generate({ prompt: "x", mode: "CREATE", model: "ignored" });
    expect(body!.deployment_id).toBe("always-this-deployment");
  });
});

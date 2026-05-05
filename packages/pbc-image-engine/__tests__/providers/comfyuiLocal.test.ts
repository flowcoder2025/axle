import { describe, expect, it, vi } from "vitest";
import { ComfyUILocalProvider } from "../../src/providers/comfyuiLocal.js";
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

interface FakeServerOptions {
  promptId?: string;
  /** How many /history polls return "not yet" before "success". */
  pollsBeforeSuccess?: number;
  /** When set, the prompt response carries node_errors. */
  nodeErrors?: Record<string, unknown>;
  /** When set, /history reports execution_error. */
  executionError?: boolean;
  /** When true, /prompt returns 500. */
  promptHttpStatus?: number;
  /** When true, /history returns 500. */
  historyHttpStatus?: number;
  /** Image bytes to serve from /view. */
  imageBytes?: Uint8Array;
  /** subfolder/filename/type to advertise in history outputs. */
  outputs?: Array<{ filename: string; subfolder?: string; type?: string }>;
}

interface CallLog {
  url: string;
  method: string;
  body?: string;
}

function makeFakeServer(opts: FakeServerOptions = {}) {
  const calls: CallLog[] = [];
  const promptId = opts.promptId ?? "abc-123";
  const polls = opts.pollsBeforeSuccess ?? 1;
  const outputs = opts.outputs ?? [{ filename: "out_00001_.png", subfolder: "", type: "output" }];
  let pollsSeen = 0;

  const stub: typeof fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    calls.push({
      url,
      method: (init?.method ?? "GET").toUpperCase(),
      body: typeof init?.body === "string" ? init.body : undefined,
    });

    if (url.endsWith("/prompt")) {
      if (opts.promptHttpStatus && opts.promptHttpStatus >= 400) {
        return new Response(JSON.stringify({ error: "boom" }), {
          status: opts.promptHttpStatus,
        });
      }
      if (opts.nodeErrors) {
        return jsonResponse({ prompt_id: promptId, node_errors: opts.nodeErrors });
      }
      return jsonResponse({ prompt_id: promptId, number: 1, node_errors: {} });
    }

    if (url.includes(`/history/${promptId}`)) {
      if (opts.historyHttpStatus && opts.historyHttpStatus >= 400) {
        return new Response(JSON.stringify({}), { status: opts.historyHttpStatus });
      }
      pollsSeen += 1;
      if (pollsSeen <= polls) {
        // not ready yet
        return jsonResponse({});
      }
      if (opts.executionError) {
        return jsonResponse({
          [promptId]: {
            status: {
              status_str: "error",
              completed: false,
              messages: [["execution_error", { node_id: "5", reason: "OOM" }]],
            },
          },
        });
      }
      return jsonResponse({
        [promptId]: {
          status: { status_str: "success", completed: true, messages: [] },
          outputs: { "7": { images: outputs } },
        },
      });
    }

    if (url.includes("/view")) {
      return bytesResponse(opts.imageBytes ?? new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    }

    return new Response("404 unknown", { status: 404 });
  };

  return { fetch: vi.fn(stub), calls, promptId };
}

function freshProvider(server: FakeServerOptions = {}) {
  const fake = makeFakeServer(server);
  const provider = new ComfyUILocalProvider({
    baseUrl: "http://test.local:8188",
    fetch: fake.fetch,
    sleep: () => Promise.resolve(),
    pollIntervalMs: 1,
    timeoutMs: 60_000,
  });
  return { provider, server: fake };
}

describe("ComfyUILocalProvider basics", () => {
  it("isAvailable() is true with a baseUrl + fetch", () => {
    const provider = new ComfyUILocalProvider({
      baseUrl: "http://localhost:8188",
      fetch: vi.fn(async () => jsonResponse({})) as unknown as typeof fetch,
    });
    expect(provider.isAvailable()).toBe(true);
    expect(provider.id).toBe("comfyui-local");
  });

  it("defaultModel returns z-image-default for supported modes", () => {
    const p = new ComfyUILocalProvider({
      fetch: vi.fn(async () => jsonResponse({})) as unknown as typeof fetch,
    });
    expect(p.defaultModel("CREATE")).toBe("z-image-default");
    expect(p.defaultModel("POSTER")).toBe("z-image-default");
    expect(p.defaultModel("EDIT")).toBe("z-image-default"); // fallback to ZImage builder id
  });
});

describe("ComfyUILocalProvider.generate — happy path (Z-Image)", () => {
  it("submits /prompt → polls /history → fetches /view, returns base64 image", async () => {
    const { provider, server } = freshProvider({ pollsBeforeSuccess: 2 });
    const result = await provider.generate({
      prompt: "neon cyberpunk alley",
      mode: "CREATE",
      aspectRatio: "16:9",
    });

    const urls = server.calls.map((c) => c.url);
    expect(urls[0]).toBe("http://test.local:8188/prompt");
    expect(urls.filter((u) => u.includes("/history/abc-123")).length).toBe(3); // 2 not-ready + 1 success
    expect(urls.some((u) => u.includes("/view?"))).toBe(true);

    expect(result.provider).toBe("comfyui-local");
    expect(result.model).toBe("z-image-default");
    expect(result.images).toHaveLength(1);
    expect(result.images[0].mimeType).toBe("image/png");
    // Buffer.from([0x89,0x50,0x4e,0x47]).toString("base64") = "iVBORw=="
    expect(result.images[0].base64).toBe("iVBORw==");
    expect(result.metadata).toMatchObject({
      promptId: "abc-123",
      workflowId: "z-image-default",
      outputNodeIds: ["7"],
    });
  });

  it("includes the Z-Image graph in the /prompt body with correct aspect-ratio dims", async () => {
    const { provider, server } = freshProvider({ pollsBeforeSuccess: 0 });
    await provider.generate({
      prompt: "tiger",
      mode: "CREATE",
      aspectRatio: "9:16",
      negativePrompt: "low quality",
    });

    const submit = server.calls.find((c) => c.url.endsWith("/prompt"));
    expect(submit).toBeDefined();
    const body = JSON.parse(submit!.body!) as {
      prompt: Record<string, { class_type: string; inputs: Record<string, unknown> }>;
      client_id: string;
    };
    expect(body.client_id).toBe("axle-pbc-image-engine");
    expect(body.prompt["1"].class_type).toBe("CheckpointLoaderSimple");
    expect(body.prompt["2"].inputs.text).toBe("tiger");
    expect(body.prompt["3"].inputs.text).toBe("low quality");
    expect(body.prompt["4"].inputs.width).toBe(768);
    expect(body.prompt["4"].inputs.height).toBe(1344);
  });

  it("collects multiple images when SaveImage produces more than one", async () => {
    const { provider } = freshProvider({
      pollsBeforeSuccess: 0,
      outputs: [
        { filename: "out_1.png", subfolder: "", type: "output" },
        { filename: "out_2.png", subfolder: "axle/sub", type: "output" },
      ],
    });
    const result = await provider.generate({ prompt: "x", mode: "CREATE" });
    expect(result.images).toHaveLength(2);
  });

  it("forwards filename/subfolder/type as URL params to /view", async () => {
    const { provider, server } = freshProvider({
      pollsBeforeSuccess: 0,
      outputs: [{ filename: "image with space.png", subfolder: "axle/run1", type: "output" }],
    });
    await provider.generate({ prompt: "x", mode: "CREATE" });
    const view = server.calls.find((c) => c.url.includes("/view?"));
    expect(view).toBeDefined();
    expect(view!.url).toMatch(/filename=image\+with\+space\.png/);
    expect(view!.url).toMatch(/subfolder=axle%2Frun1/);
    expect(view!.url).toMatch(/type=output/);
  });
});

describe("ComfyUILocalProvider.generate — error paths", () => {
  it("INVALID_INPUT for empty prompt", async () => {
    const provider = new ComfyUILocalProvider({
      baseUrl: "http://x:8188",
      fetch: vi.fn(async () => jsonResponse({})) as unknown as typeof fetch,
    });
    await expect(provider.generate({ prompt: " ", mode: "CREATE" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("INVALID_INPUT when workflow does not support the mode", async () => {
    const { provider } = freshProvider({});
    // RETOUCH is not in z-image's modes
    await expect(provider.generate({ prompt: "x", mode: "RETOUCH" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("INVALID_INPUT when /prompt returns node_errors", async () => {
    const { provider } = freshProvider({
      nodeErrors: { "5": { errors: ["bad cfg"] } },
    });
    await expect(provider.generate({ prompt: "x", mode: "CREATE" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("UNKNOWN retryable when /history reports execution_error", async () => {
    const { provider } = freshProvider({
      pollsBeforeSuccess: 0,
      executionError: true,
    });
    let captured: ImageGenerationError | undefined;
    try {
      await provider.generate({ prompt: "x", mode: "CREATE" });
    } catch (e) {
      captured = e as ImageGenerationError;
    }
    expect(captured?.code).toBe("UNKNOWN");
    expect(captured?.retryable).toBe(true);
    expect(captured?.message).toMatch(/execution_error/);
  });

  it("PROVIDER_UNAVAILABLE retryable on /prompt 5xx", async () => {
    const { provider } = freshProvider({ promptHttpStatus: 503 });
    await expect(provider.generate({ prompt: "x", mode: "CREATE" })).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      retryable: true,
    });
  });

  it("PROVIDER_UNAVAILABLE retryable on /history 5xx", async () => {
    const { provider } = freshProvider({ historyHttpStatus: 502 });
    await expect(provider.generate({ prompt: "x", mode: "CREATE" })).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      retryable: true,
    });
  });

  it("TIMEOUT when polling exceeds timeoutMs (clock injection)", async () => {
    let now = 0;
    const stub: typeof fetch = async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      if (url.endsWith("/prompt")) {
        return jsonResponse({ prompt_id: "p", node_errors: {} });
      }
      if (url.includes("/history/p")) {
        // Always not-yet
        return jsonResponse({});
      }
      return new Response("nope", { status: 404 });
    };
    const provider = new ComfyUILocalProvider({
      baseUrl: "http://x:8188",
      fetch: vi.fn(stub),
      sleep: () => {
        now += 10_000;
        return Promise.resolve();
      },
      now: () => now,
      pollIntervalMs: 1,
      timeoutMs: 5_000,
    });

    let captured: ImageGenerationError | undefined;
    try {
      await provider.generate({ prompt: "x", mode: "CREATE" });
    } catch (e) {
      captured = e as ImageGenerationError;
    }
    expect(captured?.code).toBe("TIMEOUT");
    expect(captured?.retryable).toBe(true);
  });

  it("UNKNOWN retryable when /history success carries no images", async () => {
    const stub: typeof fetch = async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      if (url.endsWith("/prompt"))
        return jsonResponse({ prompt_id: "p", node_errors: {} });
      if (url.includes("/history/p"))
        return jsonResponse({
          p: {
            status: { status_str: "success", completed: true },
            outputs: { "7": { images: [] } },
          },
        });
      return new Response("nope", { status: 404 });
    };
    const provider = new ComfyUILocalProvider({
      baseUrl: "http://x:8188",
      fetch: vi.fn(stub),
      sleep: () => Promise.resolve(),
      pollIntervalMs: 1,
    });
    await expect(provider.generate({ prompt: "x", mode: "CREATE" })).rejects.toMatchObject({
      code: "UNKNOWN",
      retryable: true,
    });
  });

  it("PROVIDER_UNAVAILABLE retryable when /prompt fetch throws", async () => {
    const provider = new ComfyUILocalProvider({
      baseUrl: "http://x:8188",
      fetch: (vi.fn(async () => {
        throw new TypeError("connection refused");
      }) as unknown) as typeof fetch,
      sleep: () => Promise.resolve(),
    });
    await expect(provider.generate({ prompt: "x", mode: "CREATE" })).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      retryable: true,
    });
  });
});

describe("ComfyUILocalProvider.generate — workflow override", () => {
  it("uses request.model as the workflow id when provided", async () => {
    const { provider } = freshProvider({});
    const result = await provider.generate({
      prompt: "x",
      mode: "CREATE",
      model: "z-image-default", // explicit
    });
    expect(result.model).toBe("z-image-default");
  });

  it("INVALID_INPUT when request.model points to an unregistered workflow", async () => {
    const { provider } = freshProvider({});
    await expect(
      provider.generate({ prompt: "x", mode: "CREATE", model: "nonexistent-graph" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

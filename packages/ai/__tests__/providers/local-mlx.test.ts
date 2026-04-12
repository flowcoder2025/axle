import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("LocalMlxProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("has tier LOCAL_MLX", async () => {
    const { LocalMlxProvider } = await import("../../src/providers/local-mlx.js");
    const provider = new LocalMlxProvider();
    expect(provider.tier).toBe("LOCAL_MLX");
  });

  it("isAvailable checks health endpoint", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const { LocalMlxProvider } = await import("../../src/providers/local-mlx.js");
    const provider = new LocalMlxProvider("http://localhost:8080");
    expect(await provider.isAvailable()).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith("http://localhost:8080/health", expect.anything());
  });

  it("isAvailable returns false on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const { LocalMlxProvider } = await import("../../src/providers/local-mlx.js");
    const provider = new LocalMlxProvider();
    expect(await provider.isAvailable()).toBe(false);
  });

  it("complete calls OpenAI-compatible endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: "mlx response" } }],
        usage: { prompt_tokens: 5, completion_tokens: 10 },
        model: "mlx-hermes-3",
      }),
    });
    const { LocalMlxProvider } = await import("../../src/providers/local-mlx.js");
    const provider = new LocalMlxProvider("http://localhost:8080");
    const result = await provider.complete({ prompt: "test" });
    expect(result.text).toBe("mlx response");
    expect(result.usage.inputTokens).toBe(5);
    expect(result.usage.outputTokens).toBe(10);
  });
});

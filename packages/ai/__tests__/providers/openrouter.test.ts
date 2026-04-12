import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("OpenRouterProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.OPENROUTER_API_KEY = "test-or-key";
  });

  it("has tier API_HAIKU", async () => {
    const { OpenRouterProvider } = await import(
      "../../src/providers/openrouter.js"
    );
    const provider = new OpenRouterProvider("test-key");
    expect(provider.tier).toBe("API_HAIKU");
  });

  it("isAvailable returns true when API key exists", async () => {
    const { OpenRouterProvider } = await import(
      "../../src/providers/openrouter.js"
    );
    const provider = new OpenRouterProvider("test-key");
    expect(await provider.isAvailable()).toBe(true);
  });

  it("isAvailable returns false when no API key", async () => {
    const { OpenRouterProvider } = await import(
      "../../src/providers/openrouter.js"
    );
    const provider = new OpenRouterProvider("");
    expect(await provider.isAvailable()).toBe(false);
  });

  it("calls OpenRouter chat completions endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "OpenRouter response" } }],
          usage: { prompt_tokens: 15, completion_tokens: 20 },
          model: "anthropic/claude-haiku-4-5-20251001",
        }),
    });

    const { OpenRouterProvider } = await import(
      "../../src/providers/openrouter.js"
    );
    const provider = new OpenRouterProvider("test-key");
    const result = await provider.complete({
      system: "You are helpful.",
      prompt: "Hello",
    });

    expect(result.text).toBe("OpenRouter response");
    expect(result.usage.inputTokens).toBe(15);
    expect(result.usage.outputTokens).toBe(20);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          "X-Title": "AXLE",
        }),
      }),
    );
  });

  it("sends system message when provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "ok" } }],
          usage: { prompt_tokens: 5, completion_tokens: 2 },
          model: "test",
        }),
    });

    const { OpenRouterProvider } = await import(
      "../../src/providers/openrouter.js"
    );
    const provider = new OpenRouterProvider("test-key");
    await provider.complete({ system: "Be concise.", prompt: "Hi" });

    const body = JSON.parse(
      (mockFetch.mock.calls[0][1] as { body: string }).body,
    );
    expect(body.messages).toEqual([
      { role: "system", content: "Be concise." },
      { role: "user", content: "Hi" },
    ]);
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: () => Promise.resolve("Rate limited"),
    });

    const { OpenRouterProvider } = await import(
      "../../src/providers/openrouter.js"
    );
    const provider = new OpenRouterProvider("test-key");
    await expect(provider.complete({ prompt: "test" })).rejects.toThrow(
      "OpenRouter error 429",
    );
  });

  it("throws when no API key on complete", async () => {
    const { OpenRouterProvider } = await import(
      "../../src/providers/openrouter.js"
    );
    const provider = new OpenRouterProvider("");
    await expect(provider.complete({ prompt: "test" })).rejects.toThrow(
      "OPENROUTER_API_KEY",
    );
  });

  it("uses custom model", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "gemini" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
          model: "google/gemini-2.0-flash",
        }),
    });

    const { OpenRouterProvider } = await import(
      "../../src/providers/openrouter.js"
    );
    const provider = new OpenRouterProvider("test-key");
    const result = await provider.complete({
      prompt: "test",
      model: "google/gemini-2.0-flash",
    });

    expect(result.model).toBe("google/gemini-2.0-flash");
    const body = JSON.parse(
      (mockFetch.mock.calls[0][1] as { body: string }).body,
    );
    expect(body.model).toBe("google/gemini-2.0-flash");
  });
});

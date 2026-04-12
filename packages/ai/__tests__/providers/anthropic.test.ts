import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@anthropic-ai/sdk", () => {
  const create = vi.fn().mockResolvedValue({
    content: [{ type: "text", text: "mocked response" }],
    usage: { input_tokens: 10, output_tokens: 5 },
    model: "claude-haiku-4-5-20251001",
  });
  return { default: vi.fn(() => ({ messages: { create } })) };
});

describe("AnthropicProvider", () => {
  beforeEach(() => vi.clearAllMocks());

  it("implements AiProvider interface", async () => {
    const { AnthropicProvider } = await import(
      "../../src/providers/anthropic.js"
    );
    const provider = new AnthropicProvider();
    expect(provider.tier).toBe("API_HAIKU");
    expect(typeof provider.isAvailable).toBe("function");
    expect(typeof provider.complete).toBe("function");
  });

  it("returns completion result", async () => {
    const { AnthropicProvider } = await import(
      "../../src/providers/anthropic.js"
    );
    const provider = new AnthropicProvider();
    const result = await provider.complete({ prompt: "hello" });
    expect(result.text).toBe("mocked response");
    expect(result.usage.inputTokens).toBe(10);
    expect(result.usage.outputTokens).toBe(5);
  });

  it("uses custom model when provided", async () => {
    const { AnthropicProvider } = await import(
      "../../src/providers/anthropic.js"
    );
    const provider = new AnthropicProvider("claude-opus-4-6");
    expect(provider.tier).toBe("API_OPUS");
  });

  it("isAvailable returns true when API key exists", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const { AnthropicProvider } = await import(
      "../../src/providers/anthropic.js"
    );
    const provider = new AnthropicProvider();
    expect(await provider.isAvailable()).toBe(true);
  });
});

import { describe, it, expect, vi } from "vitest";

vi.mock("@anthropic-ai/sdk", () => {
  const create = vi.fn().mockResolvedValue({
    content: [{ type: "text", text: "test" }],
    usage: { input_tokens: 1, output_tokens: 1 },
    model: "test",
  });
  return { default: vi.fn(() => ({ messages: { create } })) };
});

describe("Provider Registry", () => {
  it("getProvider returns provider for valid tier", async () => {
    const { getProvider } = await import("../../src/providers/index.js");
    const provider = getProvider("API_HAIKU");
    expect(provider.tier).toBe("API_HAIKU");
  });

  it("getProvider returns provider for all tiers", async () => {
    const { getProvider } = await import("../../src/providers/index.js");
    expect(getProvider("API_HAIKU").tier).toBe("API_HAIKU");
    expect(getProvider("API_OPUS").tier).toBe("API_OPUS");
    expect(getProvider("CLI_CLAUDE").tier).toBe("CLI_CLAUDE");
    expect(getProvider("LOCAL_MLX").tier).toBe("LOCAL_MLX");
  });

  it("resolveProvider returns provider instance", async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    const { resolveProvider } = await import("../../src/providers/index.js");
    const provider = await resolveProvider("SUMMARY");
    expect(provider).toBeDefined();
    expect(typeof provider.complete).toBe("function");
  });
});

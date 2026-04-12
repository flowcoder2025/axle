import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("child_process", () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
    cb(null, "cli response", "");
  }),
}));

describe("ClaudeCliProvider", () => {
  beforeEach(() => vi.clearAllMocks());

  it("has tier CLI_CLAUDE", async () => {
    const { ClaudeCliProvider } = await import("../../src/providers/claude-cli.js");
    const provider = new ClaudeCliProvider();
    expect(provider.tier).toBe("CLI_CLAUDE");
  });

  it("complete calls claude -p", async () => {
    const { ClaudeCliProvider } = await import("../../src/providers/claude-cli.js");
    const provider = new ClaudeCliProvider();
    const result = await provider.complete({ prompt: "test prompt" });
    expect(result.text).toBe("cli response");
    expect(result.model).toBe("claude-cli");
  });
});

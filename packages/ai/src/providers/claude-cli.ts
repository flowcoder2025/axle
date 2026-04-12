import { execFile } from "child_process";
import type { AiProvider, CompletionInput, CompletionResult } from "./types.js";

export class ClaudeCliProvider implements AiProvider {
  readonly tier = "CLI_CLAUDE" as const;

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      execFile("claude", ["--version"], { timeout: 5000 }, (err) => {
        resolve(!err);
      });
    });
  }

  async complete(input: CompletionInput): Promise<CompletionResult> {
    const args = ["-p", input.prompt];
    if (input.system) {
      args.push("--system", input.system);
    }

    const text = await new Promise<string>((resolve, reject) => {
      execFile("claude", args, { timeout: 300_000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) return reject(new Error(`claude CLI error: ${stderr || err.message}`));
        resolve(stdout.trim());
      });
    });

    return {
      text,
      usage: { inputTokens: 0, outputTokens: 0 },
      model: "claude-cli",
    };
  }
}

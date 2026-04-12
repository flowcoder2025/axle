import type { AiProvider, CompletionInput, CompletionResult } from "./types.js";

const DEFAULT_BASE_URL = "http://localhost:8321";

export class LocalMlxProvider implements AiProvider {
  readonly tier = "LOCAL_MLX" as const;
  private readonly baseUrl: string;

  constructor(baseUrl = DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async complete(input: CompletionInput): Promise<CompletionResult> {
    const messages: Array<{ role: string; content: string }> = [];
    if (input.system) messages.push({ role: "system", content: input.system });
    messages.push({ role: "user", content: input.prompt });

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: input.model ?? "mlx-hermes-3",
        messages,
        max_tokens: input.maxTokens ?? 2048,
      }),
    });

    if (!res.ok) {
      throw new Error(`MLX proxy error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as {
      choices: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };
    return {
      text: data.choices[0]?.message?.content ?? "",
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
      model: data.model ?? "mlx-local",
    };
  }
}

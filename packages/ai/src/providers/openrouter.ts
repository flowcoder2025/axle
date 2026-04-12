/**
 * OpenRouter Provider — unified API gateway for multiple AI models.
 *
 * Uses OpenAI-compatible chat completions endpoint.
 * Supports Claude, GPT, Gemini, Llama, Mistral, etc. via a single API key.
 *
 * Env: OPENROUTER_API_KEY
 * Docs: https://openrouter.ai/docs
 */
import type { AiProvider, CompletionInput, CompletionResult } from "./types.js";

const BASE_URL = "https://openrouter.ai/api/v1";

/** Default model — cheapest Claude on OpenRouter */
const DEFAULT_MODEL = "anthropic/claude-haiku-4.5";

export class OpenRouterProvider implements AiProvider {
  readonly tier = "API_HAIKU" as const;
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(apiKey?: string, defaultModel?: string) {
    this.apiKey = apiKey ?? process.env.OPENROUTER_API_KEY ?? "";
    this.defaultModel = defaultModel ?? DEFAULT_MODEL;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async complete(input: CompletionInput): Promise<CompletionResult> {
    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY is required");
    }

    const messages: Array<{ role: string; content: string }> = [];
    if (input.system) messages.push({ role: "system", content: input.system });
    messages.push({ role: "user", content: input.prompt });

    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "HTTP-Referer": "https://axle-delta.vercel.app",
        "X-Title": "AXLE",
      },
      body: JSON.stringify({
        model: input.model ?? this.defaultModel,
        messages,
        max_tokens: input.maxTokens ?? 2048,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenRouter error ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    const choices = data.choices as Array<{ message: { content: string } }> | undefined;
    const usage = data.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;

    return {
      text: choices?.[0]?.message?.content ?? "",
      usage: {
        inputTokens: usage?.prompt_tokens ?? 0,
        outputTokens: usage?.completion_tokens ?? 0,
      },
      model: (data.model as string) ?? this.defaultModel,
    };
  }
}

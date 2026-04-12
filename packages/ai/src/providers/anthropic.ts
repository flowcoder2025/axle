import Anthropic from "@anthropic-ai/sdk";
import type { AiTier } from "@prisma/client";
import type { AiProvider, CompletionInput, CompletionResult } from "./types.js";

const MODEL_TO_TIER: Record<string, AiTier> = {
  "claude-haiku-4-5-20251001": "API_HAIKU",
  "claude-sonnet-4-6": "API_HAIKU",
  "claude-opus-4-6": "API_OPUS",
};

export class AnthropicProvider implements AiProvider {
  readonly tier: AiTier;
  private readonly model: string;
  private client: Anthropic | null = null;

  constructor(model = "claude-haiku-4-5-20251001") {
    this.model = model;
    this.tier = MODEL_TO_TIER[model] ?? "API_HAIKU";
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async complete(input: CompletionInput): Promise<CompletionResult> {
    if (!this.client) {
      this.client = new Anthropic();
    }

    const response = await this.client.messages.create({
      model: input.model ?? this.model,
      max_tokens: input.maxTokens ?? 2048,
      system: input.system,
      messages: [{ role: "user", content: input.prompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");

    return {
      text: textBlock?.text ?? "",
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      model: response.model,
    };
  }
}

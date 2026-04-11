import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic(); // uses ANTHROPIC_API_KEY env var
  }
  return _client;
}

export interface ClaudeCompletionInput {
  system?: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}

/**
 * Send a single prompt to Claude and return the text response.
 * Throws on API errors — callers should handle gracefully.
 */
export async function complete(input: ClaudeCompletionInput): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: input.model ?? "claude-haiku-4-5-20251001",
    max_tokens: input.maxTokens ?? 2048,
    system: input.system,
    messages: [{ role: "user", content: input.prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text ?? "";
}

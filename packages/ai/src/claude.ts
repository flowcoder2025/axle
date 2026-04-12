import { AnthropicProvider } from "./providers/anthropic.js";

const _provider = new AnthropicProvider();

export interface ClaudeCompletionInput {
  system?: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}

/**
 * @deprecated Use `getProvider("API_HAIKU").complete()` instead.
 */
export async function complete(input: ClaudeCompletionInput): Promise<string> {
  const result = await _provider.complete({
    system: input.system,
    prompt: input.prompt,
    maxTokens: input.maxTokens,
    model: input.model,
  });
  return result.text;
}

export type { AiProvider, CompletionInput, CompletionResult } from "./types.js";
export { AnthropicProvider } from "./anthropic.js";
export { LocalMlxProvider } from "./local-mlx.js";
export { ClaudeCliProvider } from "./claude-cli.js";
export { OpenRouterProvider } from "./openrouter.js";

import type { AiTier, AiJobType } from "@prisma/client";
import type { AiProvider } from "./types.js";
import { AnthropicProvider } from "./anthropic.js";
import { LocalMlxProvider } from "./local-mlx.js";
import { ClaudeCliProvider } from "./claude-cli.js";
import { OpenRouterProvider } from "./openrouter.js";
import { resolveAiTier } from "../router.js";
import type { RouterConfig } from "../router.js";

const openRouter = new OpenRouterProvider();

const providers: Record<AiTier, AiProvider> = {
  API_HAIKU: new AnthropicProvider("claude-haiku-4-5-20251001"),
  API_OPUS: new AnthropicProvider("claude-opus-4-6"),
  CLI_CLAUDE: new ClaudeCliProvider(),
  LOCAL_MLX: new LocalMlxProvider(),
};

/** Fallback chain: resolved provider → OpenRouter → API_HAIKU */
const fallbackChain: AiProvider[] = [
  openRouter,
  providers.API_HAIKU,
];

export function getProvider(tier: AiTier): AiProvider {
  return providers[tier];
}

/**
 * Resolve tier for a job type, then return an available provider.
 * Fallback order: resolved tier → OpenRouter → API_HAIKU.
 */
export async function resolveProvider(
  jobType: AiJobType,
  config?: RouterConfig
): Promise<AiProvider> {
  const tier = resolveAiTier(jobType, config);
  const primary = providers[tier];

  if (await primary.isAvailable()) return primary;

  for (const fb of fallbackChain) {
    if (await fb.isAvailable()) return fb;
  }

  // Last resort — return primary even if unavailable (will error on call)
  return primary;
}

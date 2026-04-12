export type { AiProvider, CompletionInput, CompletionResult } from "./types.js";
export { AnthropicProvider } from "./anthropic.js";
export { LocalMlxProvider } from "./local-mlx.js";
export { ClaudeCliProvider } from "./claude-cli.js";

import type { AiTier, AiJobType } from "@prisma/client";
import type { AiProvider } from "./types.js";
import { AnthropicProvider } from "./anthropic.js";
import { LocalMlxProvider } from "./local-mlx.js";
import { ClaudeCliProvider } from "./claude-cli.js";
import { resolveAiTier } from "../router.js";
import type { RouterConfig } from "../router.js";

const providers: Record<AiTier, AiProvider> = {
  API_HAIKU: new AnthropicProvider("claude-haiku-4-5-20251001"),
  API_OPUS: new AnthropicProvider("claude-opus-4-6"),
  CLI_CLAUDE: new ClaudeCliProvider(),
  LOCAL_MLX: new LocalMlxProvider(),
};

export function getProvider(tier: AiTier): AiProvider {
  return providers[tier];
}

export async function resolveProvider(
  jobType: AiJobType,
  config?: RouterConfig
): Promise<AiProvider> {
  const tier = resolveAiTier(jobType, config);
  const provider = providers[tier];
  if (await provider.isAvailable()) return provider;
  return providers.API_HAIKU;
}

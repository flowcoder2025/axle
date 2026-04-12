import type { AiTier } from "@prisma/client";

export interface CompletionInput {
  system?: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
}

export interface CompletionResult {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
}

export interface AiProvider {
  readonly tier: AiTier;
  isAvailable(): Promise<boolean>;
  complete(input: CompletionInput): Promise<CompletionResult>;
}

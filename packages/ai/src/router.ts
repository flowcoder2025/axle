import type { AiJobType, AiTier } from "@prisma/client";

export interface RouterConfig {
  forceApiMode?: boolean;
  defaultApiTier?: AiTier;
  localAvailable?: boolean;
}

/**
 * Resolve which AI tier should handle a given job type.
 *
 * 3-Tier routing:
 *   CLI_CLAUDE  — long-running, high-quality generation (BUSINESS_PLAN, RESEARCH)
 *   LOCAL_MLX   — fast local inference when available (JOURNAL_DRAFT, SUMMARY, OCR, TRANSCRIBE)
 *   API_HAIKU   — always-available cloud fallback for everything else
 */
export function resolveAiTier(jobType: AiJobType, config?: RouterConfig): AiTier {
  if (config?.forceApiMode) return config.defaultApiTier ?? "API_HAIKU";

  const isLocalAvailable = config?.localAvailable ?? false;

  switch (jobType) {
    case "BUSINESS_PLAN":
    case "RESEARCH":
      return "CLI_CLAUDE";

    case "JOURNAL_DRAFT":
    case "SUMMARY":
    case "OCR":
    case "TRANSCRIBE":
      return isLocalAvailable ? "LOCAL_MLX" : "API_HAIKU";

    case "FINANCIAL_ANALYSIS":
    case "GAP_DIAGNOSIS":
    case "EVALUATION":
    case "MATCHING":
      return "API_HAIKU";

    default:
      return "API_HAIKU";
  }
}

import type { AiJobType, AiTier } from "@prisma/client";
import { hasPromotedPatternFor } from "./skill-pattern/promotion.js";

export interface RouterConfig {
  forceApiMode?: boolean;
  defaultApiTier?: AiTier;
  localAvailable?: boolean;
  /**
   * If true and a PROMOTED SkillPattern exists for this task type,
   * resolveAiTierAsync returns LOCAL_MLX (requires localAvailable=true).
   * Default: true.
   */
  preferPromotedPattern?: boolean;
}

/**
 * Resolve which AI tier should handle a given job type.
 *
 * 3-Tier routing:
 *   CLI_CLAUDE  — long-running, high-quality generation (BUSINESS_PLAN, RESEARCH)
 *   LOCAL_MLX   — fast local inference when available (JOURNAL_DRAFT, SUMMARY, OCR, TRANSCRIBE)
 *   API_HAIKU   — always-available cloud fallback for everything else
 *
 * This is the legacy pure-function version. For the DB-aware version that
 * promotes LOCAL_MLX when a fine-tuned pattern is available for the task,
 * use `resolveAiTierAsync`.
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

/**
 * DB-aware resolution: checks SkillPattern promotion state for LOCAL_MLX routing.
 *
 * Order of precedence:
 *   1. forceApiMode → always use defaultApiTier
 *   2. preferPromotedPattern + localAvailable + PROMOTED pattern exists → LOCAL_MLX
 *   3. Fall back to resolveAiTier (legacy static routing)
 */
export async function resolveAiTierAsync(
  jobType: AiJobType,
  config?: RouterConfig,
): Promise<AiTier> {
  if (config?.forceApiMode) return config.defaultApiTier ?? "API_HAIKU";

  const prefer = config?.preferPromotedPattern ?? true;
  const localAvailable = config?.localAvailable ?? false;

  if (prefer && localAvailable) {
    const promoted = await hasPromotedPatternFor(jobType);
    if (promoted) return "LOCAL_MLX";
  }

  return resolveAiTier(jobType, config);
}

/**
 * Selector Self-Repair module.
 *
 * Phase 15: stub implementation — always returns null.
 * Phase 14 wiring: real implementation will:
 *   1. Take a screenshot of the failing selector's target page
 *   2. Send the screenshot + broken selector to the AI agent
 *   3. Parse the AI's suggested new selector
 *   4. Validate the new selector before returning
 */

export interface SelfRepairContext {
  /** The CSS/XPath selector that failed */
  brokenSelector: string;
  /** Name of the portal (for context) */
  portal: string;
  /** Action being performed when the selector failed */
  action: string;
  /** Base64-encoded screenshot of the page at time of failure */
  screenshotBase64?: string;
  /** Current page URL */
  pageUrl?: string;
}

export interface SelfRepairResult {
  /** Suggested replacement selector; null if repair not possible */
  newSelector: string | null;
  /** Confidence score 0–1 */
  confidence: number;
  /** Human-readable explanation of what changed */
  explanation?: string;
}

/**
 * Attempt to repair a broken CSS/XPath selector using AI analysis.
 *
 * Phase 15 stub: always returns null (no AI integration yet).
 * The interface is stable — Phase 14 will implement the real logic.
 */
export async function repairSelector(
  context: SelfRepairContext
): Promise<SelfRepairResult> {
  // Phase 15 stub: no-op
  void context;

  return {
    newSelector: null,
    confidence: 0,
    explanation: "Self-repair not yet implemented (Phase 15 stub)",
  };
}

/**
 * Check whether a selector is likely to be fragile (auto-generated IDs, etc.)
 * Returns a risk score 0–1 where 1 = very fragile.
 */
export function assessSelectorFragility(selector: string): number {
  let score = 0;

  // High-fragility patterns
  if (/nth-child\(\d+\)/.test(selector)) score += 0.3;
  if (/[a-f0-9]{8,}/.test(selector)) score += 0.3; // auto-generated hash IDs
  if (/style\s*=/.test(selector)) score += 0.2;
  if (selector.split(">").length > 5) score += 0.2; // deep nesting

  // Low-fragility indicators
  if (/\[data-testid/.test(selector)) score -= 0.4;
  if (/\[aria-label/.test(selector)) score -= 0.3;
  if (/\[role=/.test(selector)) score -= 0.2;

  return Math.min(1, Math.max(0, score));
}

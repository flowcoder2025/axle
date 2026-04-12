/**
 * Selector Self-Repair module.
 *
 * Uses Agent Bridge AI endpoint to analyze screenshots and suggest
 * replacement selectors when a CSS/XPath selector fails.
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

const AGENT_BRIDGE_URL = process.env.AGENT_BRIDGE_URL ?? "http://localhost:4100";

const REPAIR_PROMPT = `You are a web scraping expert. A CSS selector stopped working on a government portal.

Portal: {portal}
Action: {action}
Page URL: {pageUrl}
Broken selector: {brokenSelector}

Analyze the screenshot and suggest a replacement CSS selector that targets the same element.
Prefer stable selectors: [data-testid], [aria-label], [role], [name] attributes over fragile ones like nth-child or auto-generated IDs.

Respond in JSON only:
{"selector": "new CSS selector or null", "confidence": 0.0-1.0, "explanation": "why this selector should work"}`;

/**
 * Attempt to repair a broken CSS/XPath selector using AI analysis.
 *
 * Sends the screenshot + context to Agent Bridge AI endpoint.
 * Falls back to null result on any error (non-fatal).
 */
export async function repairSelector(
  context: SelfRepairContext
): Promise<SelfRepairResult> {
  if (!context.screenshotBase64) {
    return {
      newSelector: null,
      confidence: 0,
      explanation: "No screenshot provided for AI analysis",
    };
  }

  try {
    const prompt = REPAIR_PROMPT
      .replace("{portal}", context.portal)
      .replace("{action}", context.action)
      .replace("{pageUrl}", context.pageUrl ?? "unknown")
      .replace("{brokenSelector}", context.brokenSelector);

    const res = await fetch(`${AGENT_BRIDGE_URL}/api/ai/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "EVALUATION",
        prompt,
        imageBase64: context.screenshotBase64,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      return {
        newSelector: null,
        confidence: 0,
        explanation: `Agent Bridge returned ${res.status}`,
      };
    }

    const data = (await res.json()) as Record<string, unknown>;
    const text = (data.result as string) ?? "";

    // Extract JSON from response (may be wrapped in markdown)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        newSelector: null,
        confidence: 0,
        explanation: "Could not parse AI response",
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      selector?: string | null;
      confidence?: number;
      explanation?: string;
    };

    return {
      newSelector: parsed.selector ?? null,
      confidence: parsed.confidence ?? 0,
      explanation: parsed.explanation,
    };
  } catch (err) {
    return {
      newSelector: null,
      confidence: 0,
      explanation: `Self-repair failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
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

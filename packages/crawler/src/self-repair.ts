/**
 * Selector self-repair module.
 *
 * Phase 8: scaffolding only — repairSelector() returns null and logs the
 * failure. Actual AI-powered repair will be wired in Phase 14 via
 * agent-bridge (Claude Vision + DOM analysis).
 */
import type { ElementHandleLike, PageLike } from "./types.js";

export interface RepairLog {
  failedSelector: string;
  context: string;
  url: string;
  occurredAt: Date;
}

/** In-memory log of repair attempts (cleared between crawl runs). */
const repairLogs: RepairLog[] = [];

/** Returns a copy of all repair log entries. */
export function getRepairLogs(): readonly RepairLog[] {
  return [...repairLogs];
}

/** Clears the repair log. */
export function clearRepairLogs(): void {
  repairLogs.splice(0);
}

/**
 * Attempts to find an alternative selector for `failedSelector`.
 *
 * Phase 8 behaviour:
 * - Takes a screenshot (for future AI analysis).
 * - Logs the failure.
 * - Returns null (repair not yet implemented).
 *
 * Phase 14 will replace the body with a call to agent-bridge:
 * send screenshot + context to Claude Vision → receive candidate selectors
 * → validate each → return first working one.
 */
export async function repairSelector(
  page: PageLike,
  failedSelector: string,
  context: string
): Promise<string | null> {
  // Capture screenshot for future AI analysis (Phase 14).
  try {
    await page.screenshot({ encoding: "base64" });
  } catch {
    // Screenshot failure is non-fatal.
  }

  repairLogs.push({
    failedSelector,
    context,
    url: page.url(),
    occurredAt: new Date(),
  });

  // Phase 8: no repair logic yet.
  return null;
}

/**
 * Tries `action` with `selector`. If the element is not found, calls
 * repairSelector() to get an alternative. If repair succeeds, retries once
 * with the new selector. Returns true on success, false otherwise.
 */
export async function tryWithRepair(
  page: PageLike,
  selector: string,
  context: string,
  action: (element: ElementHandleLike) => Promise<void>
): Promise<boolean> {
  // First attempt with original selector.
  const el = await page.$(selector);
  if (el) {
    try {
      await action(el);
      return true;
    } catch {
      // Element found but action failed — try repair anyway.
    }
  }

  // Attempt repair.
  const repairedSelector = await repairSelector(page, selector, context);
  if (!repairedSelector) return false;

  // Retry with repaired selector.
  const repairedEl = await page.$(repairedSelector);
  if (!repairedEl) return false;

  try {
    await action(repairedEl);
    return true;
  } catch {
    return false;
  }
}

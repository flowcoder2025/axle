/**
 * WI-121: SkillPattern Collector
 *
 * On AiJob completion, extracts the pattern and stores it via
 * the @axle/ai extractAndStorePattern logic.
 */

import { extractAndStorePattern } from "@axle/ai";
import type { PatternExtractionInput } from "@axle/ai";

export interface JobCompletionEvent {
  jobId: string;
  /** AiJobType string value */
  type: string;
  input: unknown;
  output: unknown;
  success: boolean;
  /** Duration in milliseconds */
  durationMs?: number;
}

/**
 * Call this after any AiJob completes (success or failure).
 * Internally delegates to @axle/ai extractAndStorePattern.
 *
 * Failures are logged but do not throw — pattern collection is
 * best-effort and must not break the main job flow.
 */
export async function collectSkillPattern(
  event: JobCompletionEvent
): Promise<void> {
  const input: PatternExtractionInput = {
    aiJobId: event.jobId,
    type: event.type,
    input: event.input,
    output: event.output,
    success: event.success,
  };

  try {
    await extractAndStorePattern(input);
  } catch (err) {
    // Non-fatal: log and continue
    console.error(
      `[skill-pattern] Failed to collect pattern for job ${event.jobId}:`,
      err
    );
  }
}

/**
 * Prompt normalization for the orchestrator.
 *
 * `buildPrompt()` merges the active preset, injects a mode-aware system hint,
 * appends the negative prompt as an "Avoid:" tail, and notes the requested
 * aspect ratio. Providers receive the resulting single string as the
 * top-level text part; provider-specific augmentation (e.g. inline image
 * parts) stays inside each adapter.
 *
 * Spec: docs/specs/meta-platform/pbc-image-engine.md §3.2 / §4.
 */

import { applyPreset } from "./presets/index.js";
import type { GenerationMode, GenerationRequest } from "./types.js";

/**
 * Per-mode behavioural hint injected ahead of the caller's prompt. Empty
 * string for CREATE because the caller's free-form prompt is already enough;
 * the other six modes carry a one-line instruction that the underlying
 * provider can lean on.
 */
const MODE_HINTS: Record<GenerationMode, string> = {
  CREATE: "",
  EDIT:
    "Edit the provided source image according to the instructions while " +
    "preserving identity and untouched regions.",
  COMPOSITE:
    "Composite the supplied reference images into a unified scene that " +
    "matches the prompt.",
  POSTER:
    "Compose a poster layout with the product and logo as described. " +
    "Use readable typography and respect the requested aspect ratio.",
  DETAIL_EDIT:
    "Apply the edit only to the masked region (white = edit, black = " +
    "preserve). The mask dimensions match the source.",
  DETAIL_PAGE:
    "Produce an e-commerce detail-page image: clean background, the " +
    "product centered, no distracting elements.",
  RETOUCH:
    "Retouch the subject while preserving facial identity and natural " +
    "skin texture; avoid over-smoothing.",
};

function readSystemPrompt(req: GenerationRequest): string | undefined {
  const sp = req.metadata?.systemPrompt;
  return typeof sp === "string" && sp.trim().length > 0 ? sp.trim() : undefined;
}

/**
 * Build the final text prompt the provider sees.
 *
 * Order of concatenation:
 *   1. `metadata.systemPrompt` (preset or caller-supplied)
 *   2. mode hint (omitted for CREATE)
 *   3. caller's `prompt`
 *   4. `Avoid: <negativePrompt>` when a negative prompt is present
 *   5. `Aspect ratio: <value>.` when an aspect ratio is set
 *
 * Empty sections are dropped so the result never starts/ends with blank
 * lines or stray punctuation.
 */
export function buildPrompt(req: GenerationRequest): string {
  if (!req.prompt || req.prompt.trim().length === 0) {
    return "";
  }
  const merged = applyPreset(req);
  const systemPrompt = readSystemPrompt(merged);
  const modeHint = MODE_HINTS[merged.mode] ?? "";

  const sections: string[] = [];
  if (systemPrompt) sections.push(systemPrompt);
  if (modeHint) sections.push(modeHint);
  sections.push(merged.prompt.trim());
  if (merged.negativePrompt && merged.negativePrompt.trim().length > 0) {
    sections.push(`Avoid: ${merged.negativePrompt.trim()}`);
  }
  if (merged.aspectRatio) {
    sections.push(`Aspect ratio: ${merged.aspectRatio}.`);
  }

  return sections.join("\n\n");
}

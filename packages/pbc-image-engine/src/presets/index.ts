/**
 * Preset registry + application helper.
 *
 * Two ways to use a preset:
 *   1. Pass `style: "<id>"` on the request → consumers (or
 *      `applyPreset(req)`) merge the preset's defaults under the user's
 *      explicit fields.
 *   2. Spread it manually for app-side customization:
 *        const req = { ...RETOUCH_PRO, prompt, sourceImage };
 *
 * The merge is deep on `metadata` only (system prompts shouldn't be lost
 * just because the caller added an unrelated metadata key).
 */

import {
  ImageGenerationError,
  type GenerationRequest,
} from "../types.js";
import { RETOUCH_PRO } from "./retouch-pro.js";
import { RETOUCH_FREE } from "./retouch-free.js";
import type { Preset } from "./types.js";

export const PRESETS: Record<string, Preset> = {
  "retouch-pro": RETOUCH_PRO,
  "retouch-free": RETOUCH_FREE,
};

export function getPreset(id: string): Preset | undefined {
  return PRESETS[id];
}

export function listPresetIds(): string[] {
  return Object.keys(PRESETS);
}

/**
 * Register a new preset (e.g. apps registering their own retouch tiers or
 * an "ecommerce" style). Throws on id collision so two apps can't silently
 * shadow each other's presets at runtime.
 */
export function registerPreset(id: string, preset: Preset): void {
  if (id in PRESETS) {
    throw new ImageGenerationError(
      `Preset id '${id}' is already registered`,
      "INVALID_INPUT",
      false,
    );
  }
  PRESETS[id] = preset;
}

/**
 * Merge a preset (looked up by `req.style`) onto a request. Caller-supplied
 * fields win in every case; metadata is shallow-merged (caller wins per key).
 *
 * Returns the request unchanged when:
 *   - `req.style` is undefined / empty, or
 *   - the style id is not in `PRESETS`.
 *
 * That behaviour is intentional: a custom `req.style` like "moody-fashion"
 * may be a generation hint understood by the provider but not a registered
 * preset on the PBC side. We don't want to throw — that would force every
 * caller to pre-check ids.
 */
export function applyPreset(req: GenerationRequest): GenerationRequest {
  if (!req.style) return req;
  const preset = PRESETS[req.style];
  if (!preset) return req;

  const merged: GenerationRequest = { ...preset, ...req } as GenerationRequest;
  // Caller is a force-overrider on every primitive, but metadata should be
  // shallow-merged so the preset's systemPrompt survives a caller passing a
  // custom metadata for a different concern.
  if (preset.metadata || req.metadata) {
    merged.metadata = { ...(preset.metadata ?? {}), ...(req.metadata ?? {}) };
  }
  return merged;
}

export type { Preset } from "./types.js";
export {
  PRO_MODE_SYSTEM_PROMPT,
  RETOUCH_PRO,
} from "./retouch-pro.js";
export {
  FREE_MODE_SYSTEM_PROMPT,
  RETOUCH_FREE,
} from "./retouch-free.js";

/**
 * Provider auto-selection.
 *
 * The PBC ships with a sensible default preference list per generation mode,
 * but consumer apps can override:
 *   1. By pinning `request.provider` (caller wins outright).
 *   2. By passing `options.preferences` (custom ordered fallback list).
 *   3. By passing `options.available` (env-derived availability map — used so
 *      we don't return a provider whose API key is missing).
 *
 * The default preference list is **Direct API only** — ComfyUI Local / Cloud
 * are reserved for AX Studio's workflow engine and require an explicit
 * `request.provider` pin (a stray `selectProvider()` call should never push a
 * generic CREATE prompt to a ComfyUI graph the caller didn't ask for).
 *
 * Spec: docs/specs/meta-platform/pbc-image-engine.md §3.2.
 */

import {
  ImageGenerationError,
  type GenerationMode,
  type GenerationRequest,
  type ImageProvider,
} from "./types.js";

/**
 * Default ordered preference per mode. CREATE-style modes lean on Gemini
 * (google-genai) for speed; EDIT-style modes lean on Vertex's Imagen
 * capability models for stronger inpaint/mask handling.
 */
const DEFAULT_PREFERENCES: Record<GenerationMode, ImageProvider[]> = {
  CREATE: ["google-genai", "openrouter", "vertex-ai"],
  EDIT: ["vertex-ai", "google-genai", "openrouter"],
  COMPOSITE: ["google-genai", "vertex-ai", "openrouter"],
  POSTER: ["google-genai", "openrouter", "vertex-ai"],
  DETAIL_EDIT: ["vertex-ai", "google-genai", "openrouter"],
  DETAIL_PAGE: ["google-genai", "openrouter", "vertex-ai"],
  RETOUCH: ["vertex-ai", "google-genai", "openrouter"],
};

export interface SelectProviderOptions {
  /**
   * Availability map keyed by provider id. A provider is treated as
   * available when its entry is missing or `true`; only an explicit `false`
   * removes it from the candidate set. This lets callers pass partial maps
   * derived from `process.env`.
   */
  available?: Partial<Record<ImageProvider, boolean>>;
  /**
   * Override the per-mode default preference list. Useful for app-level
   * routing rules (e.g. "always try OpenRouter first because we have a
   * cached billing arrangement").
   */
  preferences?: ImageProvider[];
}

/**
 * Returns a snapshot of the per-mode default preference list. Exposed so
 * tests and downstream code can audit defaults without re-implementing them.
 */
export function getDefaultPreferences(mode: GenerationMode): ImageProvider[] {
  return [...DEFAULT_PREFERENCES[mode]];
}

/**
 * Pick a provider for the given request.
 *
 * Resolution order:
 *   1. If `request.provider` is set, the caller wins. Throw
 *      PROVIDER_UNAVAILABLE only when `options.available[provider]` is an
 *      explicit `false` (i.e. the caller pinned a provider whose env is
 *      not configured).
 *   2. Otherwise walk the preference list (`options.preferences` or the
 *      mode default) and return the first entry that isn't explicitly
 *      unavailable.
 *   3. If no candidate qualifies, throw PROVIDER_UNAVAILABLE.
 */
export function selectProvider(
  request: GenerationRequest,
  options: SelectProviderOptions = {},
): ImageProvider {
  if (!request || typeof request.mode !== "string") {
    throw new ImageGenerationError(
      "selectProvider requires a request with a valid mode",
      "INVALID_INPUT",
      false,
    );
  }
  if (!(request.mode in DEFAULT_PREFERENCES)) {
    throw new ImageGenerationError(
      `Unknown generation mode: ${request.mode}`,
      "INVALID_INPUT",
      false,
    );
  }

  const available = options.available ?? {};

  if (request.provider) {
    if (available[request.provider] === false) {
      throw new ImageGenerationError(
        `Pinned provider '${request.provider}' is not available`,
        "PROVIDER_UNAVAILABLE",
        false,
      );
    }
    return request.provider;
  }

  const preferences = options.preferences ?? DEFAULT_PREFERENCES[request.mode];
  for (const candidate of preferences) {
    if (available[candidate] !== false) {
      return candidate;
    }
  }

  throw new ImageGenerationError(
    `No image provider is available for mode '${request.mode}' (preferences: ${preferences.join(", ")})`,
    "PROVIDER_UNAVAILABLE",
    false,
  );
}

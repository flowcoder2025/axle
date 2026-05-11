/**
 * Orchestrator entry point.
 *
 * `generate()` is the single public surface consumer apps call to produce
 * an image. It:
 *   1. Validates the request shape.
 *   2. Merges any registered preset under the caller's fields.
 *   3. Picks a provider via `selectProvider()` (honouring `req.provider`).
 *   4. Looks up or lazily instantiates the matching `ImageProviderAdapter`.
 *   5. Delegates to `adapter.generate()` and normalises errors into
 *      `ImageGenerationError`.
 *   6. Attaches a `cost` estimate if the adapter didn't supply one.
 *
 * Provider instances can be injected via `options.providers` so tests avoid
 * real network calls and apps can plug pre-configured adapters (custom
 * `fetch`, base URLs, credentials).
 *
 * Spec: docs/specs/meta-platform/pbc-image-engine.md §3.2 / §4.
 */

import { getEstimatedCost } from "./cost.js";
import { applyPreset } from "./presets/index.js";
import {
  ComfyUICloudProvider,
  ComfyUILocalProvider,
  GoogleGenAIProvider,
  OpenRouterImageProvider,
  VertexAIProvider,
} from "./providers/index.js";
import type { ImageProviderAdapter } from "./providers/types.js";
import {
  selectProvider,
  type SelectProviderOptions,
} from "./selectProvider.js";
import {
  IMAGE_PROVIDERS,
  ImageGenerationError,
  type GenerationRequest,
  type GenerationResult,
  type ImageProvider,
} from "./types.js";

export interface GenerateOptions extends SelectProviderOptions {
  /**
   * Pre-built adapter instances keyed by provider id. When present, the
   * orchestrator uses these directly — useful for tests (mock fetch) and
   * apps that need custom credentials.
   */
  providers?: Partial<Record<ImageProvider, ImageProviderAdapter>>;
}

function validateRequest(req: GenerationRequest): void {
  if (!req || typeof req !== "object") {
    throw new ImageGenerationError(
      "generate() requires a GenerationRequest object",
      "INVALID_INPUT",
      false,
    );
  }
  if (typeof req.prompt !== "string" || req.prompt.trim().length === 0) {
    throw new ImageGenerationError(
      "prompt is required",
      "INVALID_INPUT",
      false,
    );
  }
  if (typeof req.mode !== "string") {
    throw new ImageGenerationError(
      "mode is required",
      "INVALID_INPUT",
      false,
    );
  }
}

function instantiateDefault(id: ImageProvider): ImageProviderAdapter {
  switch (id) {
    case "google-genai":
      return new GoogleGenAIProvider();
    case "vertex-ai":
      return new VertexAIProvider();
    case "openrouter":
      return new OpenRouterImageProvider();
    case "comfyui-local":
      return new ComfyUILocalProvider();
    case "comfyui-cloud":
      return new ComfyUICloudProvider();
    default: {
      const _exhaustive: never = id;
      throw new ImageGenerationError(
        `Unknown provider id: ${String(_exhaustive)}`,
        "INVALID_INPUT",
        false,
      );
    }
  }
}

function resolveAdapter(
  id: ImageProvider,
  injected: Partial<Record<ImageProvider, ImageProviderAdapter>> | undefined,
): ImageProviderAdapter {
  const direct = injected?.[id];
  if (direct) return direct;
  return instantiateDefault(id);
}

function deriveAvailability(
  injected: Partial<Record<ImageProvider, ImageProviderAdapter>> | undefined,
): Partial<Record<ImageProvider, boolean>> | undefined {
  if (!injected) return undefined;
  const out: Partial<Record<ImageProvider, boolean>> = {};
  for (const id of IMAGE_PROVIDERS) {
    if (id in injected) out[id] = true;
  }
  return out;
}

function normaliseError(err: unknown, providerId: ImageProvider): ImageGenerationError {
  if (err instanceof ImageGenerationError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new ImageGenerationError(
    `${providerId} generation failed: ${message}`,
    "UNKNOWN",
    false,
  );
}

/**
 * Generate an image. The single entry point apps should call.
 *
 * Behaviour:
 *   - `req.provider` wins outright (caller intent is law).
 *   - Otherwise `selectProvider()` walks the mode-default preference list,
 *     skipping providers whose `options.available[id]` is `false`.
 *   - When `options.providers` is given, the orchestrator first treats
 *     those ids as "available" (so an injected mock for `vertex-ai`
 *     participates in auto-selection without the caller setting `available`
 *     manually). The caller's `options.available` still overrides.
 */
export async function generate(
  req: GenerationRequest,
  options: GenerateOptions = {},
): Promise<GenerationResult> {
  validateRequest(req);

  const merged = applyPreset(req);

  const availabilityFromInjected = deriveAvailability(options.providers);
  const mergedAvailability: Partial<Record<ImageProvider, boolean>> = {
    ...(availabilityFromInjected ?? {}),
    ...(options.available ?? {}),
  };

  const providerId = selectProvider(merged, {
    available: mergedAvailability,
    preferences: options.preferences,
  });

  const adapter = resolveAdapter(providerId, options.providers);

  let result: GenerationResult;
  try {
    result = await adapter.generate(merged);
  } catch (err) {
    throw normaliseError(err, providerId);
  }

  if (!result.cost) {
    result = { ...result, cost: getEstimatedCost(merged) };
  }
  return result;
}

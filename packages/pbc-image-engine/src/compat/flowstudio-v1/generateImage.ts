/**
 * FlowStudio v1 compat — `generateImage` facade.
 *
 * Drop-in replacement for v1's `lib/imageProvider/generateImage.ts`. The
 * callsite migration is exactly:
 *
 *   - import { generateImage } from "@/lib/imageProvider";
 *   + import { generateImage } from "@axle/pbc-image-engine/compat/flowstudio-v1";
 *
 * Behavioural contract (preserved from v1):
 *   - `env: "google"` (default) routes to google-genai with
 *     `gemini-3-pro-image-preview`.
 *   - `env: "openrouter"` routes to OpenRouter.
 *   - `IMAGE_PROVIDER` env var is honored when `options.env` is omitted.
 *   - `model` override flows straight through to the underlying adapter.
 *
 * Behavioural contract (NEW from PBC, surfaced through this facade):
 *   - Errors are normalized to `ImageGenerationError` with stable codes —
 *     v1 used to leak vendor error shapes. Migrating callers should update
 *     catch blocks to use `err.code` instead of `err.status`.
 */

import {
  ImageGenerationError,
  type GenerationRequest,
  type GenerationResult,
  type ImageProvider,
} from "../../types.js";
import { GoogleGenAIProvider, type GoogleGenAIOptions } from "../../providers/googleGenAI.js";
import {
  OpenRouterImageProvider,
  type OpenRouterOptions,
} from "../../providers/openRouter.js";
import type { ImageProviderAdapter } from "../../providers/types.js";
import type {
  V1GenerateImageOptions,
  V1GenerateImageResult,
  V1ProviderEnv,
} from "./types.js";

/**
 * v1's hardcoded default model. v1 used the same model id for both `env`
 * values; the PBC's per-mode defaults differ but the v1 facade keeps the
 * old behaviour to avoid a silent model swap during migration.
 */
export const V1_DEFAULT_MODEL = "gemini-3-pro-image-preview";

/**
 * Optional adapter injection. Tests pass these in directly to verify the
 * shim's translation layer; production code never needs to set them.
 */
export interface V1CompatRuntimeOptions {
  googleProvider?: ImageProviderAdapter;
  openRouterProvider?: ImageProviderAdapter;
  /** Forwarded into provider constructors when no providers are injected. */
  providerOptions?: {
    google?: GoogleGenAIOptions;
    openRouter?: OpenRouterOptions;
  };
}

/**
 * Migrate a v1 call to the PBC.
 *
 * Performs three jobs:
 *   1. Resolves the provider env (`options.env` → `IMAGE_PROVIDER` env var
 *      → "google" default).
 *   2. Translates the v1 options shape into a canonical
 *      `GenerationRequest`.
 *   3. Translates the PBC `GenerationResult` back into the v1 result shape
 *      (`durationMs` instead of `duration`, no `cost` field).
 */
export async function generateImage(
  options: V1GenerateImageOptions,
  runtime: V1CompatRuntimeOptions = {},
): Promise<V1GenerateImageResult> {
  if (!options || typeof options.prompt !== "string" || options.prompt.trim() === "") {
    throw new ImageGenerationError("prompt is required", "INVALID_INPUT", false);
  }

  const env = resolveProviderEnv(options.env);
  const provider = resolveAdapter(env, runtime, options.signal);
  const request = toGenerationRequest(options, env);
  const result = await provider.generate(request);
  return toV1Result(result);
}

function resolveProviderEnv(explicit: V1ProviderEnv | undefined): V1ProviderEnv {
  if (explicit === "google" || explicit === "openrouter") return explicit;
  const fromEnv = process.env.IMAGE_PROVIDER?.toLowerCase();
  if (fromEnv === "openrouter") return "openrouter";
  if (fromEnv === "google") return "google";
  return "google"; // v1 default
}

function resolveAdapter(
  env: V1ProviderEnv,
  runtime: V1CompatRuntimeOptions,
  signal: AbortSignal | undefined,
): ImageProviderAdapter {
  if (env === "openrouter") {
    if (runtime.openRouterProvider) return runtime.openRouterProvider;
    const opts: OpenRouterOptions = { ...(runtime.providerOptions?.openRouter ?? {}) };
    if (signal) opts.signal = signal;
    return new OpenRouterImageProvider(opts);
  }
  if (runtime.googleProvider) return runtime.googleProvider;
  const opts: GoogleGenAIOptions = { ...(runtime.providerOptions?.google ?? {}) };
  if (signal) opts.signal = signal;
  return new GoogleGenAIProvider(opts);
}

/**
 * v1 had no explicit `mode` field — every call was effectively
 * CREATE/EDIT depending on whether a sourceImage was attached. This mirror
 * preserves that implicit rule.
 */
function toGenerationRequest(
  options: V1GenerateImageOptions,
  env: V1ProviderEnv,
): GenerationRequest {
  const provider: ImageProvider = env === "openrouter" ? "openrouter" : "google-genai";
  const mode = options.sourceImage ? "EDIT" : "CREATE";

  const out: GenerationRequest = {
    prompt: options.prompt,
    mode,
    provider,
    model: options.model ?? V1_DEFAULT_MODEL,
  };

  if (options.negativePrompt !== undefined) out.negativePrompt = options.negativePrompt;
  if (options.aspectRatio !== undefined) out.aspectRatio = options.aspectRatio;
  if (options.count !== undefined) out.count = options.count;
  if (options.sourceImage !== undefined) out.sourceImage = options.sourceImage;
  if (options.refImages !== undefined) out.refImages = options.refImages;
  if (options.metadata !== undefined) out.metadata = options.metadata;

  return out;
}

function toV1Result(result: GenerationResult): V1GenerateImageResult {
  return {
    images: result.images.map((img) => ({ base64: img.base64, mimeType: img.mimeType })),
    provider: result.provider,
    model: result.model,
    durationMs: result.duration,
    metadata: result.metadata,
  };
}

/**
 * Cost estimator.
 *
 * `getEstimatedCost()` produces a deterministic, conservative estimate of
 * what a `GenerationRequest` will cost in vendor USD and in app-internal
 * credits. The function never throws and never returns 0/NaN/negative
 * numbers — unknown combinations fall back to safe defaults so consumer
 * apps can render a cost preview unconditionally.
 *
 * Pricing here is intentionally a static, audited table rather than a live
 * lookup: the PBC must remain dep-free at install time and credit
 * deduction itself is owned by the consumer app's billing layer (this
 * function only powers UI previews and pre-call budget checks).
 *
 * Spec: docs/specs/meta-platform/pbc-image-engine.md §3.2.
 */

import { selectProvider } from "./selectProvider.js";
import type {
  AspectRatio,
  GenerationCost,
  GenerationRequest,
  ImageProvider,
} from "./types.js";

/** Conservative base USD per image (single, default-aspect, count=1). */
const PROVIDER_BASE_USD: Record<ImageProvider, number> = {
  "google-genai": 0.04,
  "vertex-ai": 0.05,
  openrouter: 0.06,
  "comfyui-local": 0.001,
  "comfyui-cloud": 0.03,
};

/** Aspect-ratio multiplier — wider canvases run a hair more expensive. */
const ASPECT_MULTIPLIER: Record<AspectRatio, number> = {
  "1:1": 1.0,
  "3:4": 1.0,
  "4:3": 1.0,
  "9:16": 1.1,
  "16:9": 1.1,
  "2:3": 1.0,
  "3:2": 1.0,
};

const DEFAULT_PROVIDER: ImageProvider = "google-genai";
const DEFAULT_BASE_USD = 0.05;
const MIN_USD = 0.001;
const MIN_CREDITS = 1;
const USD_TO_CREDITS = 100;

function clampCount(count: number | undefined): number {
  if (!Number.isFinite(count) || !count || count < 1) return 1;
  return Math.min(8, Math.floor(count));
}

function resolveProvider(req: GenerationRequest): ImageProvider {
  if (req.provider) return req.provider;
  try {
    return selectProvider(req);
  } catch {
    return DEFAULT_PROVIDER;
  }
}

function aspectMultiplier(ratio: AspectRatio | undefined): number {
  if (!ratio) return 1.0;
  return ASPECT_MULTIPLIER[ratio] ?? 1.0;
}

/**
 * Estimate the credit + USD cost for the request. Pure / side-effect free /
 * never throws. The numbers are conservative — apps should treat them as
 * upper-bound previews, not exact charges.
 */
export function getEstimatedCost(req: GenerationRequest): GenerationCost {
  const provider = resolveProvider(req);
  const baseUsd = PROVIDER_BASE_USD[provider] ?? DEFAULT_BASE_USD;
  const count = clampCount(req.count);
  const mult = aspectMultiplier(req.aspectRatio);

  const rawUsd = baseUsd * count * mult;
  const usd = Math.max(MIN_USD, Number(rawUsd.toFixed(4)));
  const credits = Math.max(MIN_CREDITS, Math.ceil(usd * USD_TO_CREDITS));

  return { credits, usd };
}

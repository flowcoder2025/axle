/**
 * FlowStudio v1 → PBC compatibility surface — types.
 *
 * These types mirror FlowStudio v1's `lib/imageProvider/` public shape so a
 * migrating callsite can replace its imports with no further refactor.
 *
 * Spec source: docs/specs/meta-platform/pbc-image-engine.md §2 (table row
 * "FlowStudio v1 | lib/imageProvider/ (env: google|openrouter) |
 * gemini-3-pro-image-preview").
 *
 * The mapping to canonical PBC types is documented in
 * `docs/specs/meta-platform/migrations/flowstudio-v1-to-pbc.md`.
 */

/**
 * The provider-env knob FlowStudio v1 used. v1 read this from
 * `process.env.IMAGE_PROVIDER` (default "google"). The compat layer maps
 * this to the canonical `ImageProvider` ids.
 */
export type V1ProviderEnv = "google" | "openrouter";

export interface V1GenerateImageOptions {
  /** User text prompt. Required. */
  prompt: string;
  /**
   * Provider switch — `"google"` or `"openrouter"`. Omit to read from env
   * (`IMAGE_PROVIDER`); defaults to `"google"` to match v1 behaviour.
   */
  env?: V1ProviderEnv;
  /**
   * Model id to override v1's default. v1's default was
   * `gemini-3-pro-image-preview` regardless of env.
   */
  model?: string;
  /** Base64 or data: URL of a source image (v1 used this for EDIT calls). */
  sourceImage?: string;
  /** Reference images, base64 or data: URL. */
  refImages?: string[];
  /** Negative prompt forwarded to the model. */
  negativePrompt?: string;
  /**
   * Aspect ratio. v1 accepted the same 7-bucket strings the PBC uses, so
   * this passes through unchanged.
   */
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | "2:3" | "3:2";
  /** Number of variants. v1 clamped to 1..4; PBC clamps to 1..8 internally. */
  count?: number;
  /**
   * v1 carried a free-form metadata bag for trace ids, app context, etc.
   * Forwarded as-is into the PBC request's `metadata` field.
   */
  metadata?: Record<string, unknown>;
  /** AbortSignal — v1 supported cancellation; PBC honors it on fetch. */
  signal?: AbortSignal;
}

export interface V1GeneratedImage {
  /** Base64-encoded image bytes (no `data:` prefix). */
  base64: string;
  /** MIME type, e.g. `image/png`. */
  mimeType: string;
}

export interface V1GenerateImageResult {
  /** One or more images, in the same order v1 returned them. */
  images: V1GeneratedImage[];
  /** Resolved provider id (PBC canonical, not v1 env name). */
  provider: string;
  /** Resolved model id. */
  model: string;
  /** Wall-clock duration in ms. */
  durationMs: number;
  /**
   * v1 surfaced `metadata` from the underlying provider; PBC forwards its
   * own metadata bag here.
   */
  metadata?: Record<string, unknown>;
}

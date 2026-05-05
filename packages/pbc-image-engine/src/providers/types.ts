/**
 * Provider adapter contract.
 *
 * Each entry in `IMAGE_PROVIDERS` (google-genai / vertex-ai / openrouter /
 * comfyui-local / comfyui-cloud) ships an `ImageProviderAdapter` that knows
 * how to translate the PBC's `GenerationRequest` into a vendor-specific HTTP
 * call and turn the response back into a `GenerationResult`.
 *
 * The orchestrator (WI-403) picks one adapter per request via
 * `selectProvider()`; this file only defines the shared shape.
 */

import type {
  GenerationMode,
  GenerationRequest,
  GenerationResult,
  ImageProvider,
} from "../types.js";

export interface ImageProviderAdapter {
  /** Stable identifier matching `IMAGE_PROVIDERS`. */
  readonly id: ImageProvider;

  /**
   * Returns true when the adapter has the credentials / config it needs to
   * make a real call. Used by `selectProvider()` to skip unconfigured
   * providers without throwing.
   */
  isAvailable(): boolean;

  /**
   * Default model identifier the adapter will reach for when the request
   * doesn't pin one. Per-mode because (e.g.) RETOUCH typically wants a
   * different model than CREATE.
   */
  defaultModel(mode: GenerationMode): string;

  /**
   * Execute the generation. Implementations MUST throw
   * `ImageGenerationError` (with a documented `code`) on failure rather than
   * leaking vendor-specific error shapes.
   */
  generate(req: GenerationRequest): Promise<GenerationResult>;
}

/** Convenience: the union of providers that talk to a Direct API (HTTP). */
export type DirectApiProvider = Extract<
  ImageProvider,
  "google-genai" | "vertex-ai" | "openrouter"
>;

/** `fetch` is injectable so unit tests can stub HTTP without nock/msw. */
export type FetchLike = typeof fetch;

export interface ProviderRuntimeOptions {
  /** Override fetch for tests. Defaults to global fetch. */
  fetch?: FetchLike;
  /** Per-request abort signal. Adapters MUST forward this to fetch. */
  signal?: AbortSignal;
}

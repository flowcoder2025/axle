/**
 * pbc-image-engine — public type contract.
 *
 * All consumer apps (FlowStudio v1/v2/_re, FlowRetouch, AX Studio, AX Studio
 * Cloud, AX Studio YH) speak this single shape, regardless of whether the
 * underlying provider is a Direct API (Gemini / Vertex / OpenRouter) or a
 * ComfyUI workflow.
 *
 * Spec: docs/specs/meta-platform/pbc-image-engine.md §3.1
 */

export const IMAGE_PROVIDERS = [
  "google-genai",
  "vertex-ai",
  "openrouter",
  "comfyui-local",
  "comfyui-cloud",
] as const;

export type ImageProvider = (typeof IMAGE_PROVIDERS)[number];

export const GENERATION_MODES = [
  "CREATE",
  "EDIT",
  "COMPOSITE",
  "POSTER",
  "DETAIL_EDIT",
  "DETAIL_PAGE",
  "RETOUCH",
] as const;

export type GenerationMode = (typeof GENERATION_MODES)[number];

export const REFERENCE_MODES = ["style", "product", "composition", "full"] as const;

export type ReferenceMode = (typeof REFERENCE_MODES)[number];

export const ASPECT_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9", "2:3", "3:2"] as const;

export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export interface GenerationRequest {
  prompt: string;
  negativePrompt?: string;
  mode: GenerationMode;
  /** When omitted, the engine selects a provider via selectProvider(). */
  provider?: ImageProvider;
  /** Provider-specific model identifier (e.g. "gemini-3-pro-image-preview"). */
  model?: string;
  aspectRatio?: AspectRatio;
  /** Number of images to produce. Bounded 1..8. */
  count?: number;
  /** Reference images, base64-encoded data or fetchable URL. */
  refImages?: string[];
  referenceMode?: ReferenceMode;
  /** EDIT / RETOUCH / DETAIL_EDIT input. */
  sourceImage?: string;
  /** DETAIL_EDIT mask. */
  maskImage?: string;
  /** POSTER overlay logo. */
  logoImage?: string;
  /** Preset key — e.g. "retouch-pro", "wedding". */
  style?: string;
  metadata?: Record<string, unknown>;
}

export interface GeneratedImage {
  base64: string;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface GenerationCost {
  credits: number;
  usd: number;
}

export interface GenerationResult {
  images: GeneratedImage[];
  provider: ImageProvider;
  model: string;
  cost?: GenerationCost;
  /** Wall-clock duration in milliseconds. */
  duration: number;
  metadata?: Record<string, unknown>;
}

export const ERROR_CODES = [
  "INVALID_INPUT",
  "PROVIDER_UNAVAILABLE",
  "QUOTA_EXCEEDED",
  "CONTENT_FILTERED",
  "TIMEOUT",
  "UNKNOWN",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class ImageGenerationError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;

  constructor(message: string, code: ErrorCode, retryable = false) {
    super(message);
    this.name = "ImageGenerationError";
    this.code = code;
    this.retryable = retryable;
  }
}

/**
 * Public engine surface. Concrete `generate` / `selectProvider` /
 * `getEstimatedCost` shipped in WI-611 (orchestrator) on top of the
 * WI-402..WI-406 provider work; this interface stays exposed so dependent
 * PBCs (e.g. pbc-block-builder's RenderContext) can declare their
 * dependency against the contract instead of the implementation.
 */
export interface ImageEngine {
  generate(req: GenerationRequest): Promise<GenerationResult>;
  selectProvider(req: GenerationRequest): ImageProvider;
  getEstimatedCost(req: GenerationRequest): GenerationCost;
}

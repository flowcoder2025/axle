/**
 * vertex-ai provider — Google Cloud Vertex AI Imagen / Gemini image adapter.
 *
 * REST endpoint:
 *   POST https://{location}-aiplatform.googleapis.com/v1/projects/{project}
 *        /locations/{location}/publishers/google/models/{model}:predict
 *
 * Auth: OAuth bearer token. The PBC does not handle ADC bootstrap — callers
 * pass an `accessToken` (e.g. from `google-auth-library`) or set
 * `VERTEX_AI_ACCESS_TOKEN`. This keeps the package free of GCP SDK
 * dependencies and works in serverless runtimes.
 *
 * Spec: docs/specs/meta-platform/pbc-image-engine.md §3.1.
 */

import {
  ImageGenerationError,
  type ErrorCode,
  type GenerationMode,
  type GenerationRequest,
  type GenerationResult,
  type ImageProvider,
} from "../types.js";
import type { FetchLike, ImageProviderAdapter, ProviderRuntimeOptions } from "./types.js";

const DEFAULT_LOCATION = "us-central1";

const DEFAULT_MODELS: Record<GenerationMode, string> = {
  CREATE: "imagen-4.0-generate-preview-06-06",
  EDIT: "imagen-3.0-capability-001",
  COMPOSITE: "imagen-3.0-capability-001",
  POSTER: "imagen-4.0-generate-preview-06-06",
  DETAIL_EDIT: "imagen-3.0-capability-001",
  DETAIL_PAGE: "imagen-4.0-generate-preview-06-06",
  RETOUCH: "imagen-3.0-capability-001",
};

export interface VertexAIOptions extends ProviderRuntimeOptions {
  projectId?: string;
  location?: string;
  accessToken?: string;
  /** Overridable for tests. */
  baseUrl?: string;
  /**
   * If passed, the adapter calls this on every request to refresh tokens
   * (e.g. wrap `google-auth-library`'s `getAccessToken`). When omitted, the
   * static `accessToken` is used.
   */
  getAccessToken?: () => Promise<string>;
}

interface VertexPrediction {
  bytesBase64Encoded?: string;
  mimeType?: string;
  raiFilteredReason?: string;
}

interface VertexResponse {
  predictions?: VertexPrediction[];
  metadata?: Record<string, unknown>;
  error?: { code?: number; message?: string; status?: string };
}

export class VertexAIProvider implements ImageProviderAdapter {
  readonly id: ImageProvider = "vertex-ai";
  private readonly projectId: string;
  private readonly location: string;
  private readonly staticToken: string;
  private readonly getToken?: () => Promise<string>;
  private readonly baseUrl?: string;
  private readonly fetchImpl: FetchLike;
  private readonly signal?: AbortSignal;

  constructor(opts: VertexAIOptions = {}) {
    this.projectId =
      opts.projectId ??
      process.env.VERTEX_AI_PROJECT_ID ??
      process.env.GOOGLE_CLOUD_PROJECT ??
      "";
    this.location =
      opts.location ?? process.env.VERTEX_AI_LOCATION ?? DEFAULT_LOCATION;
    this.staticToken =
      opts.accessToken ?? process.env.VERTEX_AI_ACCESS_TOKEN ?? "";
    this.getToken = opts.getAccessToken;
    this.baseUrl = opts.baseUrl;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.signal = opts.signal;
  }

  isAvailable(): boolean {
    if (typeof this.fetchImpl !== "function") return false;
    if (!this.projectId) return false;
    return Boolean(this.staticToken) || typeof this.getToken === "function";
  }

  defaultModel(mode: GenerationMode): string {
    return DEFAULT_MODELS[mode];
  }

  async generate(req: GenerationRequest): Promise<GenerationResult> {
    if (!req.prompt || req.prompt.trim().length === 0) {
      throw new ImageGenerationError(
        "prompt is required",
        "INVALID_INPUT",
        false,
      );
    }
    if (!this.isAvailable()) {
      throw new ImageGenerationError(
        "vertex-ai is not configured (project id + access token required)",
        "PROVIDER_UNAVAILABLE",
        false,
      );
    }

    const token = await this.resolveToken();
    const model = req.model ?? this.defaultModel(req.mode);
    const url = this.urlFor(model);

    const instance: Record<string, unknown> = { prompt: req.prompt };
    if (req.negativePrompt) instance.negativePrompt = req.negativePrompt;
    const sourceImage = parseInlineImage(req.sourceImage);
    if (sourceImage) {
      instance.image = { bytesBase64Encoded: sourceImage.base64 };
    }
    const maskImage = parseInlineImage(req.maskImage);
    if (maskImage) {
      instance.mask = { image: { bytesBase64Encoded: maskImage.base64 } };
    }

    const body = {
      instances: [instance],
      parameters: {
        sampleCount: clampCount(req.count),
        aspectRatio: req.aspectRatio ?? "1:1",
      },
    };

    const startedAt = Date.now();
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: this.signal,
      });
    } catch (err) {
      throw new ImageGenerationError(
        `vertex-ai network error: ${(err as Error).message}`,
        "PROVIDER_UNAVAILABLE",
        true,
      );
    }

    if (!res.ok) {
      const text = await safeReadText(res);
      throw new ImageGenerationError(
        `vertex-ai HTTP ${res.status}: ${text.slice(0, 200)}`,
        statusToCode(res.status),
        res.status >= 500 || res.status === 429,
      );
    }

    const data = (await res.json()) as VertexResponse;

    const predictions = data.predictions ?? [];
    const blocked = predictions.find((p) => p.raiFilteredReason);
    if (blocked && predictions.every((p) => !p.bytesBase64Encoded)) {
      throw new ImageGenerationError(
        `vertex-ai content filtered: ${blocked.raiFilteredReason}`,
        "CONTENT_FILTERED",
        false,
      );
    }

    const images = predictions
      .filter((p): p is Required<Pick<VertexPrediction, "bytesBase64Encoded">> & VertexPrediction =>
        Boolean(p.bytesBase64Encoded),
      )
      .map((p) => ({
        base64: p.bytesBase64Encoded,
        mimeType: p.mimeType ?? "image/png",
      }));

    if (images.length === 0) {
      throw new ImageGenerationError(
        "vertex-ai returned no images",
        "UNKNOWN",
        true,
      );
    }

    return {
      images,
      provider: this.id,
      model,
      duration: Date.now() - startedAt,
      metadata: data.metadata,
    };
  }

  private async resolveToken(): Promise<string> {
    if (this.getToken) {
      const dynamic = await this.getToken();
      if (dynamic) return dynamic;
    }
    if (this.staticToken) return this.staticToken;
    throw new ImageGenerationError(
      "vertex-ai access token unavailable",
      "PROVIDER_UNAVAILABLE",
      false,
    );
  }

  private urlFor(model: string): string {
    if (this.baseUrl) {
      return `${this.baseUrl.replace(/\/+$/, "")}/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${encodeURIComponent(model)}:predict`;
    }
    return `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${encodeURIComponent(model)}:predict`;
  }
}

/* helpers (parallel to googleGenAI.ts but kept private to avoid coupling) */

function parseInlineImage(
  src: string | undefined,
): { mimeType: string; base64: string } | null {
  if (!src) return null;
  if (src.startsWith("data:")) {
    const match = src.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    return { mimeType: match[1] ?? "image/png", base64: match[2] ?? "" };
  }
  if (/^https?:\/\//i.test(src)) return null;
  return { mimeType: "image/png", base64: src };
}

function clampCount(n: number | undefined): number {
  if (!n || !Number.isFinite(n)) return 1;
  return Math.min(8, Math.max(1, Math.floor(n)));
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function statusToCode(status: number): ErrorCode {
  if (status === 400) return "INVALID_INPUT";
  if (status === 401 || status === 403) return "PROVIDER_UNAVAILABLE";
  if (status === 429) return "QUOTA_EXCEEDED";
  if (status === 504 || status === 408) return "TIMEOUT";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  return "UNKNOWN";
}

export const _internal = { parseInlineImage, clampCount, statusToCode };

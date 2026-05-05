/**
 * google-genai provider — Google AI Studio (Generative Language API) adapter.
 *
 * Uses the public REST endpoint (no SDK dependency) so the package stays
 * dependency-free at install time:
 *   POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 *
 * Auth: GEMINI_API_KEY (or GOOGLE_GENAI_API_KEY as a fallback name).
 *
 * For image-generation models (`gemini-*-image-preview`, `imagen-*`) the
 * response carries one or more `inlineData` parts with `{mimeType, data}`
 * where `data` is base64.
 *
 * Source-of-truth shape: spec §3.1 (`GenerationRequest` / `GenerationResult`).
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

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/** Per-mode default models (overridable via request.model). */
const DEFAULT_MODELS: Record<GenerationMode, string> = {
  CREATE: "gemini-3-pro-image-preview",
  EDIT: "gemini-3-pro-image-preview",
  COMPOSITE: "gemini-3-pro-image-preview",
  POSTER: "gemini-3-pro-image-preview",
  DETAIL_EDIT: "gemini-3-pro-image-preview",
  DETAIL_PAGE: "gemini-3-pro-image-preview",
  RETOUCH: "gemini-3-pro-image-preview",
};

export interface GoogleGenAIOptions extends ProviderRuntimeOptions {
  apiKey?: string;
  /** Override the API base URL — used by tests, never in production. */
  baseUrl?: string;
}

interface InlineDataCamel {
  mimeType?: string;
  data?: string;
}
interface InlineDataSnake {
  mime_type?: string;
  data?: string;
}
interface InlineDataPart {
  inlineData?: InlineDataCamel;
  inline_data?: InlineDataSnake;
}

interface GoogleGenAIResponse {
  candidates?: Array<{
    content?: { parts?: InlineDataPart[] };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
}

export class GoogleGenAIProvider implements ImageProviderAdapter {
  readonly id: ImageProvider = "google-genai";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly signal?: AbortSignal;

  constructor(opts: GoogleGenAIOptions = {}) {
    this.apiKey =
      opts.apiKey ??
      process.env.GEMINI_API_KEY ??
      process.env.GOOGLE_GENAI_API_KEY ??
      "";
    this.baseUrl = (opts.baseUrl ?? BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.signal = opts.signal;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey) && typeof this.fetchImpl === "function";
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
        "GEMINI_API_KEY is not configured",
        "PROVIDER_UNAVAILABLE",
        false,
      );
    }

    const model = req.model ?? this.defaultModel(req.mode);
    const url = `${this.baseUrl}/models/${encodeURIComponent(model)}:generateContent`;

    const parts: Array<Record<string, unknown>> = [{ text: this.buildPrompt(req) }];
    for (const ref of inputImagesFor(req)) {
      parts.push({
        inlineData: {
          mimeType: ref.mimeType,
          data: ref.base64,
        },
      });
    }

    const body = {
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        candidateCount: clampCount(req.count),
      },
    };

    const startedAt = Date.now();
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify(body),
        signal: this.signal,
      });
    } catch (err) {
      throw new ImageGenerationError(
        `google-genai network error: ${(err as Error).message}`,
        "PROVIDER_UNAVAILABLE",
        true,
      );
    }

    if (!res.ok) {
      const text = await safeReadText(res);
      throw new ImageGenerationError(
        `google-genai HTTP ${res.status}: ${text.slice(0, 200)}`,
        statusToCode(res.status),
        res.status >= 500 || res.status === 429,
      );
    }

    const data = (await res.json()) as GoogleGenAIResponse;
    if (data.promptFeedback?.blockReason) {
      throw new ImageGenerationError(
        `google-genai content blocked: ${data.promptFeedback.blockReason}`,
        "CONTENT_FILTERED",
        false,
      );
    }

    const images = extractInlineImages(data);
    if (images.length === 0) {
      throw new ImageGenerationError(
        "google-genai returned no images",
        "UNKNOWN",
        true,
      );
    }

    return {
      images,
      provider: this.id,
      model,
      duration: Date.now() - startedAt,
      metadata: {
        finishReason: data.candidates?.[0]?.finishReason,
      },
    };
  }

  private buildPrompt(req: GenerationRequest): string {
    if (!req.negativePrompt) return req.prompt;
    return `${req.prompt}\n\nDo NOT include: ${req.negativePrompt}`;
  }
}

/* ------------------------------------------------------------------ */
/* shared helpers (also reused by tests via re-export)                 */
/* ------------------------------------------------------------------ */

function inputImagesFor(
  req: GenerationRequest,
): Array<{ mimeType: string; base64: string }> {
  const out: Array<{ mimeType: string; base64: string }> = [];
  for (const candidate of [req.sourceImage, req.maskImage, req.logoImage]) {
    const parsed = parseInlineImage(candidate);
    if (parsed) out.push(parsed);
  }
  for (const ref of req.refImages ?? []) {
    const parsed = parseInlineImage(ref);
    if (parsed) out.push(parsed);
  }
  return out;
}

/**
 * Accepts either a `data:image/png;base64,...` URI or a raw base64 string and
 * returns the parts the Google API needs. Returns `null` for non-base64 URLs
 * (those need to be fetched server-side, which is out of scope for this PBC).
 */
function parseInlineImage(
  src: string | undefined,
): { mimeType: string; base64: string } | null {
  if (!src) return null;
  if (src.startsWith("data:")) {
    const match = src.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    return { mimeType: match[1] ?? "image/png", base64: match[2] ?? "" };
  }
  if (/^https?:\/\//i.test(src)) return null; // remote URL — caller must inline
  // assume raw base64 bytes
  return { mimeType: "image/png", base64: src };
}

function extractInlineImages(
  data: GoogleGenAIResponse,
): Array<{ base64: string; mimeType: string }> {
  const out: Array<{ base64: string; mimeType: string }> = [];
  for (const candidate of data.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const camel: InlineDataCamel | undefined = part.inlineData;
      const snake: InlineDataSnake | undefined = part.inline_data;
      const mimeType = camel?.mimeType ?? snake?.mime_type;
      const base64 = camel?.data ?? snake?.data;
      if (base64 && mimeType) {
        out.push({ base64, mimeType });
      }
    }
  }
  return out;
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

export const _internal = { parseInlineImage, extractInlineImages, clampCount, statusToCode };

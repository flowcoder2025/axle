/**
 * openrouter provider — image generation via OpenRouter's chat-completions
 * gateway. Some upstream image models (e.g. `google/gemini-2.5-flash-image-preview`)
 * are exposed through the same `/chat/completions` endpoint and return
 * generated images in `choices[0].message.images[]` with data URLs.
 *
 *   POST https://openrouter.ai/api/v1/chat/completions
 *
 * Auth: OPENROUTER_API_KEY.
 *
 * This adapter purposefully mirrors the same interface as `GoogleGenAIProvider`
 * so that FlowStudio v2's `imageProvider/openRouter.ts` migrates 1:1.
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

const BASE_URL = "https://openrouter.ai/api/v1";

const DEFAULT_MODELS: Record<GenerationMode, string> = {
  CREATE: "google/gemini-2.5-flash-image-preview",
  EDIT: "google/gemini-2.5-flash-image-preview",
  COMPOSITE: "google/gemini-2.5-flash-image-preview",
  POSTER: "google/gemini-2.5-flash-image-preview",
  DETAIL_EDIT: "google/gemini-2.5-flash-image-preview",
  DETAIL_PAGE: "google/gemini-2.5-flash-image-preview",
  RETOUCH: "google/gemini-2.5-flash-image-preview",
};

export interface OpenRouterOptions extends ProviderRuntimeOptions {
  apiKey?: string;
  baseUrl?: string;
  /** Forwarded as `HTTP-Referer` per OpenRouter docs (used for attribution). */
  referer?: string;
  /** Forwarded as `X-Title`. */
  appTitle?: string;
}

interface ChatImage {
  type?: string;
  image_url?: { url?: string };
}

interface ChatMessage {
  role?: string;
  content?: string | Array<{ type?: string; text?: string; image_url?: { url?: string } }>;
  images?: ChatImage[];
}

interface OpenRouterResponse {
  choices?: Array<{ message?: ChatMessage; finish_reason?: string }>;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { code?: number; message?: string };
}

export class OpenRouterImageProvider implements ImageProviderAdapter {
  readonly id: ImageProvider = "openrouter";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly referer?: string;
  private readonly appTitle?: string;
  private readonly fetchImpl: FetchLike;
  private readonly signal?: AbortSignal;

  constructor(opts: OpenRouterOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.OPENROUTER_API_KEY ?? "";
    this.baseUrl = (opts.baseUrl ?? BASE_URL).replace(/\/+$/, "");
    this.referer = opts.referer ?? process.env.OPENROUTER_REFERER;
    this.appTitle = opts.appTitle ?? process.env.OPENROUTER_APP_TITLE ?? "AXLE";
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
        "OPENROUTER_API_KEY is not configured",
        "PROVIDER_UNAVAILABLE",
        false,
      );
    }

    const model = req.model ?? this.defaultModel(req.mode);
    const url = `${this.baseUrl}/chat/completions`;

    const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { type: "text", text: this.buildPrompt(req) },
    ];
    for (const ref of inputImageUrlsFor(req)) {
      userContent.push({ type: "image_url", image_url: { url: ref } });
    }

    const body = {
      model,
      messages: [{ role: "user", content: userContent }],
      modalities: ["image", "text"],
      n: clampCount(req.count),
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      "X-Title": this.appTitle ?? "AXLE",
    };
    if (this.referer) headers["HTTP-Referer"] = this.referer;

    const startedAt = Date.now();
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: this.signal,
      });
    } catch (err) {
      throw new ImageGenerationError(
        `openrouter network error: ${(err as Error).message}`,
        "PROVIDER_UNAVAILABLE",
        true,
      );
    }

    if (!res.ok) {
      const text = await safeReadText(res);
      throw new ImageGenerationError(
        `openrouter HTTP ${res.status}: ${text.slice(0, 200)}`,
        statusToCode(res.status),
        res.status >= 500 || res.status === 429,
      );
    }

    const data = (await res.json()) as OpenRouterResponse;
    const message = data.choices?.[0]?.message;
    const images = extractImagesFromMessage(message);
    if (images.length === 0) {
      throw new ImageGenerationError(
        "openrouter returned no images",
        "UNKNOWN",
        true,
      );
    }

    return {
      images,
      provider: this.id,
      model: data.model ?? model,
      duration: Date.now() - startedAt,
      metadata: {
        usage: data.usage,
        finishReason: data.choices?.[0]?.finish_reason,
      },
    };
  }

  private buildPrompt(req: GenerationRequest): string {
    if (!req.negativePrompt) return req.prompt;
    return `${req.prompt}\n\nDo NOT include: ${req.negativePrompt}`;
  }
}

/* helpers */

function inputImageUrlsFor(req: GenerationRequest): string[] {
  const urls: string[] = [];
  for (const candidate of [req.sourceImage, req.maskImage, req.logoImage]) {
    if (candidate) urls.push(candidate);
  }
  for (const ref of req.refImages ?? []) {
    if (ref) urls.push(ref);
  }
  return urls;
}

function extractImagesFromMessage(
  message: ChatMessage | undefined,
): Array<{ base64: string; mimeType: string }> {
  if (!message) return [];
  const out: Array<{ base64: string; mimeType: string }> = [];

  for (const img of message.images ?? []) {
    const url = img.image_url?.url;
    const parsed = parseDataUrl(url);
    if (parsed) out.push(parsed);
  }

  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part.type === "image_url" && part.image_url?.url) {
        const parsed = parseDataUrl(part.image_url.url);
        if (parsed) out.push(parsed);
      }
    }
  }

  return out;
}

function parseDataUrl(
  url: string | undefined,
): { base64: string; mimeType: string } | null {
  if (!url) return null;
  if (!url.startsWith("data:")) return null;
  const match = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1] ?? "image/png", base64: match[2] ?? "" };
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

export const _internal = { extractImagesFromMessage, parseDataUrl, clampCount, statusToCode };

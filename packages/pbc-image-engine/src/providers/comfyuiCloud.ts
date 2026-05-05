/**
 * comfyui-cloud provider — talks to ViewComfy / AX Studio Cloud over HTTPS.
 *
 * Unlike `comfyui-local`, the cloud variants assume the workflow graph is
 * **pre-deployed** server-side; the client only overrides node-input
 * parameters per request. This matches ViewComfy's deployment model and
 * AX Studio Cloud's hosted graphs.
 *
 * Lifecycle of a single generate() call:
 *   1. POST  {baseUrl}/runs            { deployment_id, params } → run record
 *   2. (if async) poll {baseUrl}/runs/{run_id} until status finalizes
 *   3. For each output:
 *        - inline base64 → use as-is
 *        - URL          → GET the bytes, convert to base64
 *
 * Params shape — defaults to the common Z-Image / SDXL bucket so a stock
 * deployment produces sensible images without extra config:
 *   positive_prompt / negative_prompt / width / height / seed / steps /
 *   cfg / batch_size.
 *
 * Spec: docs/specs/meta-platform/pbc-image-engine.md §3.1, §5 ("ComfyUI
 * provider 어댑터가 AX Studio 워크플로우 1개 이상에서 정상 작동").
 */

import {
  ImageGenerationError,
  type ErrorCode,
  type GeneratedImage,
  type GenerationMode,
  type GenerationRequest,
  type GenerationResult,
  type ImageProvider,
} from "../types.js";
import type { FetchLike, ImageProviderAdapter, ProviderRuntimeOptions } from "./types.js";
import { Z_IMAGE_WORKFLOW, defaultWorkflowIdForMode } from "./comfyui/workflows.js";

const DEFAULT_BASE_URL = "https://api.viewcomfy.com/api/v1";
const DEFAULT_POLL_INTERVAL_MS = 1500;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * SDXL-class buckets (~1MP). Same numbers as the local Z-Image workflow so a
 * cloud-side stock deployment behaves identically to the local one when only
 * `aspectRatio` differs between requests.
 */
const ASPECT_TO_WH: Record<string, [number, number]> = {
  "1:1": [1024, 1024],
  "3:4": [896, 1152],
  "4:3": [1152, 896],
  "9:16": [768, 1344],
  "16:9": [1344, 768],
  "2:3": [832, 1216],
  "3:2": [1216, 832],
};

export interface ComfyUICloudOptions extends ProviderRuntimeOptions {
  baseUrl?: string;
  apiKey?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /**
   * Map a request to a deployment id (ViewComfy) / workflow alias (AX Studio
   * Cloud). Defaults to `request.model` → `metadata.deploymentId` →
   * default workflow for the request mode.
   */
  resolveDeployment?: (req: GenerationRequest) => string | undefined;
  /**
   * Override the params payload. Use this when a custom deployment exposes
   * differently-named inputs (e.g. ControlNet graphs).
   */
  buildParams?: (req: GenerationRequest) => Record<string, unknown>;
}

interface CloudOutput {
  type?: string;
  url?: string;
  base64?: string;
  data?: string;
  mimeType?: string;
  mime_type?: string;
}

interface CloudRunResponse {
  run_id?: string;
  status?: string;
  outputs?: CloudOutput[];
  error?: { message?: string; code?: string };
}

const TERMINAL_SUCCESS = new Set(["succeeded", "success", "completed", "complete"]);
const TERMINAL_FAILURE = new Set(["failed", "error", "cancelled", "canceled"]);

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class ComfyUICloudProvider implements ImageProviderAdapter {
  readonly id: ImageProvider = "comfyui-cloud";
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;
  private readonly signal?: AbortSignal;
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly resolveDeployment: (req: GenerationRequest) => string | undefined;
  private readonly buildParams: (req: GenerationRequest) => Record<string, unknown>;

  constructor(opts: ComfyUICloudOptions = {}) {
    this.baseUrl = (
      opts.baseUrl ??
      process.env.COMFYUI_CLOUD_URL ??
      process.env.VIEWCOMFY_API_URL ??
      DEFAULT_BASE_URL
    ).replace(/\/+$/, "");
    this.apiKey =
      opts.apiKey ??
      process.env.VIEWCOMFY_API_KEY ??
      process.env.COMFYUI_CLOUD_API_KEY ??
      "";
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.signal = opts.signal;
    this.pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.sleep = opts.sleep ?? defaultSleep;
    this.now = opts.now ?? Date.now;
    this.resolveDeployment = opts.resolveDeployment ?? defaultResolveDeployment;
    this.buildParams = opts.buildParams ?? defaultBuildParams;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey) && typeof this.fetchImpl === "function";
  }

  defaultModel(mode: GenerationMode): string {
    return defaultWorkflowIdForMode(mode) ?? Z_IMAGE_WORKFLOW.id;
  }

  async generate(req: GenerationRequest): Promise<GenerationResult> {
    if (!req.prompt || req.prompt.trim().length === 0) {
      throw new ImageGenerationError("prompt is required", "INVALID_INPUT", false);
    }
    if (!this.isAvailable()) {
      throw new ImageGenerationError(
        "comfyui-cloud is not configured (VIEWCOMFY_API_KEY required)",
        "PROVIDER_UNAVAILABLE",
        false,
      );
    }

    const deploymentId = this.resolveDeployment(req);
    if (!deploymentId) {
      throw new ImageGenerationError(
        `comfyui-cloud: no deployment id resolved for mode '${req.mode}'`,
        "INVALID_INPUT",
        false,
      );
    }

    const params = this.buildParams(req);
    const startedAt = this.now();
    const submitted = await this.submit(deploymentId, params);

    const finalRun = isTerminal(submitted)
      ? submitted
      : await this.waitForCompletion(submitted.run_id ?? "", startedAt);

    if (finalRun.status && TERMINAL_FAILURE.has(finalRun.status)) {
      throw new ImageGenerationError(
        `comfyui-cloud run ${finalRun.run_id ?? "?"} failed: ${
          finalRun.error?.message ?? finalRun.status
        }`,
        cloudErrorToCode(finalRun.error?.code),
        false,
      );
    }

    const images = await this.collectImages(finalRun.outputs ?? []);
    if (images.length === 0) {
      throw new ImageGenerationError(
        "comfyui-cloud run finished without images",
        "UNKNOWN",
        true,
      );
    }

    return {
      images,
      provider: this.id,
      model: deploymentId,
      duration: this.now() - startedAt,
      metadata: {
        runId: finalRun.run_id,
        deploymentId,
        status: finalRun.status,
      },
    };
  }

  private async submit(
    deploymentId: string,
    params: Record<string, unknown>,
  ): Promise<CloudRunResponse> {
    const url = `${this.baseUrl}/runs`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ deployment_id: deploymentId, params }),
        signal: this.signal,
      });
    } catch (err) {
      throw new ImageGenerationError(
        `comfyui-cloud network error on /runs: ${(err as Error).message}`,
        "PROVIDER_UNAVAILABLE",
        true,
      );
    }
    if (!res.ok) {
      const text = await safeReadText(res);
      throw new ImageGenerationError(
        `comfyui-cloud /runs HTTP ${res.status}: ${text.slice(0, 200)}`,
        statusToCode(res.status),
        res.status >= 500 || res.status === 429,
      );
    }
    return (await res.json()) as CloudRunResponse;
  }

  private async waitForCompletion(
    runId: string,
    startedAt: number,
  ): Promise<CloudRunResponse> {
    if (!runId) {
      throw new ImageGenerationError(
        "comfyui-cloud /runs returned no run_id and no terminal status",
        "UNKNOWN",
        true,
      );
    }
    const url = `${this.baseUrl}/runs/${encodeURIComponent(runId)}`;

    while (true) {
      if (this.now() - startedAt > this.timeoutMs) {
        throw new ImageGenerationError(
          `comfyui-cloud: run ${runId} did not finish within ${this.timeoutMs}ms`,
          "TIMEOUT",
          true,
        );
      }

      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          method: "GET",
          headers: this.headers(),
          signal: this.signal,
        });
      } catch (err) {
        throw new ImageGenerationError(
          `comfyui-cloud network error on /runs/{id}: ${(err as Error).message}`,
          "PROVIDER_UNAVAILABLE",
          true,
        );
      }

      if (!res.ok) {
        const text = await safeReadText(res);
        throw new ImageGenerationError(
          `comfyui-cloud /runs/{id} HTTP ${res.status}: ${text.slice(0, 200)}`,
          statusToCode(res.status),
          res.status >= 500,
        );
      }

      const run = (await res.json()) as CloudRunResponse;
      if (isTerminal(run)) return run;

      await this.sleep(this.pollIntervalMs);
    }
  }

  private async collectImages(outputs: CloudOutput[]): Promise<GeneratedImage[]> {
    const result: GeneratedImage[] = [];
    for (const out of outputs) {
      if (out.type && out.type !== "image" && out.type !== "image_url") continue;

      if (out.base64) {
        result.push({
          base64: out.base64,
          mimeType: out.mimeType ?? out.mime_type ?? "image/png",
        });
        continue;
      }
      const dataUrl = parseDataUrl(out.data);
      if (dataUrl) {
        result.push({
          base64: dataUrl.base64,
          mimeType: out.mimeType ?? out.mime_type ?? dataUrl.mimeType,
        });
        continue;
      }

      if (out.url) {
        const fetched = await this.fetchUrlAsBase64(out.url);
        result.push({
          ...fetched,
          mimeType: out.mimeType ?? out.mime_type ?? fetched.mimeType,
        });
      }
    }
    return result;
  }

  private async fetchUrlAsBase64(url: string): Promise<GeneratedImage> {
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "GET",
        signal: this.signal,
      });
    } catch (err) {
      throw new ImageGenerationError(
        `comfyui-cloud failed to fetch output url: ${(err as Error).message}`,
        "PROVIDER_UNAVAILABLE",
        true,
      );
    }
    if (!res.ok) {
      const text = await safeReadText(res);
      throw new ImageGenerationError(
        `comfyui-cloud output url HTTP ${res.status}: ${text.slice(0, 200)}`,
        statusToCode(res.status),
        res.status >= 500,
      );
    }
    const mimeType = (res.headers.get("content-type") ?? "image/png").split(";")[0]?.trim() ?? "image/png";
    const buffer = await res.arrayBuffer();
    return {
      base64: bufferToBase64(buffer),
      mimeType,
    };
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }
}

/* --------------------------- helpers + defaults ---------------------------- */

function defaultResolveDeployment(req: GenerationRequest): string | undefined {
  if (req.model) return req.model;
  const meta = req.metadata as Record<string, unknown> | undefined;
  if (meta && typeof meta.deploymentId === "string" && meta.deploymentId.length > 0) {
    return meta.deploymentId;
  }
  return defaultWorkflowIdForMode(req.mode);
}

function defaultBuildParams(req: GenerationRequest): Record<string, unknown> {
  const [width, height] = ASPECT_TO_WH[req.aspectRatio ?? "1:1"] ??
    ASPECT_TO_WH["1:1"];
  const meta = (req.metadata ?? {}) as Record<string, unknown>;

  const out: Record<string, unknown> = {
    positive_prompt: req.prompt,
    negative_prompt: req.negativePrompt ?? "",
    width,
    height,
    batch_size: clampCount(req.count),
  };

  if (typeof meta.seed === "number" && Number.isFinite(meta.seed)) {
    out.seed = Math.floor(meta.seed) >>> 0;
  }
  if (typeof meta.steps === "number" && meta.steps >= 1 && meta.steps <= 100) {
    out.steps = Math.floor(meta.steps);
  }
  if (typeof meta.cfg === "number" && meta.cfg > 0 && meta.cfg <= 30) {
    out.cfg = meta.cfg;
  }
  if (typeof meta.checkpoint === "string" && meta.checkpoint.length > 0) {
    out.checkpoint = meta.checkpoint;
  }

  if (req.sourceImage) out.source_image = req.sourceImage;
  if (req.maskImage) out.mask_image = req.maskImage;
  if (req.logoImage) out.logo_image = req.logoImage;
  if (req.style) out.style = req.style;

  return out;
}

function isTerminal(run: CloudRunResponse): boolean {
  if (!run.status) {
    // No status field but outputs are present → assume sync success.
    return Array.isArray(run.outputs) && run.outputs.length > 0;
  }
  return TERMINAL_SUCCESS.has(run.status) || TERMINAL_FAILURE.has(run.status);
}

function clampCount(n: number | undefined): number {
  if (!n || !Number.isFinite(n)) return 1;
  return Math.min(8, Math.max(1, Math.floor(n)));
}

function parseDataUrl(
  data: string | undefined,
): { base64: string; mimeType: string } | undefined {
  if (!data) return undefined;
  const m = data.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return undefined;
  return { mimeType: m[1] ?? "image/png", base64: m[2] ?? "" };
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  if (typeof btoa === "function") return btoa(binary);
  throw new Error("No base64 encoder available");
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
  if (status === 408 || status === 504) return "TIMEOUT";
  if (status === 429) return "QUOTA_EXCEEDED";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  return "UNKNOWN";
}

function cloudErrorToCode(code: string | undefined): ErrorCode {
  if (!code) return "UNKNOWN";
  const lower = code.toLowerCase();
  if (lower.includes("quota") || lower.includes("rate")) return "QUOTA_EXCEEDED";
  if (lower.includes("filter") || lower.includes("nsfw") || lower.includes("safety")) {
    return "CONTENT_FILTERED";
  }
  if (lower.includes("timeout")) return "TIMEOUT";
  if (lower.includes("invalid") || lower.includes("validation")) return "INVALID_INPUT";
  if (lower.includes("unauthorized") || lower.includes("forbidden")) {
    return "PROVIDER_UNAVAILABLE";
  }
  return "UNKNOWN";
}

export const _internal = {
  defaultBuildParams,
  defaultResolveDeployment,
  isTerminal,
  clampCount,
  parseDataUrl,
  bufferToBase64,
  statusToCode,
  cloudErrorToCode,
  ASPECT_TO_WH,
};

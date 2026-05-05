/**
 * comfyui-local provider — talks to a ComfyUI server over its HTTP API.
 *
 * Lifecycle of a single generate() call:
 *   1. POST  /prompt           submit graph         → { prompt_id }
 *   2. poll  GET /history/{id} until status_str === "success" (or timeout)
 *   3. GET   /view?filename=…   pull each output image as bytes → base64
 *
 * The API is the same one ComfyUI exposes to its web UI; AX Studio
 * desktop app reuses this surface, which is why this adapter is the
 * AX Studio bridge.
 *
 * Spec: docs/specs/meta-platform/pbc-image-engine.md §3.1, §5 acceptance.
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
import {
  Z_IMAGE_WORKFLOW,
  defaultWorkflowIdForMode,
  getWorkflow,
} from "./comfyui/workflows.js";
import type {
  ComfyUIHistoryEntry,
  ComfyUIHistoryResponse,
  ComfyUIPromptResponse,
  ComfyUIWorkflowBuilder,
} from "./comfyui/types.js";

const DEFAULT_BASE_URL = "http://127.0.0.1:8188";
const DEFAULT_POLL_INTERVAL_MS = 750;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 min

export interface ComfyUILocalOptions extends ProviderRuntimeOptions {
  baseUrl?: string;
  /** Stable client id sent with every /prompt submission. */
  clientId?: string;
  /** Override poll cadence for the /history endpoint. */
  pollIntervalMs?: number;
  /** Hard ceiling for a single generate() call. */
  timeoutMs?: number;
  /**
   * Sleep injection — tests pass a no-op so polling is instant.
   * Defaults to setTimeout-based delay.
   */
  sleep?: (ms: number) => Promise<void>;
  /**
   * Monotonic clock injection — tests pass a controllable counter so
   * timeout assertions don't rely on wall time.
   */
  now?: () => number;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class ComfyUILocalProvider implements ImageProviderAdapter {
  readonly id: ImageProvider = "comfyui-local";
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;
  private readonly signal?: AbortSignal;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  constructor(opts: ComfyUILocalOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? process.env.COMFYUI_LOCAL_URL ?? DEFAULT_BASE_URL).replace(
      /\/+$/,
      "",
    );
    this.clientId =
      opts.clientId ?? process.env.COMFYUI_CLIENT_ID ?? "axle-pbc-image-engine";
    this.pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.signal = opts.signal;
    this.sleep = opts.sleep ?? defaultSleep;
    this.now = opts.now ?? Date.now;
  }

  isAvailable(): boolean {
    return Boolean(this.baseUrl) && typeof this.fetchImpl === "function";
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
        "comfyui-local has no fetch implementation",
        "PROVIDER_UNAVAILABLE",
        false,
      );
    }

    const builder = this.resolveBuilder(req);
    if (!builder) {
      throw new ImageGenerationError(
        `comfyui-local: no workflow registered for mode '${req.mode}' / model '${req.model ?? "(default)"}'`,
        "INVALID_INPUT",
        false,
      );
    }
    if (!builder.modes.includes(req.mode)) {
      throw new ImageGenerationError(
        `comfyui-local: workflow '${builder.id}' does not support mode '${req.mode}'`,
        "INVALID_INPUT",
        false,
      );
    }

    const workflow = builder.build(req);
    const startedAt = this.now();

    const promptId = await this.submit(workflow.prompt);
    const history = await this.waitForCompletion(promptId, startedAt);
    const images = await this.collectImages(history, workflow.outputNodeIds);

    if (images.length === 0) {
      throw new ImageGenerationError(
        "comfyui-local: workflow finished without images",
        "UNKNOWN",
        true,
      );
    }

    return {
      images,
      provider: this.id,
      model: builder.id,
      duration: this.now() - startedAt,
      metadata: {
        promptId,
        workflowId: builder.id,
        outputNodeIds: workflow.outputNodeIds,
      },
    };
  }

  private resolveBuilder(req: GenerationRequest): ComfyUIWorkflowBuilder | undefined {
    const explicitId =
      req.model ??
      ((req.metadata?.workflow as string | undefined) ?? undefined) ??
      defaultWorkflowIdForMode(req.mode);
    if (!explicitId) return undefined;
    return getWorkflow(explicitId);
  }

  private async submit(prompt: Record<string, unknown>): Promise<string> {
    const url = `${this.baseUrl}/prompt`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, client_id: this.clientId }),
        signal: this.signal,
      });
    } catch (err) {
      throw new ImageGenerationError(
        `comfyui-local network error on /prompt: ${(err as Error).message}`,
        "PROVIDER_UNAVAILABLE",
        true,
      );
    }
    if (!res.ok) {
      const text = await safeReadText(res);
      throw new ImageGenerationError(
        `comfyui-local /prompt HTTP ${res.status}: ${text.slice(0, 200)}`,
        statusToCode(res.status),
        res.status >= 500,
      );
    }
    const data = (await res.json()) as ComfyUIPromptResponse;
    if (data.node_errors && Object.keys(data.node_errors).length > 0) {
      throw new ImageGenerationError(
        `comfyui-local node errors: ${JSON.stringify(data.node_errors).slice(0, 200)}`,
        "INVALID_INPUT",
        false,
      );
    }
    if (!data.prompt_id) {
      throw new ImageGenerationError(
        "comfyui-local /prompt returned no prompt_id",
        "UNKNOWN",
        true,
      );
    }
    return data.prompt_id;
  }

  private async waitForCompletion(
    promptId: string,
    startedAt: number,
  ): Promise<ComfyUIHistoryEntry> {
    const url = `${this.baseUrl}/history/${encodeURIComponent(promptId)}`;
    while (true) {
      if (this.now() - startedAt > this.timeoutMs) {
        throw new ImageGenerationError(
          `comfyui-local: prompt ${promptId} did not finish within ${this.timeoutMs}ms`,
          "TIMEOUT",
          true,
        );
      }

      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          method: "GET",
          signal: this.signal,
        });
      } catch (err) {
        throw new ImageGenerationError(
          `comfyui-local network error on /history: ${(err as Error).message}`,
          "PROVIDER_UNAVAILABLE",
          true,
        );
      }
      if (!res.ok) {
        const text = await safeReadText(res);
        throw new ImageGenerationError(
          `comfyui-local /history HTTP ${res.status}: ${text.slice(0, 200)}`,
          statusToCode(res.status),
          res.status >= 500,
        );
      }

      const data = (await res.json()) as ComfyUIHistoryResponse;
      const entry = data[promptId];

      if (entry) {
        const statusStr = entry.status?.status_str;
        if (statusStr === "success" || entry.status?.completed === true) {
          return entry;
        }
        if (statusStr === "error") {
          const detail =
            entry.status?.messages?.find((m) => m[0] === "execution_error")?.[1] ??
            entry.status?.messages ??
            {};
          throw new ImageGenerationError(
            `comfyui-local: workflow execution_error: ${JSON.stringify(detail).slice(0, 200)}`,
            "UNKNOWN",
            true,
          );
        }
      }

      await this.sleep(this.pollIntervalMs);
    }
  }

  private async collectImages(
    history: ComfyUIHistoryEntry,
    outputNodeIds: string[],
  ): Promise<GeneratedImage[]> {
    const collected: GeneratedImage[] = [];
    const outputs = history.outputs ?? {};
    for (const nodeId of outputNodeIds) {
      const node = outputs[nodeId];
      for (const img of node?.images ?? []) {
        collected.push(await this.fetchImage(img.filename, img.subfolder, img.type));
      }
    }
    return collected;
  }

  private async fetchImage(
    filename: string,
    subfolder: string | undefined,
    type: string | undefined,
  ): Promise<GeneratedImage> {
    const params = new URLSearchParams({
      filename,
      subfolder: subfolder ?? "",
      type: type ?? "output",
    });
    const url = `${this.baseUrl}/view?${params.toString()}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, { method: "GET", signal: this.signal });
    } catch (err) {
      throw new ImageGenerationError(
        `comfyui-local network error on /view: ${(err as Error).message}`,
        "PROVIDER_UNAVAILABLE",
        true,
      );
    }
    if (!res.ok) {
      const text = await safeReadText(res);
      throw new ImageGenerationError(
        `comfyui-local /view HTTP ${res.status}: ${text.slice(0, 200)}`,
        statusToCode(res.status),
        res.status >= 500,
      );
    }
    const mimeType = res.headers.get("content-type") ?? "image/png";
    const buffer = await res.arrayBuffer();
    return {
      base64: bufferToBase64(buffer),
      mimeType: mimeType.split(";")[0]?.trim() ?? "image/png",
    };
  }
}

/* helpers */

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

export const _internal = { bufferToBase64, statusToCode };

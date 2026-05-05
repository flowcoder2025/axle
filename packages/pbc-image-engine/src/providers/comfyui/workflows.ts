/**
 * ComfyUI workflow builders.
 *
 * WI-404 ships the Z-Image workflow ("z-image-default"). FLUX.2 and
 * additional AX Studio graphs land in WI-405 / later.
 *
 * The workflow id is what callers pass via `request.model` (or
 * `request.metadata.workflow`) to pick a specific graph. Defaults are
 * resolved per generation mode.
 */

import type { GenerationMode, GenerationRequest } from "../../types.js";
import type {
  ComfyUIPrompt,
  ComfyUIWorkflow,
  ComfyUIWorkflowBuilder,
} from "./types.js";

const Z_IMAGE_DEFAULT_CHECKPOINT = "z-image_v1.safetensors";
const Z_IMAGE_BASE_DIM = 1024;
const Z_IMAGE_DEFAULT_STEPS = 20;
const Z_IMAGE_DEFAULT_CFG = 7.0;
const Z_IMAGE_DEFAULT_SAMPLER = "euler";
const Z_IMAGE_DEFAULT_SCHEDULER = "normal";
const Z_IMAGE_FILENAME_PREFIX = "axle/z-image";

/**
 * Aspect-ratio → (width, height) at Z-Image's native scale.
 * Numbers are SDXL-style buckets that keep the megapixel count near 1MP, which
 * is what Z-Image / SDXL-class checkpoints train on.
 */
const Z_IMAGE_DIMENSIONS: Record<string, [number, number]> = {
  "1:1": [Z_IMAGE_BASE_DIM, Z_IMAGE_BASE_DIM],
  "3:4": [896, 1152],
  "4:3": [1152, 896],
  "9:16": [768, 1344],
  "16:9": [1344, 768],
  "2:3": [832, 1216],
  "3:2": [1216, 832],
};

/**
 * Deterministic seed extraction. Tests can pin via
 * `request.metadata.seed`; otherwise we hash the prompt + mode so the same
 * request reproduces the same image (helpful for snapshot regressions).
 */
function resolveSeed(req: GenerationRequest): number {
  const meta = req.metadata as Record<string, unknown> | undefined;
  if (meta && typeof meta.seed === "number" && Number.isFinite(meta.seed)) {
    return Math.floor(meta.seed) >>> 0;
  }
  const text = `${req.mode}|${req.prompt}`;
  let h = 2166136261; // FNV-1a 32-bit basis
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function dimensionsFor(req: GenerationRequest): [number, number] {
  const ratio = req.aspectRatio ?? "1:1";
  return Z_IMAGE_DIMENSIONS[ratio] ?? Z_IMAGE_DIMENSIONS["1:1"];
}

function stepsFor(req: GenerationRequest): number {
  const meta = req.metadata as Record<string, unknown> | undefined;
  if (meta && typeof meta.steps === "number" && meta.steps >= 1 && meta.steps <= 100) {
    return Math.floor(meta.steps);
  }
  return Z_IMAGE_DEFAULT_STEPS;
}

function cfgFor(req: GenerationRequest): number {
  const meta = req.metadata as Record<string, unknown> | undefined;
  if (meta && typeof meta.cfg === "number" && meta.cfg > 0 && meta.cfg <= 30) {
    return meta.cfg;
  }
  return Z_IMAGE_DEFAULT_CFG;
}

function checkpointFor(req: GenerationRequest): string {
  const meta = req.metadata as Record<string, unknown> | undefined;
  if (meta && typeof meta.checkpoint === "string" && meta.checkpoint.length > 0) {
    return meta.checkpoint;
  }
  return Z_IMAGE_DEFAULT_CHECKPOINT;
}

function batchSize(req: GenerationRequest): number {
  if (!req.count || !Number.isFinite(req.count)) return 1;
  return Math.min(8, Math.max(1, Math.floor(req.count)));
}

/**
 * Build the Z-Image text-to-image graph. Standard SDXL-class topology:
 *   CheckpointLoader → CLIPTextEncode×2 → EmptyLatentImage → KSampler →
 *   VAEDecode → SaveImage.
 */
function buildZImagePrompt(req: GenerationRequest): ComfyUIPrompt {
  const [width, height] = dimensionsFor(req);
  const seed = resolveSeed(req);
  const steps = stepsFor(req);
  const cfg = cfgFor(req);
  const checkpoint = checkpointFor(req);
  const batch = batchSize(req);
  const negative = req.negativePrompt ?? "";

  return {
    "1": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: checkpoint },
      _meta: { title: "Load Z-Image" },
    },
    "2": {
      class_type: "CLIPTextEncode",
      inputs: { text: req.prompt, clip: ["1", 1] },
      _meta: { title: "Positive prompt" },
    },
    "3": {
      class_type: "CLIPTextEncode",
      inputs: { text: negative, clip: ["1", 1] },
      _meta: { title: "Negative prompt" },
    },
    "4": {
      class_type: "EmptyLatentImage",
      inputs: { width, height, batch_size: batch },
      _meta: { title: "Empty latent" },
    },
    "5": {
      class_type: "KSampler",
      inputs: {
        seed,
        steps,
        cfg,
        sampler_name: Z_IMAGE_DEFAULT_SAMPLER,
        scheduler: Z_IMAGE_DEFAULT_SCHEDULER,
        denoise: 1.0,
        model: ["1", 0],
        positive: ["2", 0],
        negative: ["3", 0],
        latent_image: ["4", 0],
      },
      _meta: { title: "KSampler" },
    },
    "6": {
      class_type: "VAEDecode",
      inputs: { samples: ["5", 0], vae: ["1", 2] },
      _meta: { title: "VAE Decode" },
    },
    "7": {
      class_type: "SaveImage",
      inputs: { images: ["6", 0], filename_prefix: Z_IMAGE_FILENAME_PREFIX },
      _meta: { title: "Save" },
    },
  };
}

export const Z_IMAGE_WORKFLOW: ComfyUIWorkflowBuilder = {
  id: "z-image-default",
  modes: ["CREATE", "POSTER", "DETAIL_PAGE", "COMPOSITE"] as const,
  build(req: GenerationRequest): ComfyUIWorkflow {
    return {
      prompt: buildZImagePrompt(req),
      outputNodeIds: ["7"],
    };
  },
};

const REGISTRY = new Map<string, ComfyUIWorkflowBuilder>([
  [Z_IMAGE_WORKFLOW.id, Z_IMAGE_WORKFLOW],
]);

/**
 * Default workflow per mode. CREATE-style modes use Z-Image; EDIT/RETOUCH
 * are not yet supported by the local adapter (those need ControlNet /
 * IPAdapter graphs that arrive in WI-405+).
 */
const DEFAULT_BY_MODE: Partial<Record<GenerationMode, string>> = {
  CREATE: Z_IMAGE_WORKFLOW.id,
  POSTER: Z_IMAGE_WORKFLOW.id,
  DETAIL_PAGE: Z_IMAGE_WORKFLOW.id,
  COMPOSITE: Z_IMAGE_WORKFLOW.id,
};

export function defaultWorkflowIdForMode(mode: GenerationMode): string | undefined {
  return DEFAULT_BY_MODE[mode];
}

export function getWorkflow(id: string): ComfyUIWorkflowBuilder | undefined {
  return REGISTRY.get(id);
}

export function registerWorkflow(builder: ComfyUIWorkflowBuilder): void {
  REGISTRY.set(builder.id, builder);
}

export function listWorkflowIds(): string[] {
  return Array.from(REGISTRY.keys());
}

export const _internal = {
  Z_IMAGE_DIMENSIONS,
  resolveSeed,
  dimensionsFor,
  stepsFor,
  cfgFor,
  checkpointFor,
  batchSize,
};

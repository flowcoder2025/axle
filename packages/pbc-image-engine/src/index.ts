/**
 * @axle/pbc-image-engine — public entry.
 *
 * WI-401 shipped the type contract. WI-402 added the three Direct API
 * adapters (google-genai / vertex-ai / openrouter) ported from FlowStudio
 * v2's `imageProvider/`. WI-611 shipped the orchestrator (`generate`,
 * `selectProvider`, `getEstimatedCost`). ComfyUI adapters live in
 * `providers/comfyui*`.
 */

export {
  ASPECT_RATIOS,
  ERROR_CODES,
  GENERATION_MODES,
  ImageGenerationError,
  IMAGE_PROVIDERS,
  REFERENCE_MODES,
} from "./types.js";

export type {
  AspectRatio,
  ErrorCode,
  GeneratedImage,
  GenerationCost,
  GenerationMode,
  GenerationRequest,
  GenerationResult,
  ImageEngine,
  ImageProvider,
  ReferenceMode,
} from "./types.js";

export {
  ComfyUICloudProvider,
  ComfyUILocalProvider,
  GoogleGenAIProvider,
  OpenRouterImageProvider,
  VertexAIProvider,
  Z_IMAGE_WORKFLOW,
  defaultWorkflowIdForMode,
  getWorkflow,
  listWorkflowIds,
  registerWorkflow,
} from "./providers/index.js";
export type {
  ComfyUICloudOptions,
  ComfyUIHistoryEntry,
  ComfyUIHistoryResponse,
  ComfyUILocalOptions,
  ComfyUINode,
  ComfyUINodeRef,
  ComfyUIPrompt,
  ComfyUIPromptResponse,
  ComfyUIWorkflow,
  ComfyUIWorkflowBuilder,
  DirectApiProvider,
  FetchLike,
  GoogleGenAIOptions,
  ImageProviderAdapter,
  OpenRouterOptions,
  ProviderRuntimeOptions,
  VertexAIOptions,
} from "./providers/index.js";

export { getDefaultPreferences, selectProvider } from "./selectProvider.js";
export type { SelectProviderOptions } from "./selectProvider.js";

export { generate } from "./generate.js";
export type { GenerateOptions } from "./generate.js";

export { getEstimatedCost } from "./cost.js";

export { buildPrompt } from "./promptBuilder.js";

export {
  FREE_MODE_SYSTEM_PROMPT,
  PRESETS,
  PRO_MODE_SYSTEM_PROMPT,
  RETOUCH_FREE,
  RETOUCH_PRO,
  applyPreset,
  getPreset,
  listPresetIds,
  registerPreset,
} from "./presets/index.js";
export type { Preset } from "./presets/index.js";

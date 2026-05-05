/**
 * @axle/pbc-image-engine — public entry.
 *
 * WI-401 shipped the type contract. WI-402 adds the three Direct API
 * adapters (google-genai / vertex-ai / openrouter) ported from FlowStudio
 * v2's `imageProvider/`. The orchestrator (`generate`, `selectProvider`,
 * `getEstimatedCost`) lands in WI-403; ComfyUI adapters in WI-404/405.
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

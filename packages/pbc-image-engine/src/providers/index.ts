/**
 * Provider barrel — Direct API adapters ported from FlowStudio v2.
 *
 * ComfyUI Local / Cloud adapters arrive in WI-404 / WI-405 and will be
 * re-exported here.
 */

export type {
  ImageProviderAdapter,
  DirectApiProvider,
  FetchLike,
  ProviderRuntimeOptions,
} from "./types.js";

export { GoogleGenAIProvider } from "./googleGenAI.js";
export type { GoogleGenAIOptions } from "./googleGenAI.js";

export { VertexAIProvider } from "./vertexai.js";
export type { VertexAIOptions } from "./vertexai.js";

export { OpenRouterImageProvider } from "./openRouter.js";
export type { OpenRouterOptions } from "./openRouter.js";

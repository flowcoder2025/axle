/**
 * `@axle/pbc-image-engine/compat/flowstudio-v1`
 *
 * Drop-in replacement surface for FlowStudio v1's `lib/imageProvider/`.
 * v1 callsites migrate by changing a single import; behaviour is preserved
 * (default model, env-based provider switch, IMAGE_PROVIDER env var).
 *
 * Migration playbook: `docs/specs/meta-platform/migrations/flowstudio-v1-to-pbc.md`.
 */

export {
  V1_DEFAULT_MODEL,
  generateImage,
} from "./generateImage.js";
export type {
  V1CompatRuntimeOptions,
} from "./generateImage.js";
export type {
  V1GeneratedImage,
  V1GenerateImageOptions,
  V1GenerateImageResult,
  V1ProviderEnv,
} from "./types.js";

// Convenience re-export so migrating code can keep accessing the canonical
// error class from the same import root.
export { ImageGenerationError } from "../../types.js";

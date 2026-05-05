/**
 * `@axle/pbc-image-engine/compat/flowstudio-re`
 *
 * Drop-in replacement surface for FlowStudio_re's `lib/imageProvider/`.
 * FlowStudio_re는 v1 fork로 추정되어 본 모듈은 v1 compat에 위임합니다.
 *
 * 마이그레이션 플레이북:
 *   docs/specs/meta-platform/migrations/flowstudio-re-to-pbc.md
 */

export {
  RE_DEFAULT_MODEL,
  generateImage,
  type ReCompatRuntimeOptions,
} from "./generateImage.js";
export type {
  ReGeneratedImage,
  ReGenerateImageOptions,
  ReGenerateImageResult,
  ReProviderEnv,
} from "./types.js";

// Convenience re-export so migrating code can keep accessing the canonical
// error class from the same import root.
export { ImageGenerationError } from "../../types.js";

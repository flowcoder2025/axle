/**
 * `@axle/pbc-block-builder` — public entry.
 *
 * WI-501 ships the type contract only. Concrete blocks arrive in WI-502;
 * renderers in WI-503..WI-506; AI copy pipeline in WI-507; presets in
 * WI-508; FlowStudio v2 migration in WI-509.
 *
 * Consumers can already import the types to declare a dependency:
 *
 *   import type { BlockBuilderEngine, PageComposition } from "@axle/pbc-block-builder";
 *
 *   interface RenderJob {
 *     engine: BlockBuilderEngine;
 *     composition: PageComposition;
 *   }
 */

export {
  BLOCK_CATEGORIES,
  LOCALES,
  RENDER_OUTPUTS,
} from "./types.js";

export type {
  BlockBuilderEngine,
  BlockCategory,
  BlockDefinition,
  BlockId,
  BlockValidationResult,
  CopyGenerationRequest,
  CopyGenerationResult,
  DesignTokens,
  Locale,
  PageComposition,
  RenderAsset,
  RenderContext,
  RenderOutput,
  RenderResult,
} from "./types.js";

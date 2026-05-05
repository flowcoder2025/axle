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

// Block category metadata (WI-502).
export {
  BLOCK_CATEGORY_NAMES,
  getCategoryMeta,
} from "./categories.js";
export type { BlockCategoryMeta } from "./categories.js";

// HTML renderer + dispatcher (WI-503).
export { escapeHtml, renderBlockHtml, HTML_RENDERERS } from "./renderers/html.js";
export { renderBlock, renderComposition } from "./render.js";

// React renderer (WI-504).
export { renderBlockReact, REACT_RENDERERS } from "./renderers/react.js";

// 23-block registry (WI-502).
export {
  BLOCKS,
  getBlock,
  listBlockIds,
  listBlocksByCategory,
  A1_HERO_VISUAL,
  A2_ONELINE_HOOK,
  A3_PROBLEM_STATEMENT,
  B1_FEATURE_CARDS,
  B2_BEFORE_AFTER,
  B3_KEY_INGREDIENT,
  B4_USP_FULLSHOT,
  C1_CERTIFICATION,
  C2_REVIEWS,
  C3_MEDIA_COVERAGE,
  C4_BRAND_STORY,
  C5_NUMBERS,
  D1_SPEC_TABLE,
  D2_USAGE_GUIDE,
  D3_PACKAGE_CONTENTS,
  D4_SIZE_GUIDE,
  E1_CTA_BANNER,
  E2_PROMOTION,
  E3_FAQ,
  E4_SHIPPING,
  F1_LIFESTYLE,
  F2_COLOR_OPTIONS,
  F3_DIVIDER,
} from "./blocks/index.js";
export type { RegisteredBlockId } from "./blocks/index.js";

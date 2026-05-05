/**
 * `@axle/pbc-block-builder/compat/flowstudio-v2`
 *
 * Drop-in replacement surface for FlowStudio v2's `lib/detail-page/`
 * block-builder API. v2 callsites migrate by changing a single import
 * (`@/lib/detail-page/...` → `@axle/pbc-block-builder/compat/flowstudio-v2`).
 *
 * Re-exports the full v2 surface:
 *   - `BLOCKS` / `getBlock` / `listBlockIds` / `listBlocksByCategory`
 *   - `renderBlock` / `renderComposition` (with v2's flat `format` option)
 *   - `validateBlockData`
 *
 * Migration playbook:
 *   `docs/specs/meta-platform/migrations/flowstudio-v2-to-pbc.md`
 */

export { renderBlock, renderComposition } from "./renderBlock.js";

export {
  BLOCKS,
  getBlock,
  listBlockIds,
  listBlocksByCategory,
} from "../../blocks/index.js";

export { validateBlockData } from "../../ai/generateCopy.js";

export type {
  V2Composition,
  V2CompositionEntry,
  V2Format,
  V2RenderOptions,
} from "./types.js";

// Convenience re-exports — v2 callers often imported these alongside the
// renderer.
export type {
  BlockCategory,
  BlockDefinition,
  BlockId,
  BlockValidationResult,
  PageComposition,
  RenderResult,
} from "../../types.js";

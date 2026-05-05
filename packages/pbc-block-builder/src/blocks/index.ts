/**
 * 23-block registry — populated in WI-502 from FlowStudio v2's
 * `block-system-design.md`.
 *
 * The renderers (WI-503..WI-506) consume this registry directly; the AI
 * copy pipeline (WI-507) consumes it to discover schemas and category
 * priorities; the FlowStudio v2 migration (WI-509) re-points its existing
 * `lib/detail-page/blocks/` callsites at this module.
 */

import type { BlockCategory, BlockDefinition, BlockId } from "../types.js";

import { A1_HERO_VISUAL } from "./A1-hero-visual.js";
import { A2_ONELINE_HOOK } from "./A2-oneline-hook.js";
import { A3_PROBLEM_STATEMENT } from "./A3-problem-statement.js";
import { B1_FEATURE_CARDS } from "./B1-feature-cards.js";
import { B2_BEFORE_AFTER } from "./B2-before-after.js";
import { B3_KEY_INGREDIENT } from "./B3-key-ingredient.js";
import { B4_USP_FULLSHOT } from "./B4-usp-fullshot.js";
import { C1_CERTIFICATION } from "./C1-certification.js";
import { C2_REVIEWS } from "./C2-reviews.js";
import { C3_MEDIA_COVERAGE } from "./C3-media-coverage.js";
import { C4_BRAND_STORY } from "./C4-brand-story.js";
import { C5_NUMBERS } from "./C5-numbers.js";
import { D1_SPEC_TABLE } from "./D1-spec-table.js";
import { D2_USAGE_GUIDE } from "./D2-usage-guide.js";
import { D3_PACKAGE_CONTENTS } from "./D3-package-contents.js";
import { D4_SIZE_GUIDE } from "./D4-size-guide.js";
import { E1_CTA_BANNER } from "./E1-cta-banner.js";
import { E2_PROMOTION } from "./E2-promotion.js";
import { E3_FAQ } from "./E3-faq.js";
import { E4_SHIPPING } from "./E4-shipping.js";
import { F1_LIFESTYLE } from "./F1-lifestyle.js";
import { F2_COLOR_OPTIONS } from "./F2-color-options.js";
import { F3_DIVIDER } from "./F3-divider.js";

/**
 * Loose registry type — each block's `BlockDefinition<TData,TContent>` is
 * specific to its schema, but the registry needs to store them in a single
 * map. Using `unknown` for `TData` would trigger a contravariance error
 * (the placeholder render's specific data param is not assignable to
 * `(data: unknown) => …`). Per-block named exports above preserve the
 * narrow types for callers that import them directly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBlockDefinition = BlockDefinition<any, unknown>;

/**
 * Canonical 23-block registry. The map keys are the canonical `BlockId`s.
 */
export const BLOCKS: Record<string, AnyBlockDefinition> = {
  A1: A1_HERO_VISUAL,
  A2: A2_ONELINE_HOOK,
  A3: A3_PROBLEM_STATEMENT,
  B1: B1_FEATURE_CARDS,
  B2: B2_BEFORE_AFTER,
  B3: B3_KEY_INGREDIENT,
  B4: B4_USP_FULLSHOT,
  C1: C1_CERTIFICATION,
  C2: C2_REVIEWS,
  C3: C3_MEDIA_COVERAGE,
  C4: C4_BRAND_STORY,
  C5: C5_NUMBERS,
  D1: D1_SPEC_TABLE,
  D2: D2_USAGE_GUIDE,
  D3: D3_PACKAGE_CONTENTS,
  D4: D4_SIZE_GUIDE,
  E1: E1_CTA_BANNER,
  E2: E2_PROMOTION,
  E3: E3_FAQ,
  E4: E4_SHIPPING,
  F1: F1_LIFESTYLE,
  F2: F2_COLOR_OPTIONS,
  F3: F3_DIVIDER,
};

export type RegisteredBlockId =
  | "A1" | "A2" | "A3"
  | "B1" | "B2" | "B3" | "B4"
  | "C1" | "C2" | "C3" | "C4" | "C5"
  | "D1" | "D2" | "D3" | "D4"
  | "E1" | "E2" | "E3" | "E4"
  | "F1" | "F2" | "F3";

export function getBlock(id: BlockId): AnyBlockDefinition | undefined {
  return BLOCKS[id];
}

export function listBlockIds(): BlockId[] {
  return Object.keys(BLOCKS) as BlockId[];
}

export function listBlocksByCategory(category: BlockCategory): AnyBlockDefinition[] {
  return Object.values(BLOCKS).filter((b) => b.category === category);
}

// Per-block re-export keeps tree-shake-friendly named imports alive for
// callsites that only need a single block.
export {
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
};

/**
 * Block category metadata — names confirmed in WI-502 from the FlowStudio
 * v2 `block-system-design.md` mapping.
 *
 * The single-letter category short names (`A`..`F`) stay the canonical
 * identifier (`BLOCK_CATEGORIES` in types.ts). The names below are
 * presentational — used by builder UIs, the AI copy pipeline (WI-507) for
 * prompt construction, and documentation.
 *
 * Source: docs/specs/meta-platform/pbc-block-builder-visuals.md §1
 */

import type { BlockCategory } from "./types.js";

export interface BlockCategoryMeta {
  /** Short identifier (matches BlockCategory). */
  id: BlockCategory;
  /** Stable English name — used as the canonical UI label. */
  en: string;
  /** Korean name — preserved from FlowStudio v2 source spec. */
  ko: string;
  /**
   * One-line description of what blocks in this category do. Used by the
   * AI copy pipeline to anchor block-selection reasoning.
   */
  purpose: string;
  /**
   * Mood keywords from the visuals spec — useful when the AI pipeline or
   * a builder UI needs to hint the brand voice for blocks in this group.
   */
  moodKeywords: string[];
}

export const BLOCK_CATEGORY_NAMES: Record<BlockCategory, BlockCategoryMeta> = {
  A: {
    id: "A",
    en: "Opening",
    ko: "도입부",
    purpose: "Above-the-fold first impression — capture attention.",
    moodKeywords: ["impact", "curiosity", "intense", "first-impression"],
  },
  B: {
    id: "B",
    en: "Core Value",
    ko: "핵심 소구",
    purpose: "Surface the product's central differentiators.",
    moodKeywords: ["clarity", "comparison", "value", "objective"],
  },
  C: {
    id: "C",
    en: "Trust",
    ko: "신뢰 구축",
    purpose: "Establish credibility through proof, certification, and social signal.",
    moodKeywords: ["objective", "authority", "social-proof", "weight"],
  },
  D: {
    id: "D",
    en: "Detail",
    ko: "상세 정보",
    purpose: "Provide concrete specs, usage, and verifiable facts.",
    moodKeywords: ["accurate", "objective", "data", "verifiable"],
  },
  E: {
    id: "E",
    en: "Conversion",
    ko: "전환 유도",
    purpose: "Drive the purchase / signup action with a clear CTA path.",
    moodKeywords: ["action", "imminent", "clear", "simple"],
  },
  F: {
    id: "F",
    en: "Mood",
    ko: "감성 연출",
    purpose: "Lifestyle imagery, breathing room, and visual rhythm between sections.",
    moodKeywords: ["mood", "lifestyle", "rest", "whitespace"],
  },
};

/**
 * Returns the category metadata or throws — the BlockCategory union is
 * narrow enough that a runtime miss means the registry was tampered with.
 */
export function getCategoryMeta(category: BlockCategory): BlockCategoryMeta {
  const meta = BLOCK_CATEGORY_NAMES[category];
  if (!meta) {
    throw new Error(`Unknown block category: ${category as string}`);
  }
  return meta;
}

/**
 * Preset compositions barrel (WI-508).
 *
 * Four canonical starting compositions named in `pbc-block-builder.md`
 * §3.2. Apps drop a preset into `renderComposition()` to get a working
 * page in a single call, then customize per-block data over time.
 *
 * Every preset's block payloads validate against the per-block zod
 * schemas (enforced by `__tests__/presets.test.ts`).
 */

import type { PageComposition } from "../types.js";
import { LANDING_SAAS } from "./landing-saas.js";
import { DETAIL_ECOMMERCE } from "./detail-ecommerce.js";
import { SNS_CARD } from "./sns-card.js";
import { BUSINESS_DOC } from "./business-doc.js";

export const PRESET_NAMES = [
  "landing-saas",
  "detail-ecommerce",
  "sns-card",
  "business-doc",
] as const;
export type PresetName = (typeof PRESET_NAMES)[number];

export const PRESETS: Record<PresetName, PageComposition> = {
  "landing-saas": LANDING_SAAS,
  "detail-ecommerce": DETAIL_ECOMMERCE,
  "sns-card": SNS_CARD,
  "business-doc": BUSINESS_DOC,
};

export {
  LANDING_SAAS,
  DETAIL_ECOMMERCE,
  SNS_CARD,
  BUSINESS_DOC,
};

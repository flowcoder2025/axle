/**
 * Re-export shim — Phase 21 WI-727.
 *
 * The engine lives in `@axle/ai/src/erp/coa-suggest.ts` so the AI
 * dispatcher handler (also in `@axle/ai`) can call it without a
 * cross-workspace import. Apps/web keeps this shim so existing
 * intake/confirm imports stay stable.
 */
export {
  MIN_CONFIDENCE,
  ACCURACY_SLO_TOP1,
  suggestForLine,
  suggestForLines,
  evaluateAccuracy,
} from "@axle/ai";
export type {
  OrderDirection,
  CoaSuggestLineInput,
  CoaSuggestion,
  AccuracyCase,
  AccuracyReport,
} from "@axle/ai";

/**
 * AI copy pipeline — provider abstraction (WI-507).
 *
 * The pipeline takes a free-form intent and returns block-shaped copy
 * payloads. The actual generation (LLM call, prompt, model) is abstracted
 * behind `CopyProvider` so:
 *
 *   - Tests run without an LLM (the deterministic provider is bundled).
 *   - Apps can plug `@axle/ai` (per `pbc-block-builder.md` §10) or any
 *     other provider without forcing this package to depend on the AI
 *     SDK.
 *   - C2 reviews enforcement stays in this package — providers never see
 *     the C2 request, so an over-eager LLM cannot fabricate review data.
 */

import type { ZodSchema } from "zod";
import type { BlockId, Locale } from "../types.js";

/** Pipeline Stage 2 output — extracted from the user's intent. */
export interface CopyBrief {
  /** One-line product summary derived from the intent. */
  summary: string;
  /**
   * Three-to-six bullet keypoints distilled from the intent. The
   * deterministic provider falls back to splitting on punctuation; LLM
   * providers are expected to reason here.
   */
  keyPoints: string[];
  /** Optional industry tag forwarded from the request. */
  industry?: string;
  /** Brand voice descriptor forwarded from the request. */
  brandTone?: string;
  language?: Locale;
}

/** Inputs to a per-block generation call. */
export interface BlockCopyRequest {
  blockId: BlockId;
  /**
   * The block's zod schema — providers can use it to constrain output
   * (LLM JSON-mode schema, retries on validation failure, etc.).
   */
  blockSchema?: ZodSchema<unknown>;
  brief: CopyBrief;
  /**
   * Anchor block (typically A1) generated first. Subsequent blocks are
   * conditioned on it so language stays consistent across the page.
   * `undefined` for the anchor call itself.
   */
  anchor?: { id: BlockId; data: unknown };
  brandTone?: string;
  language?: Locale;
}

export interface CopyProvider {
  brief(req: {
    intent: string;
    industry?: string;
    brandTone?: string;
    language?: Locale;
  }): Promise<CopyBrief>;
  blockCopy(req: BlockCopyRequest): Promise<unknown>;
}

/** Options for `generateCopy`. */
export interface GenerateCopyOptions {
  /** Provider override. Defaults to `createDeterministicCopyProvider()`. */
  provider?: CopyProvider;
}

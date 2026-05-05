/**
 * `NomuAiClient` — boundary the PBC depends on; the actual LLM call
 * lives in `packages/ai`. Keeping the surface narrow (one method, no
 * provider-specific options) means the PBC can swap providers without
 * touching the consultation orchestration.
 */

import type { NomuTopic } from "./preprocess.js";

export interface NomuAiGenerateInput {
  /** Raw question, redacted of PII (mirror of `redactedQuestion`). */
  question: string;
  /** Identical to `question` — kept distinct so a future variant can
   * forward the unredacted question to a trusted same-tenant model. */
  redactedQuestion: string;
  orgId: string;
  topic: NomuTopic;
  /** Optional citations supplied by the caller (RAG retrieval, etc). */
  referenceCitations?: ReadonlyArray<string>;
}

export interface NomuAiGenerateOutput {
  answer: string;
  /** Citations the LLM was directly told to use; the validator will
   * additionally extract any inline citations from `answer`. */
  citations?: ReadonlyArray<string>;
}

export interface NomuAiClient {
  generateAnswer(input: NomuAiGenerateInput): Promise<NomuAiGenerateOutput>;
}

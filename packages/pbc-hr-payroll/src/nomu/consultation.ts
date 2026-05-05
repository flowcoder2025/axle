/**
 * `createNomuConsultationService` — composes preprocess → AI client
 * (boundary) → store → validate. The consumer wires a real
 * `NomuAiClient` from `packages/ai`; the PBC owns the deterministic
 * pre/post and the persistence model.
 *
 * The `ask` flow refuses to leave a half-record behind: the AI client
 * is called **before** the consultation row is inserted, so a
 * provider failure surfaces as an exception with no DB write.
 *
 * `validate` re-runs the deterministic post-checks against the stored
 * answer and persists the verdict on the same row so consumers can
 * render "법령 인용 OK / 단정적 표현 경고" without re-running the
 * checks themselves.
 */

import type { NomuConsultationService } from "../types.js";
import type { NomuAiClient } from "./aiClient.js";
import {
  classifyNomuTopic,
  redactNomuPii,
} from "./preprocess.js";
import type {
  NomuConsultationRecord,
  NomuConsultationStore,
} from "./store.js";
import {
  extractKoreanLaborLawCitations,
  validateNomuAnswer,
  type NomuValidationResult,
} from "./validate.js";

export interface NomuConsultationServiceDeps {
  store: NomuConsultationStore;
  ai: NomuAiClient;
  now?: () => Date;
}

let idSeq = 0;
function nextConsultationId(): string {
  idSeq += 1;
  return `nomu_${Date.now().toString(36)}_${idSeq.toString(36)}`;
}

export function createNomuConsultationService(
  deps: NomuConsultationServiceDeps,
): NomuConsultationService {
  const now = deps.now ?? (() => new Date());

  return {
    async ask({ question, orgId }) {
      const redactedQuestion = redactNomuPii(question);
      const topic = classifyNomuTopic(question);

      const aiResult = await deps.ai.generateAnswer({
        question: redactedQuestion,
        redactedQuestion,
        orgId,
        topic,
      });

      const inlineCitations = extractKoreanLaborLawCitations(aiResult.answer);
      const citations = [
        ...new Set([...(aiResult.citations ?? []), ...inlineCitations]),
      ];

      const record: NomuConsultationRecord = {
        id: nextConsultationId(),
        orgId,
        question: redactedQuestion,
        redactedQuestion,
        topic,
        answer: aiResult.answer,
        citations,
        createdAt: now(),
      };
      await deps.store.insert(record);
      return { id: record.id, answer: record.answer };
    },

    async validate({ consultationId }) {
      const existing = await deps.store.findById(consultationId);
      if (!existing) {
        throw new Error(
          `nomu.validate: consultation ${consultationId} not found`,
        );
      }
      const verdict: NomuValidationResult = validateNomuAnswer(existing.answer);
      await deps.store.update({ ...existing, validation: verdict });
      return verdict.valid
        ? { valid: true, ...(verdict.reason ? { reason: verdict.reason } : {}) }
        : { valid: false, reason: verdict.reason };
    },
  };
}

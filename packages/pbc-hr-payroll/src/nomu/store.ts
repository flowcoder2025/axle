/**
 * `NomuConsultationStore` — abstract persistence boundary for the
 * nomu consultation flow. The in-memory implementation backs WI-606
 * tests; WI-607 swaps in a Prisma adapter once the FlowTeams models
 * are ported.
 */

import type { NomuTopic } from "./preprocess.js";
import type { NomuValidationResult } from "./validate.js";

export interface NomuConsultationRecord {
  id: string;
  orgId: string;
  userId?: string;
  /** Raw user input (post-redaction — see service.ts). */
  question: string;
  /** PII-stripped form forwarded to the LLM. */
  redactedQuestion: string;
  topic: NomuTopic;
  answer: string;
  citations: string[];
  createdAt: Date;
  validation?: NomuValidationResult;
}

export interface NomuConsultationStore {
  insert(record: NomuConsultationRecord): Promise<void>;
  findById(id: string): Promise<NomuConsultationRecord | null>;
  update(record: NomuConsultationRecord): Promise<void>;
  listByOrg(orgId: string): Promise<NomuConsultationRecord[]>;
}

export function createInMemoryNomuConsultationStore(): NomuConsultationStore {
  const records = new Map<string, NomuConsultationRecord>();
  const clone = (r: NomuConsultationRecord): NomuConsultationRecord => ({
    ...r,
    citations: [...r.citations],
    topic: { ...r.topic },
    validation: r.validation
      ? {
          ...r.validation,
          warnings: r.validation.warnings ? [...r.validation.warnings] : undefined,
        }
      : undefined,
  });

  return {
    async insert(record) {
      records.set(record.id, clone(record));
    },
    async findById(id) {
      const r = records.get(id);
      return r ? clone(r) : null;
    },
    async update(record) {
      records.set(record.id, clone(record));
    },
    async listByOrg(orgId) {
      return [...records.values()]
        .filter((r) => r.orgId === orgId)
        .map(clone)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
  };
}

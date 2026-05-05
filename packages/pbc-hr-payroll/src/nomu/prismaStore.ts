/**
 * Prisma adapter for `NomuConsultationStore`. See
 * `attendance/prismaStore.ts` file header for the structural-typing
 * rationale.
 *
 * The schema row flattens the in-memory shape:
 *   - `topic.{category, confidence}` → `topicCategory` + `topicConfidence`
 *   - `validation.{valid, reason, warnings}` → 3 nullable columns
 *
 * `findById` rebuilds the nested objects on the way out so the
 * adapter is a transparent swap for the in-memory store.
 */

import type { NomuTopic, NomuTopicCategory } from "./preprocess.js";
import type {
  NomuConsultationRecord,
  NomuConsultationStore,
} from "./store.js";
import type { NomuValidationResult } from "./validate.js";

interface NomuRow {
  id: string;
  organizationId: string;
  userId: string | null;
  question: string;
  redactedQuestion: string;
  topicCategory: string;
  topicConfidence: number;
  answer: string;
  citations: string[];
  validationValid: boolean | null;
  validationReason: string | null;
  validationWarnings: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PrismaNomuConsultationDelegateLike {
  create(args: { data: NomuRow }): Promise<NomuRow>;
  update(args: {
    where: { id: string };
    data: Partial<NomuRow>;
  }): Promise<NomuRow>;
  findUnique(args: { where: { id: string } }): Promise<NomuRow | null>;
  findMany(args: {
    where: { organizationId: string };
    orderBy?: { createdAt: "asc" };
  }): Promise<NomuRow[]>;
}

function recordToRow(
  record: NomuConsultationRecord,
  updatedAt: Date,
): NomuRow {
  return {
    id: record.id,
    organizationId: record.orgId,
    userId: record.userId ?? null,
    question: record.question,
    redactedQuestion: record.redactedQuestion,
    topicCategory: record.topic.category,
    topicConfidence: record.topic.confidence,
    answer: record.answer,
    citations: [...record.citations],
    validationValid: record.validation?.valid ?? null,
    validationReason: record.validation?.reason ?? null,
    validationWarnings: record.validation?.warnings
      ? [...record.validation.warnings]
      : [],
    createdAt: record.createdAt,
    updatedAt,
  };
}

function rowToRecord(row: NomuRow): NomuConsultationRecord {
  const topic: NomuTopic = {
    category: row.topicCategory as NomuTopicCategory,
    confidence: row.topicConfidence,
  };
  let validation: NomuValidationResult | undefined;
  if (row.validationValid !== null) {
    validation = {
      valid: row.validationValid,
      ...(row.validationReason !== null && { reason: row.validationReason }),
      ...(row.validationWarnings.length > 0 && {
        warnings: [...row.validationWarnings],
      }),
    };
  }
  return {
    id: row.id,
    orgId: row.organizationId,
    ...(row.userId !== null && { userId: row.userId }),
    question: row.question,
    redactedQuestion: row.redactedQuestion,
    topic,
    answer: row.answer,
    citations: [...row.citations],
    createdAt: row.createdAt,
    ...(validation && { validation }),
  };
}

export function createPrismaNomuConsultationStore(
  delegate: PrismaNomuConsultationDelegateLike,
): NomuConsultationStore {
  return {
    async insert(record) {
      await delegate.create({ data: recordToRow(record, record.createdAt) });
    },
    async findById(id) {
      const row = await delegate.findUnique({ where: { id } });
      return row ? rowToRecord(row) : null;
    },
    async update(record) {
      const row = recordToRow(record, new Date());
      await delegate.update({
        where: { id: record.id },
        data: {
          answer: row.answer,
          citations: row.citations,
          topicCategory: row.topicCategory,
          topicConfidence: row.topicConfidence,
          validationValid: row.validationValid,
          validationReason: row.validationReason,
          validationWarnings: row.validationWarnings,
          updatedAt: row.updatedAt,
        },
      });
    },
    async listByOrg(orgId) {
      const rows = await delegate.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: "asc" },
      });
      return rows.map(rowToRecord);
    },
  };
}

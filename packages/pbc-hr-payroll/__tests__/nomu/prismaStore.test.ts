/**
 * WI-607 — Prisma adapter for `NomuConsultationStore`.
 *
 * Mirrors the in-memory store contract from WI-606 and persists to
 * the new `NomuConsultation` row in the HR Payroll Domain section of
 * packages/db/prisma/schema.prisma.
 */

import { describe, expect, it, vi } from "vitest";
import {
  createPrismaNomuConsultationStore,
  type PrismaNomuConsultationDelegateLike,
} from "../../src/index.js";

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

function spyDelegate(initial: Map<string, NomuRow> = new Map()) {
  const rows = new Map(initial);
  const create = vi.fn(async ({ data }: { data: NomuRow }) => {
    rows.set(data.id, { ...data });
    return { ...data };
  });
  const update = vi.fn(
    async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<NomuRow>;
    }) => {
      const existing = rows.get(where.id);
      if (!existing) throw new Error("not found");
      const next = { ...existing, ...data };
      rows.set(where.id, next);
      return { ...next };
    },
  );
  const findUnique = vi.fn(
    async ({ where }: { where: { id: string } }) =>
      rows.get(where.id) ?? null,
  );
  const findMany = vi.fn(
    async ({
      where,
    }: {
      where: { organizationId: string };
    }) =>
      [...rows.values()]
        .filter((r) => r.organizationId === where.organizationId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
  );
  const delegate: PrismaNomuConsultationDelegateLike = {
    create,
    update,
    findUnique,
    findMany,
  };
  return { delegate, rows, spies: { create, update, findUnique, findMany } };
}

describe("WI-607 — createPrismaNomuConsultationStore.insert", () => {
  it("flattens topic + validation onto the row and persists citations[]", async () => {
    const { delegate, spies, rows } = spyDelegate();
    const store = createPrismaNomuConsultationStore(delegate);
    await store.insert({
      id: "nomu_1",
      orgId: "org_1",
      question: "주민번호 [REDACTED:RRN] 직원의 연장수당?",
      redactedQuestion: "주민번호 [REDACTED:RRN] 직원의 연장수당?",
      topic: { category: "WAGE", confidence: 0.6 },
      answer: "근로기준법 제56조에 따라 ...",
      citations: ["근로기준법 제56조"],
      createdAt: new Date("2026-05-15T00:00:00Z"),
    });
    expect(spies.create).toHaveBeenCalledOnce();
    const arg = spies.create.mock.calls[0]![0] as { data: NomuRow };
    expect(arg.data.organizationId).toBe("org_1");
    expect(arg.data.topicCategory).toBe("WAGE");
    expect(arg.data.topicConfidence).toBeCloseTo(0.6, 2);
    expect(arg.data.citations).toEqual(["근로기준법 제56조"]);
    expect(arg.data.validationValid).toBeNull();
    expect(rows.get("nomu_1")?.answer).toContain("근로기준법");
  });
});

describe("WI-607 — createPrismaNomuConsultationStore.findById", () => {
  it("rebuilds the topic object and the optional validation from the row", async () => {
    const { delegate } = spyDelegate(
      new Map([
        [
          "nomu_1",
          {
            id: "nomu_1",
            organizationId: "org_1",
            userId: null,
            question: "q",
            redactedQuestion: "q",
            topicCategory: "WAGE",
            topicConfidence: 0.8,
            answer: "a",
            citations: ["근로기준법 제56조"],
            validationValid: true,
            validationReason: null,
            validationWarnings: ["over-confident wording"],
            createdAt: new Date("2026-05-15T00:00:00Z"),
            updatedAt: new Date("2026-05-15T00:00:00Z"),
          },
        ],
      ]),
    );
    const store = createPrismaNomuConsultationStore(delegate);
    const r = await store.findById("nomu_1");
    expect(r?.topic).toEqual({ category: "WAGE", confidence: 0.8 });
    expect(r?.validation?.valid).toBe(true);
    expect(r?.validation?.warnings).toEqual(["over-confident wording"]);
  });

  it("returns null for an unknown id", async () => {
    const { delegate } = spyDelegate();
    const store = createPrismaNomuConsultationStore(delegate);
    expect(await store.findById("nomu_x")).toBeNull();
  });
});

describe("WI-607 — createPrismaNomuConsultationStore.update + listByOrg", () => {
  it("update writes the validation fields back onto the same row", async () => {
    const { delegate, spies, rows } = spyDelegate(
      new Map([
        [
          "nomu_1",
          {
            id: "nomu_1",
            organizationId: "org_1",
            userId: null,
            question: "q",
            redactedQuestion: "q",
            topicCategory: "WAGE",
            topicConfidence: 0.6,
            answer: "a",
            citations: [],
            validationValid: null,
            validationReason: null,
            validationWarnings: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      ]),
    );
    const store = createPrismaNomuConsultationStore(delegate);
    await store.update({
      id: "nomu_1",
      orgId: "org_1",
      question: "q",
      redactedQuestion: "q",
      topic: { category: "WAGE", confidence: 0.6 },
      answer: "a",
      citations: [],
      createdAt: rows.get("nomu_1")!.createdAt,
      validation: { valid: false, reason: "no citation" },
    });
    expect(spies.update).toHaveBeenCalledOnce();
    expect(rows.get("nomu_1")?.validationValid).toBe(false);
    expect(rows.get("nomu_1")?.validationReason).toBe("no citation");
  });

  it("listByOrg passes the organizationId predicate through", async () => {
    const { delegate, spies } = spyDelegate();
    const store = createPrismaNomuConsultationStore(delegate);
    await store.listByOrg("org_42");
    const arg = spies.findMany.mock.calls[0]![0] as {
      where: { organizationId: string };
    };
    expect(arg.where.organizationId).toBe("org_42");
  });
});

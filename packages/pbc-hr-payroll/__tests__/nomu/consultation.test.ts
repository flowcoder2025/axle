/**
 * WI-606 — `createNomuConsultationService` end-to-end.
 *
 * The service composes preprocess → AI client (boundary) → store →
 * validate. Tests use a stub `NomuAiClient` so the suite is hermetic;
 * the real `packages/ai`-backed client lands in a follow-up.
 */

import { describe, expect, it } from "vitest";
import {
  createInMemoryNomuConsultationStore,
  createNomuConsultationService,
  type NomuAiClient,
} from "../../src/index.js";

function stubAi(
  generate: (input: Parameters<NomuAiClient["generateAnswer"]>[0]) =>
    | Promise<{ answer: string; citations?: string[] }>
    | { answer: string; citations?: string[] },
): NomuAiClient {
  return {
    async generateAnswer(input) {
      return generate(input);
    },
  };
}

const FIXED_NOW = new Date("2026-05-15T03:00:00Z");

describe("WI-606 — service.ask", () => {
  it("redacts PII before calling the AI client", async () => {
    const seen: { redactedQuestion: string; question: string }[] = [];
    const store = createInMemoryNomuConsultationStore();
    const svc = createNomuConsultationService({
      store,
      ai: stubAi(({ question, redactedQuestion }) => {
        seen.push({ question, redactedQuestion });
        return {
          answer:
            "근로기준법 제56조에 따라 연장근로는 통상임금의 50%를 가산하여 지급해야 합니다. " +
            "구체 사례는 노무사에게 문의하시기 바랍니다.",
        };
      }),
      now: () => FIXED_NOW,
    });

    await svc.ask({
      question: "주민번호 900101-1234567 직원의 연장수당 계산?",
      orgId: "org_1",
    });

    expect(seen).toHaveLength(1);
    // The AI client receives the redacted question; the original is
    // preserved internally but never crosses the boundary.
    expect(seen[0]!.redactedQuestion).toContain("[REDACTED:RRN]");
    expect(seen[0]!.redactedQuestion).not.toContain("900101-1234567");
    expect(seen[0]!.question).toContain("[REDACTED:RRN]");
  });

  it("classifies the topic and forwards it to the AI client", async () => {
    const seen: Array<{ category: string; confidence: number }> = [];
    const svc = createNomuConsultationService({
      store: createInMemoryNomuConsultationStore(),
      ai: stubAi(({ topic }) => {
        seen.push({ category: topic.category, confidence: topic.confidence });
        return {
          answer:
            "근로기준법 제60조에 따라 1년 미만 근속자는 월 1일씩 연차가 발생합니다. " +
            "추가 사항은 노무사에게 문의하시기 바랍니다.",
        };
      }),
      now: () => FIXED_NOW,
    });

    await svc.ask({
      question: "수습 기간에도 연차가 발생하나요?",
      orgId: "org_1",
    });

    expect(seen[0]!.category).toBe("LEAVE");
    expect(seen[0]!.confidence).toBeGreaterThan(0);
  });

  it("persists a NomuConsultationRecord with the canonical id and answer", async () => {
    const store = createInMemoryNomuConsultationStore();
    const svc = createNomuConsultationService({
      store,
      ai: stubAi(() => ({
        answer:
          "근로기준법 제56조에 따라 연장근로는 통상임금의 50%를 가산하여 지급해야 합니다. " +
          "추가 사항은 노무사에게 문의하시기 바랍니다.",
        citations: ["근로기준법 제56조"],
      })),
      now: () => FIXED_NOW,
    });

    const r = await svc.ask({ question: "연장수당", orgId: "org_1" });
    expect(r.id).toMatch(/^nomu_/);
    expect(r.answer).toContain("근로기준법 제56조");

    const stored = await store.findById(r.id);
    expect(stored?.id).toBe(r.id);
    expect(stored?.orgId).toBe("org_1");
    expect(stored?.answer).toBe(r.answer);
    expect(stored?.createdAt).toEqual(FIXED_NOW);
    expect(stored?.citations).toContain("근로기준법 제56조");
  });

  it("propagates the AI client failure as a NomuAiError (no half-stored record)", async () => {
    const store = createInMemoryNomuConsultationStore();
    const svc = createNomuConsultationService({
      store,
      ai: stubAi(async () => {
        throw new Error("rate-limited");
      }),
      now: () => FIXED_NOW,
    });

    await expect(
      svc.ask({ question: "x", orgId: "org_1" }),
    ).rejects.toThrow(/rate-limited/);

    // No record should have been persisted
    expect((await store.listByOrg("org_1")).length).toBe(0);
  });
});

describe("WI-606 — service.validate", () => {
  it("returns valid=true for a citation-bearing, sensible answer and persists the verdict", async () => {
    const store = createInMemoryNomuConsultationStore();
    const svc = createNomuConsultationService({
      store,
      ai: stubAi(() => ({
        answer:
          "근로기준법 제56조에 따라 연장근로는 통상임금의 50%를 가산하여 지급해야 합니다. " +
          "구체 사례는 노무사에게 문의하시기 바랍니다.",
      })),
      now: () => FIXED_NOW,
    });

    const r = await svc.ask({ question: "연장수당", orgId: "org_1" });
    const v = await svc.validate({ consultationId: r.id });

    expect(v.valid).toBe(true);
    const stored = await store.findById(r.id);
    expect(stored?.validation?.valid).toBe(true);
  });

  it("returns valid=false with the reason when the answer fails citation check", async () => {
    const store = createInMemoryNomuConsultationStore();
    const svc = createNomuConsultationService({
      store,
      ai: stubAi(() => ({
        answer:
          "연장수당은 50%를 가산해야 합니다. 자세한 사항은 노무사 자문을 받으세요. " +
          "회사가 임의로 강제할 수 없는 점에 유의하세요.",
      })),
      now: () => FIXED_NOW,
    });

    const r = await svc.ask({ question: "연장수당", orgId: "org_1" });
    const v = await svc.validate({ consultationId: r.id });

    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/citation|법령/i);
  });

  it("throws when the consultationId is unknown", async () => {
    const svc = createNomuConsultationService({
      store: createInMemoryNomuConsultationStore(),
      ai: stubAi(() => ({ answer: "x" })),
      now: () => FIXED_NOW,
    });
    await expect(
      svc.validate({ consultationId: "nomu_missing" }),
    ).rejects.toThrow(/not found/i);
  });
});

describe("WI-606 — InMemoryNomuConsultationStore", () => {
  it("listByOrg returns records in createdAt order", async () => {
    const store = createInMemoryNomuConsultationStore();
    await store.insert({
      id: "n1",
      orgId: "org_1",
      question: "q1",
      redactedQuestion: "q1",
      answer: "a1",
      citations: [],
      topic: { category: "OTHER", confidence: 0 },
      createdAt: new Date("2026-05-01T00:00:00Z"),
    });
    await store.insert({
      id: "n2",
      orgId: "org_1",
      question: "q2",
      redactedQuestion: "q2",
      answer: "a2",
      citations: [],
      topic: { category: "OTHER", confidence: 0 },
      createdAt: new Date("2026-05-02T00:00:00Z"),
    });
    await store.insert({
      id: "n3",
      orgId: "org_2", // different org
      question: "q3",
      redactedQuestion: "q3",
      answer: "a3",
      citations: [],
      topic: { category: "OTHER", confidence: 0 },
      createdAt: new Date("2026-05-03T00:00:00Z"),
    });
    const list = await store.listByOrg("org_1");
    expect(list.map((r) => r.id)).toEqual(["n1", "n2"]);
  });
});

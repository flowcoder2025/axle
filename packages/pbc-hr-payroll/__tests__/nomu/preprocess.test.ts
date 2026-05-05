/**
 * WI-606 — question pre-processing for nomu consultation.
 *
 * The PBC owns the **deterministic** prep work that has to happen
 * before the LLM call (so the AI client in `packages/ai` never sees
 * raw PII and so the topic routing is auditable). The two surfaces:
 *
 *   - `classifyNomuTopic(question)` — keyword heuristic returning a
 *     `NomuTopic` with a confidence in [0, 1].
 *   - `redactNomuPii(text)` — masks 주민번호 / 전화번호 / 이메일.
 *
 * Both are pure and tested without spinning up the service factory.
 */

import { describe, expect, it } from "vitest";
import {
  classifyNomuTopic,
  redactNomuPii,
  type NomuTopicCategory,
} from "../../src/index.js";

describe("WI-606 — classifyNomuTopic (keyword heuristic)", () => {
  const cases: Array<{ q: string; expected: NomuTopicCategory }> = [
    { q: "연장수당 어떻게 계산하나요?", expected: "WAGE" },
    { q: "주휴수당이 빠진 것 같아요", expected: "WAGE" },
    { q: "지각이 잦은 직원에게 어떻게 대응?", expected: "ATTENDANCE" },
    { q: "출산휴가는 며칠인가요?", expected: "LEAVE" },
    { q: "연차 미사용 보상", expected: "LEAVE" },
    { q: "해고 통보 절차가 궁금합니다", expected: "DISMISSAL" },
    { q: "권고사직과 해고 차이?", expected: "DISMISSAL" },
    { q: "징계 절차에서 시말서 요구가 정당한가요?", expected: "DISCIPLINE" },
    { q: "4대보험 가입 의무 기준?", expected: "INSURANCE" },
    { q: "산재 발생 시 회사 책임", expected: "INSURANCE" },
    { q: "근로계약서 작성 시 필수 기재사항", expected: "CONTRACT" },
    { q: "수습기간 연장 가능한지", expected: "CONTRACT" },
    { q: "회사 대표가 사무실 인테리어 추천을 부탁했어요", expected: "OTHER" },
  ];

  for (const c of cases) {
    it(`"${c.q}" → ${c.expected}`, () => {
      const topic = classifyNomuTopic(c.q);
      expect(topic.category).toBe(c.expected);
      expect(topic.confidence).toBeGreaterThanOrEqual(0);
      expect(topic.confidence).toBeLessThanOrEqual(1);
    });
  }

  it("returns OTHER with confidence 0 for an empty question", () => {
    const topic = classifyNomuTopic("");
    expect(topic.category).toBe("OTHER");
    expect(topic.confidence).toBe(0);
  });

  it("OTHER hits get a strictly lower confidence than keyword hits", () => {
    const keyword = classifyNomuTopic("연차 사용 가능 여부");
    const other = classifyNomuTopic("회사에서 자전거 거치대를 마련해야 할까요");
    expect(other.confidence).toBeLessThan(keyword.confidence);
  });
});

describe("WI-606 — redactNomuPii (Korean PII patterns)", () => {
  it("masks 주민번호 (13 digits with hyphen)", () => {
    const out = redactNomuPii("내 주민번호는 900101-1234567 입니다.");
    expect(out).not.toContain("900101-1234567");
    expect(out).toMatch(/\[REDACTED:RRN\]/);
  });

  it("masks 휴대폰 번호 (010-xxxx-xxxx and 010xxxxxxxx)", () => {
    expect(redactNomuPii("010-1234-5678 로 연락주세요")).toMatch(
      /\[REDACTED:PHONE\]/,
    );
    expect(redactNomuPii("01012345678 로 연락 가능")).toMatch(
      /\[REDACTED:PHONE\]/,
    );
  });

  it("masks email addresses", () => {
    expect(redactNomuPii("문의는 nomu@example.co.kr 로 부탁")).toMatch(
      /\[REDACTED:EMAIL\]/,
    );
  });

  it("preserves unrelated digits (예: 근로기준법 제56조)", () => {
    const out = redactNomuPii("근로기준법 제56조에 따른 가산임금");
    expect(out).toContain("제56조");
  });

  it("redacts multiple PII items in a single message", () => {
    const out = redactNomuPii(
      "주민번호 900101-1234567, 폰 010-1111-2222, 메일 a@b.com",
    );
    expect(out).toMatch(/\[REDACTED:RRN\]/);
    expect(out).toMatch(/\[REDACTED:PHONE\]/);
    expect(out).toMatch(/\[REDACTED:EMAIL\]/);
  });

  it("returns the empty string unchanged", () => {
    expect(redactNomuPii("")).toBe("");
  });
});

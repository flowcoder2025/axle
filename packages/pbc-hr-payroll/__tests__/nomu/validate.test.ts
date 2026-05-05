/**
 * WI-606 — answer validation rules.
 *
 * The PBC owns the **deterministic** post-checks that decide whether
 * an LLM answer is fit to surface to the consumer. The checks are
 * intentionally narrow:
 *
 *   1. cited at least one Korean labor law clause (`근로기준법 제xx조`
 *      or one of the recognised statutes).
 *   2. length is in [50, 5000] chars (a one-line answer is almost
 *      certainly a refusal that needs human review; a 5kb wall is
 *      almost certainly hallucinated boilerplate).
 *   3. does not contain a banned phrase (advice that suggests evading
 *      labor law).
 */

import { describe, expect, it } from "vitest";
import {
  extractKoreanLaborLawCitations,
  validateNomuAnswer,
} from "../../src/index.js";

describe("WI-606 — extractKoreanLaborLawCitations", () => {
  it("extracts 근로기준법 제56조 from prose", () => {
    const cites = extractKoreanLaborLawCitations(
      "근로기준법 제56조에 따라 50% 가산이 됩니다.",
    );
    expect(cites).toContain("근로기준법 제56조");
  });

  it("extracts multiple distinct clauses", () => {
    const cites = extractKoreanLaborLawCitations(
      "근로기준법 제56조와 산업재해보상보험법 제5조를 함께 보세요.",
    );
    expect(cites.sort()).toEqual([
      "근로기준법 제56조",
      "산업재해보상보험법 제5조",
    ]);
  });

  it("recognises 남녀고용평등법 / 최저임금법 / 근로자퇴직급여보장법 / 산업안전보건법", () => {
    const cites = extractKoreanLaborLawCitations(`
      남녀고용평등법 제18조, 최저임금법 제6조, 근로자퇴직급여보장법 제8조,
      산업안전보건법 제25조
    `);
    expect(cites).toEqual(
      expect.arrayContaining([
        "남녀고용평등법 제18조",
        "최저임금법 제6조",
        "근로자퇴직급여보장법 제8조",
        "산업안전보건법 제25조",
      ]),
    );
  });

  it("returns an empty array when no recognised statute is mentioned", () => {
    expect(extractKoreanLaborLawCitations("그냥 일반적인 답변입니다.")).toEqual(
      [],
    );
  });

  it("deduplicates repeated citations", () => {
    const cites = extractKoreanLaborLawCitations(
      "근로기준법 제56조 ... 다시 한 번 근로기준법 제56조 ...",
    );
    expect(cites).toEqual(["근로기준법 제56조"]);
  });
});

describe("WI-606 — validateNomuAnswer", () => {
  const goodAnswer =
    "근로기준법 제56조에 따라 연장근로는 통상임금의 50%를 가산하여 지급해야 합니다. " +
    "회사는 사전 합의 없이 연장근로를 강제할 수 없으며, 1주 12시간 한도가 적용됩니다. " +
    "구체 사례는 노무사 자문을 권장드립니다.";

  it("ok=true when length, citation, and ban-list checks all pass", () => {
    const r = validateNomuAnswer(goodAnswer);
    expect(r.valid).toBe(true);
    expect(r.warnings ?? []).toEqual([]);
  });

  it("ok=false when no Korean labor law citation is present", () => {
    const r = validateNomuAnswer(
      "연장근로 수당은 50%를 가산해야 합니다. " +
        "회사는 임의로 연장근로를 강제할 수 없습니다. " +
        "더 자세한 사항은 노무사 자문을 받으시기 바랍니다.",
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/citation|법령/i);
  });

  it("ok=false when the answer is shorter than 50 chars", () => {
    const r = validateNomuAnswer("근로기준법 제56조 참고");
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/short/i);
  });

  it("ok=false when the answer is longer than 5000 chars", () => {
    const long = "근로기준법 제56조. " + "ㅁ".repeat(6000);
    const r = validateNomuAnswer(long);
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/long/i);
  });

  it("ok=false on a banned phrase (advice to evade labor law)", () => {
    const r = validateNomuAnswer(
      "근로기준법 제56조 회피하는 방법은 가짜 근로계약서를 작성하는 것입니다. " +
        "이렇게 하면 신고를 피할 수 있습니다. " +
        "구체적인 방법은 추가로 안내드릴 수 있습니다.",
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/banned|회피/i);
  });

  it("emits a warning (but stays valid) when ≥ 5 strong-claim adverbs are used", () => {
    const r = validateNomuAnswer(
      "근로기준법 제56조에 따라 반드시 100% 절대로 무조건 분명히 명백히 가산수당을 지급해야 합니다. " +
        "이는 예외 없이 적용됩니다. " +
        "더 자세한 사항은 노무사에게 문의하시기 바랍니다.",
    );
    expect(r.valid).toBe(true);
    expect(r.warnings ?? []).toEqual(
      expect.arrayContaining([expect.stringMatching(/absolute|단정/i)]),
    );
  });

  it("ok=false on an empty answer (defensive)", () => {
    const r = validateNomuAnswer("");
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/empty|short/i);
  });
});

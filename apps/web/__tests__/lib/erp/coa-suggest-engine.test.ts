/**
 * Phase 21 WI-727 — COA suggest engine + accuracy SLO gate.
 *
 * The SLO test is the load-bearing assertion: top-1 ≥ 75% on the 100-case
 * validation fixture. If the engine regresses below that, intake confirm
 * disables AI auto-promotion (lines stay UNCLASSIFIED) — design §5 WI-727
 * AC #4. So the test fails fast when the fixture or the engine drift.
 */

import { describe, it, expect } from "vitest";
import {
  suggestForLine,
  suggestForLines,
  evaluateAccuracy,
  MIN_CONFIDENCE,
  ACCURACY_SLO_TOP1,
} from "../../../lib/erp/coa-suggest-engine";
import { COA_VALIDATION_SET } from "../../fixtures/coa-validation-set";

describe("suggestForLine — keyword matches", () => {
  it("returns 514 (통신비) for KT 휴대폰요금", () => {
    const out = suggestForLine({
      lineIndex: 0,
      productName: "KT 휴대폰요금",
      orderType: "PURCHASE",
    });
    expect(out?.coaCode).toBe("514");
    expect(out?.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it("returns 404 (용역매출) for 컨설팅 SALE", () => {
    const out = suggestForLine({
      lineIndex: 0,
      productName: "컨설팅 용역",
      orderType: "SALE",
    });
    expect(out?.coaCode).toBe("404");
  });

  it("falls back to category default when no keyword hits", () => {
    const sale = suggestForLine({
      lineIndex: 0,
      productName: "정체 불명 매출 건",
      orderType: "SALE",
    });
    expect(sale?.coaCode).toBe("401");
    expect(sale?.confidence).toBe(MIN_CONFIDENCE);

    const purchase = suggestForLine({
      lineIndex: 1,
      productName: "정체 불명 매입 건",
      orderType: "PURCHASE",
    });
    expect(purchase?.coaCode).toBe("451");
  });

  it("returns null for empty productName", () => {
    expect(
      suggestForLine({ lineIndex: 0, productName: "", orderType: "SALE" }),
    ).toBeNull();
    expect(
      suggestForLine({ lineIndex: 0, productName: "   ", orderType: "SALE" }),
    ).toBeNull();
  });
});

describe("suggestForLines — batch", () => {
  it("returns one suggestion per non-empty input line", () => {
    const out = suggestForLines([
      { lineIndex: 0, productName: "KT 휴대폰요금", orderType: "PURCHASE" },
      { lineIndex: 1, productName: "", orderType: "SALE" },
      { lineIndex: 2, productName: "사무실 월세", orderType: "PURCHASE" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].lineIndex).toBe(0);
    expect(out[0].coaCode).toBe("514");
    expect(out[1].lineIndex).toBe(2);
    expect(out[1].coaCode).toBe("519");
  });
});

describe("evaluateAccuracy — SLO gate (top-1 ≥ 75% on 100 cases)", () => {
  it("meets the SLO on the validation fixture", () => {
    const report = evaluateAccuracy(COA_VALIDATION_SET);
    if (!report.meetsSLO) {
      // Surface the misses so a CI failure points to the regression.
      console.error("COA suggest misses:", report.misses);
    }
    expect(report.total).toBe(100);
    expect(report.top1Accuracy).toBeGreaterThanOrEqual(ACCURACY_SLO_TOP1);
    expect(report.meetsSLO).toBe(true);
  });
});

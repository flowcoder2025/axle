/**
 * Phase 21 WI-727 — COA_SUGGEST handler dispatch test.
 *
 * Verifies the thin adapter between the AiJob dispatcher and the
 * deterministic engine in `src/erp/coa-suggest.ts`. The engine itself is
 * exercised by `apps/web/__tests__/lib/erp/coa-suggest-engine.test.ts`
 * (SLO gate). Here we only check the input parsing + that registration
 * is wired into `registerBuiltinHandlers`.
 */

import { describe, it, expect } from "vitest";
import { coaSuggestHandler } from "../../src/dispatcher/handlers/coa-suggest.js";
import {
  dispatch,
  resetRegistry,
  registerBuiltinHandlers,
  InvalidJobInputError,
} from "../../src/dispatcher/index.js";

describe("coaSuggestHandler", () => {
  it("returns suggestions for valid items", async () => {
    const out = await coaSuggestHandler.run({
      items: [
        { lineIndex: 0, productName: "KT 휴대폰요금", orderType: "PURCHASE" },
        { lineIndex: 1, productName: "컨설팅 용역", orderType: "SALE" },
      ],
    });
    expect(out.suggestions).toHaveLength(2);
    expect(out.suggestions[0].coaCode).toBe("514");
    expect(out.suggestions[1].coaCode).toBe("404");
  });

  it("rejects non-array items", async () => {
    await expect(
      coaSuggestHandler.run({ items: "nope" as unknown as never }),
    ).rejects.toBeInstanceOf(InvalidJobInputError);
  });

  it("rejects items with invalid orderType", async () => {
    await expect(
      coaSuggestHandler.run({
        // @ts-expect-error invalid input
        items: [{ lineIndex: 0, productName: "x", orderType: "OTHER" }],
      }),
    ).rejects.toBeInstanceOf(InvalidJobInputError);
  });

  it("is registered by registerBuiltinHandlers under COA_SUGGEST", async () => {
    resetRegistry();
    registerBuiltinHandlers();
    const result = (await dispatch("COA_SUGGEST", {
      items: [{ lineIndex: 0, productName: "사무실 월세", orderType: "PURCHASE" }],
    })) as { suggestions: { coaCode: string }[] };
    expect(result.suggestions[0].coaCode).toBe("519");
  });
});

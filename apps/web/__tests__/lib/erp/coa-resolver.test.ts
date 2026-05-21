/**
 * Phase 21 WI-726 — coaCode SSOT resolver unit tests.
 *
 * Encodes the design §3.2 priority chain as executable assertions so
 * every OrderItem write path can share the same collapse logic without
 * each route re-implementing the coalesce.
 *
 * Priority: OrderItem.coaCode > Product.coaCode > ErpCounterparty.defaultCoaCode → null.
 */

import { describe, it, expect } from "vitest";
import { resolveCoaCode } from "../../../lib/erp/coa-resolver";

describe("resolveCoaCode — SSOT priority chain", () => {
  it("OrderItem-level value wins over Product + Counterparty", () => {
    expect(
      resolveCoaCode({
        orderItemCoaCode: "511",
        productCoaCode: "401",
        counterpartyDefaultCoaCode: "999",
      }),
    ).toEqual({ coaCode: "511", source: "orderItem" });
  });

  it("falls back to Product when OrderItem coa is null", () => {
    expect(
      resolveCoaCode({
        orderItemCoaCode: null,
        productCoaCode: "401",
        counterpartyDefaultCoaCode: "999",
      }),
    ).toEqual({ coaCode: "401", source: "product" });
  });

  it("falls back to Counterparty when OrderItem + Product are null", () => {
    expect(
      resolveCoaCode({
        orderItemCoaCode: null,
        productCoaCode: null,
        counterpartyDefaultCoaCode: "999",
      }),
    ).toEqual({ coaCode: "999", source: "counterparty" });
  });

  it("AC #4 RED — all three null → null + source=null (reports show 미분류)", () => {
    expect(
      resolveCoaCode({
        orderItemCoaCode: null,
        productCoaCode: null,
        counterpartyDefaultCoaCode: null,
      }),
    ).toEqual({ coaCode: null, source: null });
  });

  it("treats undefined the same as null (caller convenience)", () => {
    expect(resolveCoaCode({})).toEqual({ coaCode: null, source: null });
    expect(
      resolveCoaCode({ orderItemCoaCode: undefined, productCoaCode: "401" }),
    ).toEqual({ coaCode: "401", source: "product" });
  });

  it("treats whitespace-only / empty strings as null (avoids silent override)", () => {
    expect(
      resolveCoaCode({
        orderItemCoaCode: "   ",
        productCoaCode: "401",
        counterpartyDefaultCoaCode: "999",
      }),
    ).toEqual({ coaCode: "401", source: "product" });
    expect(
      resolveCoaCode({
        orderItemCoaCode: "",
        productCoaCode: "",
        counterpartyDefaultCoaCode: "999",
      }),
    ).toEqual({ coaCode: "999", source: "counterparty" });
  });

  it("trims winning value (storage stays canonical)", () => {
    expect(resolveCoaCode({ orderItemCoaCode: "  511  " })).toEqual({
      coaCode: "511",
      source: "orderItem",
    });
  });

  it("is pure / deterministic — repeated calls with the same input return identical output", () => {
    const input = {
      orderItemCoaCode: null,
      productCoaCode: "401",
      counterpartyDefaultCoaCode: "999",
    };
    const a = resolveCoaCode(input);
    const b = resolveCoaCode(input);
    expect(a).toEqual(b);
  });
});

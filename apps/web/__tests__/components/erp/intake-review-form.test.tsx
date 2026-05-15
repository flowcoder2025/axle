/**
 * WI-713a — Unit tests for the IntakeReviewForm confirm-payload helper.
 *
 * React Testing Library + jsdom are not wired into apps/web (see
 * business-plan-wizard.test.ts for prior art), so we exercise the pure
 * `buildConfirmBody` helper here. That helper is the load-bearing piece —
 * it constructs the body posted to `/api/erp/intake/[draftId]/confirm`,
 * so any drift between the form's totals and the route's Zod schema
 * surfaces in these tests.
 *
 * Render-time smoke tests for the form itself land in the WI-716 E2E
 * pass (대화형) per the plan.
 */

import { describe, it, expect } from "vitest";
import {
  buildConfirmBody,
  type IntakeOrderType,
} from "../../../src/components/erp/intake/intake-review-form";
import type { IntakeReviewItem } from "../../../src/components/erp/intake/items-table";

function sampleItems(): IntakeReviewItem[] {
  return [
    {
      productId: null,
      productName: "콜라",
      sku: null,
      qty: 2,
      unitPrice: 1500,
      unit: "개",
      shouldRegister: true,
    },
    {
      productId: "prod_123",
      productName: "삼각김밥",
      sku: "SG-001",
      qty: 3,
      unitPrice: 1200,
      unit: "개",
      shouldRegister: false,
    },
  ];
}

describe("buildConfirmBody", () => {
  it("sums line totals + tax into the top-level total", () => {
    const body = buildConfirmBody({
      type: "PURCHASE",
      counterpartyName: "ABC마트",
      counterpartyId: null,
      date: "2026-05-15",
      items: sampleItems(),
      tax: 660,
      autoRegister: true,
    });
    // 2*1500 + 3*1200 + 660 = 7260
    expect(body.total).toBe(7260);
    expect(body.tax).toBe(660);
  });

  it("passes through the order type and date as occurredAt verbatim", () => {
    const body = buildConfirmBody({
      type: "SALE",
      counterpartyName: "고객사 A",
      counterpartyId: "client_42",
      date: "2026-01-02",
      items: sampleItems(),
      tax: 0,
      autoRegister: false,
    });
    expect(body.type).toBe<IntakeOrderType>("SALE");
    expect(body.counterpartyName).toBe("고객사 A");
    expect(body.counterpartyId).toBe("client_42");
    expect(body.occurredAt).toBe("2026-01-02");
    expect(body.autoRegisterProducts).toBe(false);
  });

  it("forwards items array unchanged so the route's Zod schema sees it", () => {
    const items = sampleItems();
    const body = buildConfirmBody({
      type: "PURCHASE",
      counterpartyName: "X",
      counterpartyId: null,
      date: "2026-05-15",
      items,
      tax: 0,
      autoRegister: true,
    });
    expect(body.items).toHaveLength(2);
    expect(body.items[0].productName).toBe("콜라");
    expect(body.items[0].qty).toBe(2);
    expect(body.items[1].productId).toBe("prod_123");
    expect(body.items[1].shouldRegister).toBe(false);
  });

  it("treats non-numeric tax as zero (defensive cast)", () => {
    const body = buildConfirmBody({
      type: "PURCHASE",
      counterpartyName: "X",
      counterpartyId: null,
      date: "2026-05-15",
      items: sampleItems(),
      // simulate the state holding NaN from a cleared input
      tax: Number.NaN,
      autoRegister: true,
    });
    // 2*1500 + 3*1200 + 0 = 6600
    expect(body.total).toBe(6600);
    expect(body.tax).toBe(0);
  });

  it("returns zero total for an empty items list", () => {
    const body = buildConfirmBody({
      type: "PURCHASE",
      counterpartyName: "X",
      counterpartyId: null,
      date: "2026-05-15",
      items: [],
      tax: 0,
      autoRegister: true,
    });
    expect(body.total).toBe(0);
    expect(body.items).toEqual([]);
  });

  it("forwards counterpartyId verbatim when the autocomplete picked an existing client", () => {
    // WI-713b: CounterpartyAutocomplete sets counterpartyId when the user
    // selects from the dropdown; the form must thread it through to the
    // confirm body so the route can skip the upsert-by-name path.
    const body = buildConfirmBody({
      type: "PURCHASE",
      counterpartyName: "ABC마트",
      counterpartyId: "client_existing_42",
      date: "2026-05-15",
      items: sampleItems(),
      tax: 0,
      autoRegister: true,
    });
    expect(body.counterpartyId).toBe("client_existing_42");
    expect(body.counterpartyName).toBe("ABC마트");
  });

  it("keeps counterpartyId null when the user typed a new vendor name", () => {
    // After editing the autocomplete input the id reference is cleared, so
    // the confirm endpoint falls back to resolving by name.
    const body = buildConfirmBody({
      type: "SALE",
      counterpartyName: "신규 거래처",
      counterpartyId: null,
      date: "2026-05-15",
      items: sampleItems(),
      tax: 0,
      autoRegister: false,
    });
    expect(body.counterpartyId).toBeNull();
    expect(body.counterpartyName).toBe("신규 거래처");
    expect(body.autoRegisterProducts).toBe(false);
  });

  it("preserves per-item shouldRegister flags through the confirm body", () => {
    // WI-713b adds the per-row "신규 등록" checkbox; ensure it survives
    // serialization since the route uses it to decide whether to create a
    // Product row for productId === null items.
    const items: IntakeReviewItem[] = [
      {
        productId: null,
        productName: "신규 상품",
        sku: null,
        qty: 1,
        unitPrice: 100,
        unit: "개",
        shouldRegister: true,
      },
      {
        productId: null,
        productName: "임시 품목",
        sku: null,
        qty: 1,
        unitPrice: 100,
        unit: "개",
        shouldRegister: false,
      },
    ];
    const body = buildConfirmBody({
      type: "PURCHASE",
      counterpartyName: "X",
      counterpartyId: null,
      date: "2026-05-15",
      items,
      tax: 0,
      autoRegister: false,
    });
    expect(body.items[0].shouldRegister).toBe(true);
    expect(body.items[1].shouldRegister).toBe(false);
  });
});

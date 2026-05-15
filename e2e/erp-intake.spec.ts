import { test, expect } from "@playwright/test";
import { signInAsTestUser } from "./helpers/auth";

/**
 * WI-716 — Phase 20 receipt intake happy path.
 *
 * Coverage: PENDING IntakeDraft → review form → 등록 → redirect to
 * /erp/orders/{orderId}, asserting the new Order surface shows the same
 * counterparty + totals the user just confirmed.
 *
 * Why this scope (and not the upload + OCR leg):
 *   - The upload route + parseReceipt are exercised by 33 unit tests landed
 *     under WI-711 / WI-709a-c. Re-driving them through a real browser would
 *     require a working OCR provider (Claude Vision) plus Vercel Blob, which
 *     the E2E env doesn't have. We seed a pre-parsed PENDING draft instead.
 *   - The user-visible value of intake is the *review → confirm → order*
 *     handoff (idempotent transition, redirect target, totals math). That's
 *     what this spec locks down.
 *
 * Fixture (packages/db/seed-e2e.ts §9):
 *   IntakeDraft id   = intake-e2e-pending-confirm
 *   orgId            = org-e2e-1 (org1-owner has erp:read + erp:write grants)
 *   status           = PENDING (forced on every seed run for repeatability)
 *   parsedJson       = 1 item × ₩1,000 × 5 + ₩500 tax = ₩5,500 total
 *   matchSuggestions = {} (no product/counterparty matches → autoRegister flow)
 */

const FIXTURE = {
  draftId: "intake-e2e-pending-confirm",
  // Override the seeded vendor with a unique name so this run's Order is
  // easy to find on the redirect target page (multiple historic runs share
  // the org under org-e2e-1).
  counterpartyOverride: `WI-716 거래처 ${Date.now()}`,
  // 5 × 1,000 + 500 tax = 5,500. The order summary renders the raw integer
  // total (no thousands separator on /erp/orders/{id}/page.tsx line 94).
  expectedTotal: "5500",
} as const;

test.describe("WI-716 ERP intake review → confirm → order @smoke", () => {
  test("PENDING draft confirms to a new Order with the entered counterparty + total", async ({
    page,
  }) => {
    await signInAsTestUser(page);

    // 1) List page renders for the active tenant (org1).
    await page.goto("/erp/intake");
    await expect(
      page.getByRole("heading", { name: "영수증 등록" }),
    ).toBeVisible();

    // 2) Open the seeded draft directly — list filters on createdAt desc and
    //    other E2E runs may have produced newer drafts on the same org.
    await page.goto(`/erp/intake/${FIXTURE.draftId}`);
    await expect(
      page.getByRole("heading", { name: "영수증 검토" }),
    ).toBeVisible();
    // OCR-rendered receipt image (alt text, not src — keeps the test offline).
    await expect(page.getByAltText("영수증 원본 이미지")).toBeVisible();

    // 3) Override the counterparty so the resulting Order is uniquely
    //    identifiable on the redirect target page.
    const counterpartyInput = page.getByLabel("거래처");
    await counterpartyInput.fill(FIXTURE.counterpartyOverride);

    // 4) Submit. The route handler runs the PENDING → CONFIRMED $transaction
    //    + auto-registers the seeded item as a new Product + emits an
    //    InventoryMovement, then returns { orderId } and the client pushes
    //    /erp/orders/{orderId}.
    await page.getByRole("button", { name: "등록" }).click();

    // 5) Redirect lands on the new order detail page.
    await page.waitForURL(/\/erp\/orders\/[\w-]+$/, { timeout: 30_000 });

    // 6) The order's heading is the counterparty name we just set; the
    //    summary card shows the total we computed in the review form.
    await expect(
      page.getByRole("heading", { name: FIXTURE.counterpartyOverride }),
    ).toBeVisible();
    await expect(page.getByText(FIXTURE.expectedTotal)).toBeVisible();
  });
});

// Future E2E (intentionally not implemented here):
//   - Upload + OCR happy path: requires Claude Vision in CI + Vercel Blob.
//     Currently covered at unit-test level (WI-709a/b/c + WI-711).
//   - matchSuggestions counterparty pick: needs a seeded Client whose
//     fuzzy-normalised name overlaps the parsed vendor. Add when matching
//     UI gets product-side regressions.
//   - 폐기 (discard) flow: identical to confirm except verifies the draft is
//     marked DISCARDED and the list filter chip reflects it.

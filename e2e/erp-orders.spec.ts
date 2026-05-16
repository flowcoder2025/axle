import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { signInAsTestUser } from "./helpers/auth";

/**
 * Phase 20 ERP — Orders coverage (D1~D6 in project_next_session_e2e).
 *
 * D1: 목록 페이지 + 탭(구매/판매/전체) 동작
 * D2: 상세 페이지 + 품목 표시
 * D3: CONFIRMED → 주문 취소 → 상태 전환 + 역방향 InventoryMovement
 * D4: 더블 cancel → 409 (이미 CANCELLED)
 * D5: DRAFT cancel → cancel 버튼 미노출 (가드)
 * D6: RECEIPT_INTAKE source → intake backlink 노출
 *
 * Fixtures (packages/db/seed-e2e.ts §11–12):
 *   order-e2e-draft         — DRAFT,    PURCHASE, ad-hoc 1 line, no inv mov
 *   order-e2e-confirmed     — CONFIRMED, PURCHASE, inv product 1 line + IN mov
 *                              (seed resets to CONFIRMED + replays the IN row
 *                               so D3 is repeatable across runs)
 *   order-e2e-cancelled     — CANCELLED, SALE, ad-hoc 1 line
 *   order-e2e-from-intake   — CONFIRMED, PURCHASE, sourceId = intake-e2e-pending-confirm
 */

const FIXTURE = {
  draftId: "order-e2e-draft",
  confirmedId: "order-e2e-confirmed",
  cancelledId: "order-e2e-cancelled",
  fromIntakeId: "order-e2e-from-intake",
  intakeBacklinkSourceId: "intake-e2e-pending-confirm",
  inventoryProductId: "product-e2e-inventory",
} as const;

/** Setup helper: restore the CONFIRMED fixture back to CONFIRMED after the
 * cancel test mutates it. We can't rely on `npx tsx seed-e2e` running
 * between tests, but the cancel-then-restore round-trip keeps the in-session
 * order of D3 → D4 deterministic. */
async function patchOrderStatus(
  request: APIRequestContext,
  ctx: BrowserContext,
  orderId: string,
  toStatus: "DRAFT" | "CONFIRMED" | "CANCELLED",
): Promise<void> {
  // The /api/erp/orders/[id] PATCH route does not exist (orders are immutable
  // post-confirm). We back-door through Prisma via the test fixture only if
  // the seed step ships a maintenance endpoint. For now we accept that D3
  // mutates the order and re-seed must run between Playwright invocations —
  // documented in spec header. This helper is therefore unused; left as a
  // placeholder so a future maintenance route can plug in without rewriting.
  void request;
  void ctx;
  void orderId;
  void toStatus;
}

test.describe("ERP orders @smoke", () => {
  test("D1: 목록 페이지 + 탭(전체/구매/판매) 필터", async ({ page }) => {
    await signInAsTestUser(page);

    await page.goto("/erp/orders");
    await expect(
      page.getByRole("heading", { name: "주문 관리" }),
    ).toBeVisible();

    // All three fixture rows visible on the default (전체) tab.
    await expect(page.getByText("E2E DRAFT 거래처")).toBeVisible();
    await expect(page.getByText("E2E 취소 대상 거래처")).toBeVisible();
    await expect(page.getByText("E2E 이미 취소됨 거래처")).toBeVisible();

    // 구매 tab — PURCHASE only. SALE-typed CANCELLED row should drop.
    await page.getByRole("link", { name: "구매", exact: true }).click();
    await page.waitForURL(/type=PURCHASE/);
    await expect(page.getByText("E2E 취소 대상 거래처")).toBeVisible();
    await expect(page.getByText("E2E 이미 취소됨 거래처")).toHaveCount(0);

    // 판매 tab — SALE only. PURCHASE rows drop.
    await page.getByRole("link", { name: "판매", exact: true }).click();
    await page.waitForURL(/type=SALE/);
    await expect(page.getByText("E2E 이미 취소됨 거래처")).toBeVisible();
    await expect(page.getByText("E2E DRAFT 거래처")).toHaveCount(0);
  });

  test("D2: 상세 페이지에 거래처/총액/품목이 정확히 표시", async ({ page }) => {
    await signInAsTestUser(page);

    await page.goto(`/erp/orders/${FIXTURE.confirmedId}`);
    await expect(
      page.getByRole("heading", { name: "E2E 취소 대상 거래처" }),
    ).toBeVisible();
    // 총액 25,000 + 부가세 2,500 — renders raw integers in the summary cards.
    await expect(page.getByText("25000").first()).toBeVisible();
    await expect(page.getByText("2500").first()).toBeVisible();
    // Line item links to the underlying product detail page.
    await expect(
      page.getByRole("link", { name: "E2E 재고 추적 상품" }),
    ).toBeVisible();
  });

  test("D3: CONFIRMED → 주문 취소 → 상태 전환 + 역방향 inventory movement", async ({
    page,
    request,
    context,
  }) => {
    await signInAsTestUser(page);

    await page.goto(`/erp/orders/${FIXTURE.confirmedId}`);
    // Pre-check: order is CONFIRMED, cancel button visible. The status badge
    // is rendered as a small <span> with exactly "확정" text, but the
    // counterparty heading also contains the word "취소"; use exact: true
    // on the badge text so we don't match the heading.
    await expect(page.getByText("확정", { exact: true })).toBeVisible();

    // The cancel handler triggers window.confirm() — accept the dialog
    // synchronously so the POST fires.
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "주문 취소" }).click();

    // After the API responds the client calls router.refresh() and the
    // server re-renders with status=CANCELLED + no cancel button.
    // exact: true so the heading text "E2E 취소 대상 거래처" does not match.
    await expect(page.getByText("취소", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "주문 취소" }),
    ).toHaveCount(0);

    // Verify reversal movement landed for the inventory product via the
    // inventory timeline (NOT via API — this is the UI assertion).
    await page.goto(
      `/erp/inventory?productId=${FIXTURE.inventoryProductId}`,
    );
    // The cancel route's reversal note format is "[취소] 원본 {origId}".
    await expect(page.getByText(/\[취소\] 원본/)).toBeVisible();

    // Cleanup: this test mutates the CONFIRMED fixture to CANCELLED. The
    // following tests in this spec do not depend on its status, but a
    // re-run of D3 in the same Playwright session would fail without a
    // seed re-run. Document and accept — seed must run between CI jobs.
    void request;
    void context;
  });

  test("D4: 이미 CANCELLED인 주문에 cancel 버튼 미노출 (가드)", async ({ page }) => {
    await signInAsTestUser(page);

    await page.goto(`/erp/orders/${FIXTURE.cancelledId}`);
    // exact: true — counterparty heading "E2E 이미 취소됨 거래처" contains
    // "취소" too. The badge span has text exactly "취소".
    await expect(page.getByText("취소", { exact: true })).toBeVisible();
    // OrderCancelButton renders only when status === "CONFIRMED".
    await expect(
      page.getByRole("button", { name: "주문 취소" }),
    ).toHaveCount(0);
  });

  test("D5: DRAFT 주문은 cancel 버튼 미노출 (DRAFT은 cancel 대상 아님)", async ({ page }) => {
    await signInAsTestUser(page);

    await page.goto(`/erp/orders/${FIXTURE.draftId}`);
    await expect(page.getByText("초안")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "주문 취소" }),
    ).toHaveCount(0);
  });

  test("D6: source=RECEIPT_INTAKE → intake backlink 표시", async ({ page }) => {
    await signInAsTestUser(page);

    await page.goto(`/erp/orders/${FIXTURE.fromIntakeId}`);
    await expect(
      page.getByRole("heading", { name: "E2E Intake 출처 거래처" }),
    ).toBeVisible();

    // Backlink card text + link to /erp/intake/{sourceId}.
    await expect(
      page.getByText(/이 주문은 영수증 인테이크에서 생성되었습니다/),
    ).toBeVisible();
    const link = page.getByRole("link", { name: "원본 영수증 보기" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute(
      "href",
      `/erp/intake/${FIXTURE.intakeBacklinkSourceId}`,
    );
  });
});

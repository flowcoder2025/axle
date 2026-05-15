import { test, expect } from "@playwright/test";
import { signInAsTestUser } from "./helpers/auth";

/**
 * Phase 20 ERP — Inventory coverage (C1~C5 in project_next_session_e2e).
 *
 * C1: 상품 선택 → 타임라인 + 재고 카드 표시
 * C2: 기간 필터 (from/to) — end-of-day inclusive 확인
 * C3: 유형 필터 (IN/OUT/ADJUST)
 * C4: truncated notice (500건 도달) — skipped at E2E layer (cost), unit-only
 * C5: 상품 없는 경우 안내 (선택 안 했을 때)
 *
 * Fixtures (packages/db/seed-e2e.ts §10, §12):
 *   product-e2e-inventory — name "E2E 재고 추적 상품", unit "개"
 *   5 InventoryMovement rows (seed §12):
 *     invmov-e2e-001: IN  100,  occurredAt 2026-05-01, source INITIAL
 *     invmov-e2e-002: OUT  30,  occurredAt 2026-05-05, source MANUAL
 *     invmov-e2e-003: ADJ   5,  occurredAt 2026-05-08, source MANUAL
 *     invmov-e2e-004: IN   50,  occurredAt 2026-05-10, source MANUAL
 *     invmov-e2e-005: IN   10,  occurredAt 2026-05-12, source ORDER
 *
 * Totals:
 *   in    = 100 + 50 + 10 = 160
 *   out   = 30
 *   adjust= 5
 *   balance = in − out = 130
 *
 * NB: erp-orders.spec.ts D3 mutates this product's movement history by
 * cancelling order-e2e-confirmed (which creates a reversal OUT row). If
 * specs run in a fixed file order the totals here may differ. Playwright
 * defaults to fullyParallel so each spec gets its own worker, but the
 * shared DB makes cross-spec mutation visible. We assert per-row presence
 * (qty + type) instead of aggregate totals — robust to D3 reordering.
 */

const FIXTURE = {
  productId: "product-e2e-inventory",
  productName: "E2E 재고 추적 상품",
} as const;

test.describe("ERP inventory @smoke", () => {
  test("C5: 상품 선택 안 한 초기 상태 — 안내 메시지 노출", async ({ page }) => {
    await signInAsTestUser(page);

    await page.goto("/erp/inventory");
    await expect(
      page.getByRole("heading", { name: "재고 흐름" }),
    ).toBeVisible();
    await expect(
      page.getByText("왼쪽 목록에서 상품을 선택하세요."),
    ).toBeVisible();
    // Picker has the inventory fixture in it.
    await expect(
      page.getByRole("link", { name: new RegExp(FIXTURE.productName) }),
    ).toBeVisible();
  });

  test("C1: 상품 선택 → 타임라인 + 재고 카드 표시", async ({ page }) => {
    await signInAsTestUser(page);

    await page.goto(`/erp/inventory?productId=${FIXTURE.productId}`);
    // Right pane header = product name.
    await expect(
      page.getByRole("heading", { name: FIXTURE.productName }),
    ).toBeVisible();

    // Cards exist (we don't assert exact totals — see header note).
    await expect(page.getByText("현재 재고")).toBeVisible();
    await expect(page.getByText("입고 합계")).toBeVisible();
    await expect(page.getByText("출고 합계")).toBeVisible();
    await expect(page.getByText("조정 합계")).toBeVisible();

    // Timeline rows — assert presence of seed rows via their unique notes.
    await expect(page.getByText("초기 입고 (E2E)")).toBeVisible();
    await expect(page.getByText("수기 출고 (E2E)")).toBeVisible();
    await expect(page.getByText("재고 조정 (E2E)")).toBeVisible();
  });

  test("C2: 기간 필터 — 2026-05-08 ~ 2026-05-10 사이만 노출", async ({ page }) => {
    await signInAsTestUser(page);

    await page.goto(
      `/erp/inventory?productId=${FIXTURE.productId}&from=2026-05-08&to=2026-05-10`,
    );

    // Within range: ADJUST on 2026-05-08, IN on 2026-05-10 (end-of-day inclusive).
    await expect(page.getByText("재고 조정 (E2E)")).toBeVisible();
    await expect(page.getByText("추가 입고 (E2E)")).toBeVisible();

    // Outside range: initial IN on 2026-05-01, OUT on 2026-05-05 — must drop.
    await expect(page.getByText("초기 입고 (E2E)")).toHaveCount(0);
    await expect(page.getByText("수기 출고 (E2E)")).toHaveCount(0);
  });

  test("C3: 유형 필터 OUT — OUT 행만 노출", async ({ page }) => {
    await signInAsTestUser(page);

    await page.goto(
      `/erp/inventory?productId=${FIXTURE.productId}&type=OUT`,
    );

    // Only OUT row from seed has note "수기 출고 (E2E)".
    await expect(page.getByText("수기 출고 (E2E)")).toBeVisible();
    // IN / ADJUST notes must drop.
    await expect(page.getByText("초기 입고 (E2E)")).toHaveCount(0);
    await expect(page.getByText("재고 조정 (E2E)")).toHaveCount(0);
  });

  // C4 (500건 truncation) — intentionally skipped at the E2E layer. Producing
  // 500 InventoryMovement rows on every CI seed run would slow other ERP
  // specs and bloat the shared org-e2e-1 tenant. The truncation contract +
  // INVENTORY_MOVEMENT_LIMIT is locked down at the lib/erp/inventory.ts unit
  // test level (apps/web/__tests__/lib/erp/inventory.test.ts).
  test.skip("C4: 500건 도달 시 truncation notice (unit-level only)", async () => {});
});

import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { signInAsTestUser } from "./helpers/auth";

/**
 * Phase 20 ERP — Product CRUD coverage (B1~B6 in project_next_session_e2e).
 *
 * UI-first: all CRUD actions exercise real browser interactions through
 * /erp/products pages. The one exception is the archive flow (B3): the
 * current UI exposes the `보관됨 포함` filter but no per-row archive
 * button, so the spec uses the canonical DELETE endpoint to flip
 * `archived` and then verifies the list-page filter responds correctly.
 * That hybrid is documented inline.
 *
 * Fixtures (packages/db/seed-e2e.ts §10):
 *   product-e2e-edit       — name "E2E 편집용 상품",  sku "E2E-EDIT-001"
 *   product-e2e-collision  — sku "E2E-DUPE-CANARY" reserved for B4
 *   product-e2e-archive    — name "E2E 보관 테스트 상품", reset to archived=false
 *                            on every seed run so B3 is repeatable
 *   product-e2e-inventory  — used by orders/inventory specs, present here too
 */

const FIXTURE = {
  editId: "product-e2e-edit",
  archiveId: "product-e2e-archive",
  collisionSku: "E2E-DUPE-CANARY",
} as const;

/** Restore a product's `archived` flag via the canonical PATCH route. Used
 * by B3 cleanup so subsequent test runs (and other specs that look up the
 * fixture by id) see it unarchived. */
async function setArchived(
  request: APIRequestContext,
  ctx: BrowserContext,
  productId: string,
  archived: boolean,
): Promise<void> {
  const cookies = await ctx.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const res = await request.patch(`/api/erp/products/${productId}`, {
    data: { archived },
    headers: { "Content-Type": "application/json", Cookie: cookieHeader },
  });
  if (!res.ok()) {
    throw new Error(
      `setArchived(${productId}, ${archived}) failed: ${res.status()} ${await res.text()}`,
    );
  }
}

test.describe("ERP product CRUD @smoke", () => {
  test("B1: 신규 등록 → 상세 페이지로 이동 + 목록에 표시", async ({ page }) => {
    await signInAsTestUser(page);

    // Stable but unique sku — repeated runs of this test must not collide
    // with each other (sku is unique per org). The collision case is B4.
    const stamp = Date.now();
    const name = `E2E-신규상품-${stamp}`;
    const sku = `E2E-NEW-${stamp}`;

    await page.goto("/erp/products/new");
    await expect(
      page.getByRole("heading", { name: "상품 추가" }),
    ).toBeVisible();

    await page.getByLabel(/이름/).fill(name);
    await page.getByLabel("SKU").fill(sku);
    await page.getByLabel(/단위/).fill("개");
    // unitPrice is type=number; .fill() clears + types the digits.
    await page.getByLabel(/단가/).fill("7500");
    await page.getByLabel("카테고리").fill("E2E");

    await page.getByRole("button", { name: "등록" }).click();

    // Created products redirect to /erp/products/{id}. The picker excludes
    // /new and /edit so the suffix is the real cuid.
    await page.waitForURL(/\/erp\/products\/(?!new$)[a-z0-9]+$/i, {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name }),
    ).toBeVisible();
    await expect(page.getByText(sku).first()).toBeVisible();

    // List shows the new row (sku is stable enough to dedupe historic rows).
    await page.goto("/erp/products");
    await expect(page.getByText(sku).first()).toBeVisible();
  });

  test("B2: 편집 → 단가 변경이 상세 페이지에 반영", async ({ page }) => {
    await signInAsTestUser(page);

    const newPrice = String(5_000 + (Date.now() % 1000)); // 5xxx, drifts each run

    await page.goto(`/erp/products/${FIXTURE.editId}/edit`);
    await expect(
      page.getByRole("heading", { name: "상품 편집" }),
    ).toBeVisible();
    // Form is pre-filled — confirm the seed name renders before editing.
    await expect(page.getByLabel(/이름/)).toHaveValue("E2E 편집용 상품");

    await page.getByLabel(/단가/).fill(newPrice);
    await page.getByRole("button", { name: "저장" }).click();

    await page.waitForURL(
      new RegExp(`/erp/products/${FIXTURE.editId}$`),
      { timeout: 15_000 },
    );
    // Detail dl renders the unitPrice in the "단가 (KRW)" cell.
    await expect(page.getByText(newPrice).first()).toBeVisible();
  });

  test("B3: archive flip → 목록에서 사라짐 + 보관됨 포함 토글 시 보임", async ({
    page,
    request,
    context,
  }) => {
    await signInAsTestUser(page);

    // Hybrid setup: no per-row UI button for archive exists yet. Call the
    // canonical DELETE route to flip `archived: true`, then drive the rest
    // of the assertion through the UI filter form.
    try {
      const cookies = await context.cookies();
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
      const res = await request.delete(`/api/erp/products/${FIXTURE.archiveId}`, {
        headers: { Cookie: cookieHeader },
      });
      expect(res.status(), `DELETE response body: ${await res.text()}`).toBe(200);

      // Default list (archived=false) — the row must be hidden.
      await page.goto("/erp/products");
      await expect(page.getByText("E2E 보관 테스트 상품")).toHaveCount(0);

      // Toggle the `보관됨 포함` checkbox + submit → the row reappears
      // with the 보관됨 badge. The global app shell mounts a "검색 ⌘K"
      // command-palette button so we must use exact: true to target only
      // the list-form's submit button labeled "검색".
      await page.getByLabel(/보관됨 포함/).check();
      await page.getByRole("button", { name: "검색", exact: true }).click();
      await page.waitForURL(/includeArchived=1/);

      const row = page.locator("tr", { hasText: "E2E 보관 테스트 상품" });
      await expect(row).toHaveCount(1);
      await expect(row.getByText("보관됨")).toBeVisible();
    } finally {
      // Restore so subsequent test runs (and parallel specs that look up
      // the fixture by id) see it unarchived. Seed also resets this on
      // every db push, but in-session repeatability matters too.
      await setArchived(request, context, FIXTURE.archiveId, false);
    }
  });

  test("B4: 중복 SKU 등록 시 409 inline 에러", async ({ page }) => {
    await signInAsTestUser(page);

    const name = `E2E-중복-시도-${Date.now()}`;

    await page.goto("/erp/products/new");
    await page.getByLabel(/이름/).fill(name);
    await page.getByLabel("SKU").fill(FIXTURE.collisionSku);
    await page.getByLabel(/단위/).fill("개");
    await page.getByLabel(/단가/).fill("1000");

    await page.getByRole("button", { name: "등록" }).click();

    // The form's #product-form-error <p> surfaces the API envelope's
    // `error.message`. For P2002 the route returns
    // "Duplicate value for orgId, sku".
    const errorEl = page.locator("#product-form-error");
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toContainText(/Duplicate|중복|이미/i);
    // We must stay on /new — no row was created.
    await expect(page).toHaveURL(/\/erp\/products\/new$/);
  });

  test("B5: 이름 검색 q 파라미터로 목록이 필터됨", async ({ page }) => {
    await signInAsTestUser(page);

    await page.goto("/erp/products?q=편집");
    // The edit-fixture row is the only seed product matching "편집".
    await expect(page.getByText("E2E 편집용 상품")).toBeVisible();
    // And a row that should NOT match — collision fixture name is "E2E SKU 중복 대상".
    await expect(page.getByText("E2E SKU 중복 대상")).toHaveCount(0);
  });

  // B6 (200건 truncation 표시) is intentionally skipped at the E2E layer.
  // Producing 200+ products on org-e2e-1 for every CI run would slow the
  // seed step and leave persistent noise across other ERP specs. The
  // truncation notice + PRODUCT_LIST_LIMIT contract is locked down by
  // apps/web/__tests__/api/erp/products-list.test.ts at the route level.
  test.skip("B6: 200건 도달 시 truncation 알림 (unit-level only)", async () => {});
});

import { test, expect } from "@playwright/test";
import { hasTestCreds, signInAsTestUser, uniqueClientName } from "./helpers/auth";

test.describe("client CRUD (authenticated) @smoke", () => {
  test.skip(!hasTestCreds, "Set E2E_USER_EMAIL + E2E_USER_PASSWORD to run");

  test("create → verify in list → edit → delete", async ({ page }) => {
    await signInAsTestUser(page);

    const name = uniqueClientName();
    const updatedName = `${name}-UPDATED`;

    // --- CREATE ---
    await page.goto("/clients/new");
    await expect(page.getByRole("heading", { name: /고객사 추가/ })).toBeVisible();
    await page.getByLabel(/고객사명/).fill(name);
    await page.getByRole("button", { name: /고객사 추가|추가|저장|등록|생성/ }).click();

    // Wait for redirect to detail page — exclude /clients/new itself, which would
    // otherwise match `[^/]+$` and make clientId="new".
    await page.waitForURL(/\/clients\/(?!new$)[a-z0-9]+$/i, { timeout: 10_000 });
    const clientId = page.url().split("/").pop()!;
    expect(clientId).not.toBe("new");
    await expect(page.getByText(name).first()).toBeVisible();

    // --- LIST verify ---
    await page.goto("/clients");
    await expect(page.getByText(name).first()).toBeVisible();

    // --- EDIT ---
    await page.goto(`/clients/${clientId}/edit`);
    await expect(page.getByRole("heading", { name: /고객사 수정/ })).toBeVisible();
    await page.getByLabel(/고객사명/).fill(updatedName);
    await page.getByRole("button", { name: /변경 저장|저장|수정|업데이트/ }).click();
    await page.waitForURL(new RegExp(`/clients/${clientId}$`), { timeout: 10_000 });
    await expect(page.getByText(updatedName).first()).toBeVisible();

    // --- DELETE ---
    // The delete action lives on the /clients list row dropdown (detail page
    // has no delete button). Open the row's menu, click 삭제, accept the
    // native confirm dialog, then verify the row is gone.
    await page.goto("/clients");
    const row = page.locator("tr", { hasText: updatedName }).first();
    await row.getByRole("button", { name: /메뉴 열기/ }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("menuitem", { name: /^삭제$/ }).click();
    await expect(page.getByText(updatedName)).toHaveCount(0);
  });
});

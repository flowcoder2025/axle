import { test, expect } from "@playwright/test";
import { hasTestCreds, signInAsTestUser, uniqueClientName } from "./helpers/auth";

test.describe("client CRUD (authenticated)", () => {
  test.skip(!hasTestCreds, "Set E2E_USER_EMAIL + E2E_USER_PASSWORD to run");

  test("create → verify in list → edit → delete", async ({ page }) => {
    await signInAsTestUser(page);

    const name = uniqueClientName();
    const updatedName = `${name}-UPDATED`;

    // --- CREATE ---
    await page.goto("/clients/new");
    await expect(page.getByRole("heading", { name: /고객사 추가/ })).toBeVisible();
    await page.getByLabel(/고객사명/).fill(name);
    await page.getByRole("button", { name: /저장|생성|등록/ }).click();

    // Expect landing on list or detail page with the new name
    await page.waitForURL(/\/clients(\/|$)/, { timeout: 10_000 });
    await expect(page.getByText(name).first()).toBeVisible();

    // --- LIST verify ---
    await page.goto("/clients");
    await expect(page.getByText(name).first()).toBeVisible();

    // --- EDIT ---
    await page.getByText(name).first().click();
    await page.waitForURL(/\/clients\/[a-z0-9]+/i);
    await page.getByRole("link", { name: /편집|수정|edit/i }).first().click();
    await page.waitForURL(/\/clients\/[a-z0-9]+\/edit/i);
    const nameInput = page.getByLabel(/고객사명/);
    await nameInput.fill(updatedName);
    await page.getByRole("button", { name: /저장|수정|업데이트/ }).click();
    await page.waitForURL(/\/clients\/[a-z0-9]+$/i, { timeout: 10_000 });
    await expect(page.getByText(updatedName).first()).toBeVisible();

    // --- DELETE ---
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: /삭제|delete/i })
      .first()
      .click();
    await page.waitForURL(/\/clients$/i, { timeout: 10_000 });
    await expect(page.getByText(updatedName)).toHaveCount(0);
  });
});

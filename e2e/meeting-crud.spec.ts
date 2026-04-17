import { test, expect } from "@playwright/test";
import { hasTestCreds, signInAsTestUser } from "./helpers/auth";

function uniqueMeetingTitle(prefix = "E2E-Meeting"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function todayDateInput(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

test.describe("meeting CRUD (authenticated)", () => {
  test.skip(!hasTestCreds, "Set E2E_USER_EMAIL + E2E_USER_PASSWORD to run");

  test("create meeting → verify in list → delete", async ({ page }) => {
    await signInAsTestUser(page);

    await page.goto("/meetings/new");
    await expect(page.getByRole("heading", { name: /미팅 추가/ })).toBeVisible();

    // Select first available client
    const clientSelect = page.getByLabel(/고객사/);
    await clientSelect.waitFor({ state: "visible" });
    const clientOptions = await clientSelect.locator("option").all();
    let chosenClient = "";
    for (const opt of clientOptions) {
      const value = await opt.getAttribute("value");
      if (value) {
        chosenClient = value;
        break;
      }
    }
    test.skip(!chosenClient, "No client available; seed a client before running");
    await clientSelect.selectOption(chosenClient);

    const title = uniqueMeetingTitle();
    await page.getByLabel(/^제목/).fill(title);
    await page.getByLabel(/^날짜/).fill(todayDateInput());

    await page.getByRole("button", { name: /저장|생성|등록/ }).click();

    // Landed on list or detail
    await page.waitForURL(/\/meetings(\/|$)/, { timeout: 10_000 });
    await expect(page.getByText(title).first()).toBeVisible();

    // --- LIST verify ---
    await page.goto("/meetings");
    await expect(page.getByText(title).first()).toBeVisible();

    // --- DELETE ---
    await page.getByText(title).first().click();
    await page.waitForURL(/\/meetings\/[a-z0-9]+/i);
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: /삭제|delete/i })
      .first()
      .click();
    await page.waitForURL(/\/meetings$/i, { timeout: 10_000 });
    await expect(page.getByText(title)).toHaveCount(0);
  });
});

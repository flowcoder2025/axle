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

test.describe("meeting CRUD (authenticated) @smoke", () => {
  test.skip(!hasTestCreds, "Set E2E_USER_EMAIL + E2E_USER_PASSWORD to run");

  // No DELETE step: meeting-table has no delete UI. The API-level delete is
  // covered by route-handler tests; @smoke focuses on the UI happy path.
  test("create meeting → verify in list → edit", async ({ page }) => {
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

    // The form also contains a "참석자 추가" button, so match the submit
    // button exactly instead of a permissive regex.
    await page.getByRole("button", { name: "미팅 생성" }).click();

    // Wait for redirect to detail page — exclude /meetings/new itself.
    await page.waitForURL(/\/meetings\/(?!new$)[a-z0-9]+$/i, { timeout: 10_000 });
    const meetingId = page.url().split("/").pop()!;
    expect(meetingId).not.toBe("new");
    await expect(page.getByText(title).first()).toBeVisible();

    // --- LIST verify ---
    await page.goto("/meetings");
    await expect(page.getByText(title).first()).toBeVisible();

    // --- EDIT ---
    const updatedTitle = `${title}-UPDATED`;
    await page.goto(`/meetings/${meetingId}/edit`);
    await page.getByLabel(/^제목/).fill(updatedTitle);
    // The edit form also contains "참석자 추가"; match the submit button exactly.
    await page.getByRole("button", { name: "변경 저장" }).click();
    await page.waitForURL(new RegExp(`/meetings/${meetingId}$`), { timeout: 10_000 });
    await expect(page.getByText(updatedTitle).first()).toBeVisible();
  });
});

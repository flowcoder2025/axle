import { test, expect } from "@playwright/test";
import { hasTestCreds, signInAsTestUser } from "./helpers/auth";

function uniqueProjectTitle(prefix = "E2E-Project"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

test.describe("project CRUD (authenticated) @smoke", () => {
  test.skip(!hasTestCreds, "Set E2E_USER_EMAIL + E2E_USER_PASSWORD to run");

  // No DELETE step: project-table has no delete UI (neither row-level menu nor
  // a detail-page button). The @write spec exercises DELETE via the API.
  test("create project → verify in list → edit", async ({ page }) => {
    await signInAsTestUser(page);

    await page.goto("/projects/new");
    await expect(page.getByRole("heading", { name: /프로젝트 추가/ })).toBeVisible();

    // Select first available client (DOM order; skip placeholder option)
    const clientSelect = page.getByLabel(/고객사/);
    await clientSelect.waitFor({ state: "visible" });
    const clientOptions = await clientSelect.locator("option").all();
    let chosenClientValue = "";
    for (const opt of clientOptions) {
      const value = await opt.getAttribute("value");
      if (value) {
        chosenClientValue = value;
        break;
      }
    }
    test.skip(!chosenClientValue, "No client available; seed a client before running");
    await clientSelect.selectOption(chosenClientValue);

    const title = uniqueProjectTitle();
    const updatedTitle = `${title}-UPDATED`;
    await page.getByLabel(/프로젝트명/).fill(title);

    await page.getByRole("button", { name: /프로젝트 추가|추가|저장|등록|생성/ }).click();

    // Wait for redirect to detail page — exclude /projects/new itself.
    await page.waitForURL(/\/projects\/(?!new$)[a-z0-9]+$/i, { timeout: 10_000 });
    const projectId = page.url().split("/").pop()!;
    expect(projectId).not.toBe("new");
    await expect(page.getByText(title).first()).toBeVisible();

    // --- LIST verify ---
    await page.goto("/projects");
    await expect(page.getByText(title).first()).toBeVisible();

    // --- EDIT ---
    await page.goto(`/projects/${projectId}/edit`);
    await page.getByLabel(/프로젝트명/).fill(updatedTitle);
    await page.getByRole("button", { name: /변경 저장|저장|수정|업데이트/ }).click();
    await page.waitForURL(new RegExp(`/projects/${projectId}$`), { timeout: 10_000 });
    await expect(page.getByText(updatedTitle).first()).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";
import { hasTestCreds, signInAsTestUser } from "./helpers/auth";

function uniqueDocName(prefix = "e2e-doc"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

test.describe("document CRUD (authenticated) @smoke", () => {
  test.skip(!hasTestCreds, "Set E2E_USER_EMAIL + E2E_USER_PASSWORD to run");

  // No DELETE/EDIT step: DocumentTable has no row-level edit/delete UI.
  // DELETE is covered in e2e/role-write-actions.spec.ts via the API layer.
  test("upload document → verify in list → filter by category (positive + negative)", async ({ page }) => {
    await signInAsTestUser(page);

    await page.goto("/documents");
    await expect(page.getByRole("heading", { name: /서류 관리/ })).toBeVisible();

    // --- UPLOAD ---
    await page.getByRole("button", { name: /서류 업로드/ }).click();
    // Dialog title is also "서류 업로드" — scope to the dialog role to avoid
    // matching the trigger button's accessible name.
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: /서류 업로드/ })).toBeVisible();

    // Pick the first real client option (placeholder-less select; the first
    // option IS a valid client as long as the org has >=1 client seeded).
    const clientSelect = dialog.locator("#upload-client");
    await clientSelect.waitFor({ state: "visible" });
    const firstClientValue = await clientSelect
      .locator("option")
      .first()
      .getAttribute("value");
    test.skip(!firstClientValue, "No client available; seed a client before running");
    await clientSelect.selectOption(firstClientValue!);

    // Category: INPUT (Korean label "입력"). Set via value, not label, since
    // <option value="INPUT">입력</option>.
    await dialog.locator("#upload-category").selectOption("INPUT");

    // Inject a tiny text/plain buffer into the hidden file input. text/plain
    // is in DOCUMENTS bucket's allowedMimeTypes (packages/storage/src/upload.ts).
    const fileName = `${uniqueDocName()}.txt`;
    await dialog.locator('input[type="file"]').setInputFiles({
      name: fileName,
      mimeType: "text/plain",
      buffer: Buffer.from("e2e upload"),
    });

    // Submit and wait for the POST to resolve with 201 before asserting list state.
    const uploadPromise = page.waitForResponse(
      (res) => res.url().endsWith("/api/documents") && res.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: /^업로드$/ }).click();
    const uploadRes = await uploadPromise;
    expect(uploadRes.status()).toBe(201);

    // Dialog closes on success, then the page refreshes to show the new row.
    await expect(dialog).toBeHidden();
    await expect(page.getByText(fileName).first()).toBeVisible();

    // --- FILTER positive: category=INPUT should keep the row visible ---
    const categorySelect = page
      .locator("select")
      .filter({ hasText: "전체 분류" })
      .filter({ hasText: "입력" });
    await categorySelect.selectOption("INPUT");
    await page.waitForURL(/[?&]category=INPUT(?:&|$)/, { timeout: 5_000 });
    await expect(page.getByText(fileName).first()).toBeVisible();

    // --- FILTER negative: category=OUTPUT should hide our INPUT row ---
    await categorySelect.selectOption("OUTPUT");
    await page.waitForURL(/[?&]category=OUTPUT(?:&|$)/, { timeout: 5_000 });
    // Our uploaded doc was INPUT, so its unique filename must not appear.
    await expect(page.getByText(fileName)).toHaveCount(0);
  });

  test("list filter: ?category=TEMPLATE reflects in filter select", async ({ page }) => {
    await signInAsTestUser(page);

    await page.goto("/documents?category=TEMPLATE");
    await expect(page.getByRole("heading", { name: /서류 관리/ })).toBeVisible();

    // Identify the category <select> by its placeholder + a Korean label that
    // appears exclusively inside it (the OCR filter has "전체 OCR" but no "템플릿").
    const categorySelect = page
      .locator("select")
      .filter({ hasText: "전체 분류" })
      .filter({ hasText: "템플릿" });
    await expect(categorySelect).toHaveValue("TEMPLATE");
  });
});

// e2e/cross-org-isolation.spec.ts
// Next.js App Router's notFound() renders not-found UI with HTTP 200.
// Verification: the page shows "찾을 수 없습니다" heading and no entity-specific
// affordances (like edit/delete buttons that would only render for valid clients).
import { test, expect } from "@playwright/test";
import { storageStatePath, E2E_IDS } from "./helpers/roles";

async function expectBlocked(page: import("@playwright/test").Page) {
  // Wait for navigation to settle so we inspect the final rendered state.
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  // The canonical not-found copy in AXLE's Korean UI.
  await expect(page.getByText(/찾을 수 없습니다|Not Found/i).first()).toBeVisible({ timeout: 10_000 });
  // No detail affordances (edit link/button) should render for a blocked resource.
  await expect(page.getByRole("link", { name: /^편집$|^수정$|^Edit$/i })).toHaveCount(0);
}

test.describe("cross-org isolation @boundary", () => {
  test.describe("as org1-owner", () => {
    test.use({ storageState: storageStatePath("org1-owner") });

    test("cannot access org2 client via direct URL", async ({ page }) => {
      await page.goto(`/clients/${E2E_IDS.clients.org2}`);
      await expectBlocked(page);
    });

    test("cannot access org2 project via direct URL", async ({ page }) => {
      await page.goto(`/projects/${E2E_IDS.projects.org2}`);
      await expectBlocked(page);
    });

    test("org2 client is not visible in /clients list", async ({ page }) => {
      await page.goto("/clients");
      await expect(page.getByRole("link", { name: /E2E Client B/ })).toHaveCount(0);
    });
  });

  test.describe("as org2-owner", () => {
    test.use({ storageState: storageStatePath("org2-owner") });

    test("cannot access org1 client via direct URL", async ({ page }) => {
      await page.goto(`/clients/${E2E_IDS.clients.org1}`);
      await expectBlocked(page);
    });

    test("cannot access org1 project via direct URL", async ({ page }) => {
      await page.goto(`/projects/${E2E_IDS.projects.memberShared}`);
      await expectBlocked(page);
    });
  });
});

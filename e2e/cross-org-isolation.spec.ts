// e2e/cross-org-isolation.spec.ts
// Next.js App Router's notFound() renders not-found UI with HTTP 200.
// Note: `not-found.tsx` is bundled into every page's error-boundary fallback,
// so its text appears in the raw HTML even for successful pages — but only
// the `<h1>404</h1>` landmark is VISIBLE when notFound() actually fires.
import { test, expect } from "@playwright/test";
import { storageStatePath, E2E_IDS } from "./helpers/roles";

async function expectBlocked(page: import("@playwright/test").Page) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  // The visible landmark of the not-found page is <h1>404</h1>.
  await expect(page.getByRole("heading", { name: "404", level: 1 })).toBeVisible({ timeout: 10_000 });
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

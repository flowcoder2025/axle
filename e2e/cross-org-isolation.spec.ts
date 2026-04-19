// e2e/cross-org-isolation.spec.ts
import { test, expect } from "@playwright/test";
import { storageStatePath, E2E_IDS } from "./helpers/roles";

/**
 * Next.js App Router's notFound() renders the not-found boundary with HTTP 200.
 * We verify blocking by checking for the not-found UI text and absence of entity data,
 * not by HTTP status code.
 */
async function expectNotFoundPage(page: import("@playwright/test").Page, entityName: string) {
  // Either the not-found text appears, or the entity content is absent.
  // The page header "찾을 수 없습니다" is the canonical not-found UI marker.
  const notFoundMarker = page.getByText(/찾을 수 없습니다|Not Found/i);
  await expect(notFoundMarker).toBeVisible({ timeout: 10_000 });
  // Entity-specific content (like edit buttons or status badges) must NOT be present.
  await expect(page.getByRole("link", { name: /편집|수정|Edit/i })).toHaveCount(0);
}

test.describe("cross-org isolation @boundary", () => {
  test.describe("as org1-owner", () => {
    test.use({ storageState: storageStatePath("org1-owner") });

    test("cannot access org2 client via direct URL", async ({ page }) => {
      await page.goto(`/clients/${E2E_IDS.clients.org2}`);
      await expectNotFoundPage(page, "E2E Client B");
    });

    test("cannot access org2 project via direct URL", async ({ page }) => {
      await page.goto(`/projects/${E2E_IDS.projects.org2}`);
      await expectNotFoundPage(page, "E2E Project — org2");
    });

    test("org2 client is not visible in /clients list", async ({ page }) => {
      await page.goto("/clients");
      // E2E Client B should NOT appear for org1-owner in the list
      await expect(page.getByRole("link", { name: /E2E Client B/ })).toHaveCount(0);
    });
  });

  test.describe("as org2-owner", () => {
    test.use({ storageState: storageStatePath("org2-owner") });

    test("cannot access org1 client via direct URL", async ({ page }) => {
      await page.goto(`/clients/${E2E_IDS.clients.org1}`);
      await expectNotFoundPage(page, "E2E Client A");
    });

    test("cannot access org1 project via direct URL", async ({ page }) => {
      await page.goto(`/projects/${E2E_IDS.projects.memberShared}`);
      await expectNotFoundPage(page, "E2E Project — member shared");
    });
  });
});

// e2e/cross-org-isolation.spec.ts
import { test, expect } from "@playwright/test";
import { storageStatePath, E2E_IDS } from "./helpers/roles";

test.describe("cross-org isolation @boundary", () => {
  test.describe("as org1-owner", () => {
    test.use({ storageState: storageStatePath("org1-owner") });

    test("cannot access org2 client via direct URL", async ({ page }) => {
      const res = await page.goto(`/clients/${E2E_IDS.clients.org2}`);
      // Either 403 Forbidden or 404 Not Found
      const status = res?.status() ?? 0;
      expect([403, 404]).toContain(status);
    });

    test("cannot access org2 project via direct URL", async ({ page }) => {
      const res = await page.goto(`/projects/${E2E_IDS.projects.org2}`);
      const status = res?.status() ?? 0;
      expect([403, 404]).toContain(status);
    });

    test("org2 client is not visible in /clients list", async ({ page }) => {
      await page.goto("/clients");
      // E2E Client B should NOT appear for org1-owner
      await expect(page.getByText(/E2E Client B/)).toHaveCount(0);
    });
  });

  test.describe("as org2-owner", () => {
    test.use({ storageState: storageStatePath("org2-owner") });

    test("cannot access org1 client via direct URL", async ({ page }) => {
      const res = await page.goto(`/clients/${E2E_IDS.clients.org1}`);
      const status = res?.status() ?? 0;
      expect([403, 404]).toContain(status);
    });

    test("cannot access org1 project via direct URL", async ({ page }) => {
      const res = await page.goto(`/projects/${E2E_IDS.projects.memberShared}`);
      const status = res?.status() ?? 0;
      expect([403, 404]).toContain(status);
    });
  });
});

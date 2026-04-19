// e2e/role-boundary.spec.ts
import { test, expect } from "@playwright/test";
import { storageStatePath } from "./helpers/roles";

test.describe("role boundary: platform admin routes @boundary", () => {
  test.describe("as platform", () => {
    test.use({ storageState: storageStatePath("platform") });

    test("can render /platform-admin/users", async ({ page }) => {
      await page.goto("/platform-admin/users");
      await expect(page).toHaveURL(/\/platform-admin\/users/);
      // Users table should be rendered (at least one row or the empty-state text).
      await expect(page.getByRole("heading", { name: /사용자|Users/i })).toBeVisible();
    });

    test("can render /platform-admin/organizations", async ({ page }) => {
      await page.goto("/platform-admin/organizations");
      await expect(page).toHaveURL(/\/platform-admin\/organizations/);
      await expect(page.getByRole("heading", { name: /조직|Organizations/i })).toBeVisible();
    });
  });

  test.describe("as org1-owner", () => {
    test.use({ storageState: storageStatePath("org1-owner") });

    test("is redirected away from /platform-admin", async ({ page }) => {
      await page.goto("/platform-admin");
      // Middleware.authorized() returns a redirect Response for non-PLATFORM_ADMIN users.
      // Accept any URL that is NOT /platform-admin (home, dashboard, clients, login all OK).
      await page.waitForURL((url) => !url.pathname.startsWith("/platform-admin"), { timeout: 10_000 });
      expect(page.url()).not.toMatch(/\/platform-admin/);
    });

    test("GET /api/admin/users returns 403", async ({ request }) => {
      const res = await request.get("/api/admin/users");
      expect(res.status()).toBe(403);
    });

    test("GET /api/admin/stats returns 403", async ({ request }) => {
      const res = await request.get("/api/admin/stats");
      expect(res.status()).toBe(403);
    });
  });

  test.describe("as org1-member", () => {
    test.use({ storageState: storageStatePath("org1-member") });

    test("is redirected away from /platform-admin", async ({ page }) => {
      await page.goto("/platform-admin");
      // Middleware.authorized() returns a redirect Response for non-PLATFORM_ADMIN users.
      // Accept any URL that is NOT /platform-admin (home, dashboard, clients, login all OK).
      await page.waitForURL((url) => !url.pathname.startsWith("/platform-admin"), { timeout: 10_000 });
      expect(page.url()).not.toMatch(/\/platform-admin/);
    });

    test("GET /api/admin/organizations returns 403", async ({ request }) => {
      const res = await request.get("/api/admin/organizations");
      expect(res.status()).toBe(403);
    });
  });

  test.describe("unauthenticated", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("is redirected to /login from /platform-admin", async ({ page }) => {
      await page.goto("/platform-admin");
      await page.waitForURL(/\/login/, { timeout: 10_000 });
      expect(page.url()).toMatch(/\/login/);
    });
  });
});

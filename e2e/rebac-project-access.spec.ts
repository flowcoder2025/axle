// e2e/rebac-project-access.spec.ts
// Note: AXLE currently implements org-level access control at the VIEW layer
// (projects in the same org are visible to all org members). Per-project
// ReBAC is enforced at mutating API endpoints (PATCH/DELETE), which is what
// we test here. View-layer ReBAC is out of scope until the app implements it.
import { test, expect } from "@playwright/test";
import { storageStatePath, E2E_IDS } from "./helpers/roles";

test.describe("ReBAC project access @boundary", () => {
  test.describe("as org1-member", () => {
    test.use({ storageState: storageStatePath("org1-member") });

    test("can view shared project detail (MEMBER role)", async ({ page }) => {
      await page.goto(`/projects/${E2E_IDS.projects.memberShared}`);
      // Project title appears in multiple DOM nodes; assert the H1 landmark specifically.
      await expect(page.getByRole("heading", { name: /E2E Project — member shared/, level: 1 })).toBeVisible({ timeout: 10_000 });
    });

    test("PATCH on owner-only project is blocked", async ({ request }) => {
      const res = await request.patch(`/api/projects/${E2E_IDS.projects.ownerOnly}`, {
        data: { title: "hacked" },
        maxRedirects: 0,
      });
      // Either node-level 403 (ReBAC check) or middleware redirect for protected API
      expect([302, 307, 308, 403, 404]).toContain(res.status());
    });
  });

  test.describe("as org1-owner", () => {
    test.use({ storageState: storageStatePath("org1-owner") });

    test("can view shared project and see edit affordances", async ({ page }) => {
      await page.goto(`/projects/${E2E_IDS.projects.memberShared}`);
      // Project title appears in multiple DOM nodes; assert the H1 landmark specifically.
      await expect(page.getByRole("heading", { name: /E2E Project — member shared/, level: 1 })).toBeVisible({ timeout: 10_000 });
      const editBtn = page.getByRole("link", { name: /편집|수정|Edit/i }).or(
        page.getByRole("button", { name: /편집|수정|Edit/i }),
      );
      await expect(editBtn.first()).toBeVisible();
    });
  });
});

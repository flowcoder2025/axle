// e2e/rebac-project-access.spec.ts
import { test, expect } from "@playwright/test";
import { storageStatePath, E2E_IDS } from "./helpers/roles";

test.describe("ReBAC project access @boundary", () => {
  test.describe("as org1-member", () => {
    test.use({ storageState: storageStatePath("org1-member") });

    test("can view shared project detail (MEMBER role)", async ({ page }) => {
      const res = await page.goto(`/projects/${E2E_IDS.projects.memberShared}`);
      expect(res?.status()).toBe(200);
      // Project title should render
      await expect(page.getByText(/E2E Project — member shared/)).toBeVisible();
    });

    test("cannot view owner-only project (not a project member)", async ({ page }) => {
      const res = await page.goto(`/projects/${E2E_IDS.projects.ownerOnly}`);
      const status = res?.status() ?? 0;
      expect([403, 404]).toContain(status);
    });

    test("PATCH on owner-only project returns 403", async ({ request }) => {
      const res = await request.patch(`/api/projects/${E2E_IDS.projects.ownerOnly}`, {
        data: { title: "hacked" },
      });
      expect([403, 404]).toContain(res.status());
    });
  });

  test.describe("as org1-owner", () => {
    test.use({ storageState: storageStatePath("org1-owner") });

    test("can view shared project and see edit affordances", async ({ page }) => {
      const res = await page.goto(`/projects/${E2E_IDS.projects.memberShared}`);
      expect(res?.status()).toBe(200);
      // Edit button should be visible for LEAD
      const editBtn = page.getByRole("link", { name: /수정|Edit/i }).or(
        page.getByRole("button", { name: /수정|Edit/i }),
      );
      await expect(editBtn.first()).toBeVisible();
    });
  });
});

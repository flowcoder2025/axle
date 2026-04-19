// e2e/role-write-actions.spec.ts
// Validates that platform/admin/employee write actions enforce their
// authorization boundaries AND that the owner CRUD happy path works end-to-end.
// These tests mutate DB state, so they only run against an ephemeral Postgres
// in CI (e2e-write.yml) — never against prod.
import { test, expect } from "@playwright/test";
import { storageStatePath, E2E_IDS } from "./helpers/roles";

test.describe("role write actions @write", () => {
  test.describe("as org1-member", () => {
    test.use({ storageState: storageStatePath("org1-member") });

    test("DELETE on owner-only project is blocked", async ({ request }) => {
      const res = await request.delete(
        `/api/projects/${E2E_IDS.projects.ownerOnly}`,
      );
      expect([403, 404]).toContain(res.status());
    });

    test("PATCH /api/admin/organizations/[orgId] returns 403", async ({
      request,
    }) => {
      // MEMBER (platformRole=USER) cannot mutate any organization via admin API.
      const res = await request.patch(
        `/api/admin/organizations/${E2E_IDS.orgs.org1}`,
        { data: { name: "hacked-by-member" } },
      );
      expect(res.status()).toBe(403);
    });
  });

  test.describe("as org1-owner", () => {
    test.use({ storageState: storageStatePath("org1-owner") });

    test("can CRUD a client (create → edit → delete)", async ({
      page,
      request,
    }) => {
      const clientName = `E2E-Write-${Date.now()}`;

      // Create
      await page.goto("/clients/new");
      await page.getByLabel(/고객사명/).fill(clientName);
      await page.getByLabel(/사업자등록번호/).fill("111-11-11111");
      await page
        .getByRole("button", { name: /고객사 추가|생성|저장|Save|Create/i })
        .click();
      await page.waitForURL(/\/clients\/[^/]+$/, { timeout: 15_000 });
      const url = page.url();
      const clientId = url.split("/").pop()!;
      expect(clientId).toBeTruthy();

      // Edit
      await page.goto(`/clients/${clientId}/edit`);
      await page.getByLabel(/고객사명/).fill(`${clientName}-edited`);
      await page
        .getByRole("button", { name: /변경 저장|저장|업데이트|Save|Update/i })
        .click();
      // After edit the form redirects back to /clients/{id}
      await page.waitForURL(/\/clients\/[^/]+$/, { timeout: 15_000 });
      expect(page.url()).not.toMatch(/\/edit$/);

      // Delete via API (UI delete flow triggers a confirm dialog)
      const delRes = await request.delete(`/api/clients/${clientId}`);
      expect([200, 204]).toContain(delRes.status());
    });
  });

  test.describe("as platform", () => {
    test.use({ storageState: storageStatePath("platform") });

    test("GET /api/admin/organizations returns both E2E orgs", async ({
      request,
    }) => {
      const res = await request.get(
        "/api/admin/organizations?pageSize=100",
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      const orgs: Array<{ id: string }> = body.data ?? body.organizations ?? [];
      const ids = orgs.map((o) => o.id);
      expect(ids).toContain(E2E_IDS.orgs.org1);
      expect(ids).toContain(E2E_IDS.orgs.org2);
    });

    test("bulk deactivate then reactivate org1-member succeeds", async ({
      request,
    }) => {
      const deactivate = await request.post("/api/admin/users/bulk", {
        data: {
          userIds: [E2E_IDS.users.org1Member],
          action: "deactivate",
        },
      });
      expect([200, 204]).toContain(deactivate.status());

      const activate = await request.post("/api/admin/users/bulk", {
        data: {
          userIds: [E2E_IDS.users.org1Member],
          action: "activate",
        },
      });
      expect([200, 204]).toContain(activate.status());
    });

    test("can view cross-org detail page", async ({ page }) => {
      await page.goto(`/platform-admin/organizations/${E2E_IDS.orgs.org1}`);
      await expect(page).toHaveURL(
        new RegExp(`/platform-admin/organizations/${E2E_IDS.orgs.org1}`),
      );
      await expect(
        page.getByRole("heading", { level: 1, name: /E2E 컨설팅 A/ }),
      ).toBeVisible();
    });

    test("can view cross-org2 detail page", async ({ page }) => {
      await page.goto(`/platform-admin/organizations/${E2E_IDS.orgs.org2}`);
      await expect(
        page.getByRole("heading", { level: 1, name: /E2E 컨설팅 B/ }),
      ).toBeVisible();
    });

    test("can export users CSV", async ({ request }) => {
      const res = await request.get("/api/admin/users/export");
      expect(res.status()).toBe(200);
      const body = await res.text();
      // CSV should have at least a header row + one data row.
      const lines = body.split("\n").filter((l) => l.trim().length > 0);
      expect(lines.length).toBeGreaterThan(1);
    });
  });
});

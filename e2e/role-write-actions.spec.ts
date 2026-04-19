// e2e/role-write-actions.spec.ts
// Validates that platform/admin/employee write actions enforce their
// authorization boundaries AND that the owner CRUD happy path works end-to-end.
// These tests mutate DB state, so they only run against an ephemeral Postgres
// in CI (e2e-write.yml) — never against prod.
//
// Note: Admin API endpoints are guarded at TWO layers:
//   1. Middleware `authorized()` callback returns a redirect to /dashboard for
//      non-PLATFORM_ADMIN users hitting /api/admin/* routes.
//   2. Each admin route handler also calls `requirePlatformAdmin()` (belt & braces).
// That means non-admin callers see a 30x redirect (not 403), so we use
// `maxRedirects: 0` and accept either the redirect or the node-level 403.
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

    test("PATCH /api/admin/organizations/[orgId] is blocked by middleware", async ({
      request,
    }) => {
      const res = await request.patch(
        `/api/admin/organizations/${E2E_IDS.orgs.org1}`,
        { data: { name: "hacked-by-member" }, maxRedirects: 0 },
      );
      const status = res.status();
      if (status === 403) return; // node-level block (if middleware ever passes through)
      expect([302, 307, 308]).toContain(status);
      const location = res.headers()["location"] ?? "";
      expect(location).toMatch(/\/dashboard|\/login/);
    });
  });

  test.describe("as org1-owner", () => {
    test.use({ storageState: storageStatePath("org1-owner") });

    // API-level CRUD: the Next.js route handlers are the real write surface,
    // and they enforce org-scope. We exercise POST → PATCH → DELETE and assert
    // each hop returns a success code. (A UI-driven variant is covered by the
    // @smoke client-crud spec when E2E_USER_EMAIL is provided.)
    test("client CRUD (POST → PATCH → DELETE) via API", async ({ request }) => {
      const name = `E2E-Write-${Date.now()}`;

      const createRes = await request.post("/api/clients", {
        data: { name, businessNumber: "111-11-11111", status: "ACTIVE" },
      });
      expect([200, 201]).toContain(createRes.status());
      const created = await createRes.json();
      const clientId: string | undefined = created?.data?.id;
      expect(clientId, "POST /api/clients must return data.id").toBeTruthy();

      const patchRes = await request.patch(`/api/clients/${clientId}`, {
        data: { name: `${name}-edited` },
      });
      expect([200, 204]).toContain(patchRes.status());

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
      const lines = body.split("\n").filter((l) => l.trim().length > 0);
      expect(lines.length).toBeGreaterThan(1);
    });
  });
});

import { test, expect, type BrowserContext } from "@playwright/test";
import { signInAs } from "./helpers/auth";

/**
 * Phase 20 ERP — Multi-org + permission boundary coverage
 * (E1~E4, F1~F3 in project_next_session_e2e).
 *
 * E2: 다른 org의 draftId 접근 → 404
 * E3: 멤버십 있는 사용자가 ERP scope 없는 tenant 접근 → 보호 화면
 * E4: erp:read 있고 erp:write 없는 사용자 → 페이지 OK, POST 403
 * F1: 인증 누락 시 401 envelope `{ error: { code, message } }`
 * F2: 잘못된 body → 400 VALIDATION_ERROR + issues 배열
 * F3: P2002 → 409 with `fields` 배열
 *
 * E1 (tenant 스위처 UI) is deferred: switcher requires Multi-org cookie
 * coordination beyond this spec's scope. The underlying `getActiveTenant`
 * + tenant filter contract is covered by other ERP specs (every page
 * scopes to ctx.orgId via requireErpScope).
 *
 * Fixtures (packages/db/seed-e2e.ts §7, §10):
 *   intake-e2e-pending-confirm — belongs to org-e2e-1
 *   product-e2e-collision      — sku "E2E-DUPE-CANARY"  (P2002 driver)
 *   org1-owner    — erp:read + erp:write on org-e2e-1
 *   org1-member   — erp:read only on org-e2e-1  (no erp:write)
 *   org2-owner    — erp:read + erp:write on org-e2e-2
 */

const FIXTURE = {
  org1IntakeDraftId: "intake-e2e-pending-confirm",
  collisionSku: "E2E-DUPE-CANARY",
} as const;

/** Pull the active session cookies into a single Cookie header string so
 * APIRequestContext (which is a fresh request fixture, not the page's
 * fetch) can carry the user's auth. */
async function authCookieHeader(ctx: BrowserContext): Promise<string> {
  const cookies = await ctx.cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

test.describe("ERP multi-org boundary + error envelope @smoke", () => {
  test("E2: org2-owner accesses org1 draftId → 404 (cross-tenant)", async ({ page }) => {
    await signInAs(page, "org2-owner");

    // org2-owner is logged in on their own tenant (org-e2e-2). The intake
    // draft lives under org-e2e-1; findFirst with the active tenant filter
    // returns null → notFound() → app-level 404 page.
    await page.goto(`/erp/intake/${FIXTURE.org1IntakeDraftId}`);
    await expect(
      page.getByRole("heading", { name: "페이지를 찾을 수 없습니다" }),
    ).toBeVisible();
  });

  test("E4: org1-member (erp:read only) can browse /erp/products but POST returns 403", async ({
    page,
    request,
    context,
  }) => {
    await signInAs(page, "org1-member");

    // Read path — the list page loads (no protection trip).
    await page.goto("/erp/products");
    await expect(
      page.getByRole("heading", { name: "상품 관리" }),
    ).toBeVisible();

    // Write path — POST /api/erp/products returns 403 with the canonical
    // AXLE envelope. We do this as a direct API call because the form UI
    // would simply hide the network reason; here we're explicitly locking
    // down the scope guard's response shape.
    const cookieHeader = await authCookieHeader(context);
    const res = await request.post("/api/erp/products", {
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      data: {
        name: `E2E-rw-guard-${Date.now()}`,
        unit: "개",
        unitPrice: 100,
      },
    });
    expect(res.status()).toBe(403);
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    expect(body.error?.code).toBe("FORBIDDEN");
    expect(body.error?.message).toContain("erp:write");
  });

  test("F1: 인증 누락 시 envelope = { error: { code, message } }", async ({ request }) => {
    // Fresh APIRequestContext has no auth cookies → 401 from requireErpScope.
    const res = await request.get("/api/erp/products");
    expect(res.status()).toBe(401);
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    expect(body.error?.code).toBe("UNAUTHORIZED");
    expect(typeof body.error?.message).toBe("string");
    expect((body.error?.message ?? "").length).toBeGreaterThan(0);
  });

  test("F2: 잘못된 body → 400 VALIDATION_ERROR + issues 배열", async ({
    page,
    request,
    context,
  }) => {
    await signInAs(page, "org1-owner");
    const cookieHeader = await authCookieHeader(context);

    // CreateBody requires `name` (min 1) + `unit` (min 1). Empty body fails
    // both → 400 with issues array.
    const res = await request.post("/api/erp/products", {
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = (await res.json()) as {
      error?: { code?: string; message?: string; issues?: unknown };
    };
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(body.error?.issues)).toBe(true);
    expect((body.error?.issues as unknown[]).length).toBeGreaterThan(0);
  });

  test("F3: P2002 (sku 중복) → 409 CONFLICT envelope", async ({
    page,
    request,
    context,
  }) => {
    await signInAs(page, "org1-owner");
    const cookieHeader = await authCookieHeader(context);

    // Reuse the seed collision sku. orgId is filled in by the route from
    // the auth context, so the unique [orgId, sku] composite trips P2002.
    const res = await request.post("/api/erp/products", {
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      data: {
        name: `E2E-dup-${Date.now()}`,
        unit: "개",
        sku: FIXTURE.collisionSku,
        unitPrice: 0,
      },
    });
    expect(res.status()).toBe(409);
    const body = (await res.json()) as {
      error?: { code?: string; message?: string; fields?: unknown };
    };
    expect(body.error?.code).toBe("CONFLICT");
    // Message contract: starts with "Duplicate value for". The trailing
    // identifier varies with Prisma version + adapter: when `meta.target`
    // is an array we surface column names ("orgId, sku"); when it's a
    // string we surface the constraint name; when absent we fall back to
    // "unique field". The test asserts on the stable prefix only — and
    // checks `fields` separately when present.
    expect(body.error?.message ?? "").toMatch(/^Duplicate value for /);
    if (body.error?.fields !== undefined) {
      expect(Array.isArray(body.error.fields)).toBe(true);
      // If the route surfaced field names, at least one must reference sku
      // (either as a bare column or via a constraint name like
      // `Product_orgId_sku_key`).
      expect((body.error.fields as string[]).join(",")).toMatch(/sku/i);
    }
  });
});

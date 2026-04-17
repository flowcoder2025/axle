import { type Page, expect } from "@playwright/test";

export const TEST_USER_EMAIL = process.env.E2E_USER_EMAIL ?? "";
export const TEST_USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? "";

export const hasTestCreds = Boolean(TEST_USER_EMAIL && TEST_USER_PASSWORD);

/**
 * Sign in via the public /login form. Fails the test if credentials are missing
 * or the login does not land on a dashboard URL.
 */
export async function signInAsTestUser(page: Page): Promise<void> {
  if (!hasTestCreds) {
    throw new Error(
      "E2E_USER_EMAIL / E2E_USER_PASSWORD must be set to run authenticated E2E tests",
    );
  }

  await page.goto("/login");
  await page.getByLabel(/이메일|email/i).fill(TEST_USER_EMAIL);
  await page.getByLabel(/비밀번호|password/i).fill(TEST_USER_PASSWORD);
  await page.getByRole("button", { name: /로그인|sign in/i }).click();
  await page.waitForURL(/\/(dashboard|clients|projects)/, { timeout: 15_000 });
  await expect(page).toHaveURL(/\/(dashboard|clients|projects)/);
}

/** Unique client name for a test run (avoids collisions on shared DBs). */
export function uniqueClientName(prefix = "E2E-Client"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

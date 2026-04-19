import { type Page, expect } from "@playwright/test";
import { type E2ERole, getAccount } from "./roles";

// Legacy single-account envs (kept for backward-compat).
export const TEST_USER_EMAIL = process.env.E2E_USER_EMAIL ?? "";
export const TEST_USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? "";
export const hasTestCreds = Boolean(TEST_USER_EMAIL && TEST_USER_PASSWORD);

/** Sign in as a specific E2E role. */
export async function signInAs(page: Page, role: E2ERole): Promise<void> {
  const { email, password } = getAccount(role);
  await page.goto("/login");
  await page.getByLabel(/이메일|email/i).fill(email);
  await page.getByLabel(/비밀번호|password/i).fill(password);
  await page.getByRole("button", { name: /로그인|sign in/i }).click();
  // Platform admin lands on /platform-admin; others on /dashboard.
  await page.waitForURL(/\/(dashboard|platform-admin|clients|projects)/, { timeout: 15_000 });
}

/**
 * Legacy wrapper — equivalent to signInAs(page, "org1-owner").
 * Preserved for existing smoke tests that still use E2E_USER_EMAIL.
 * If E2E_ORG1_OWNER_* is set, use it; otherwise fall back to legacy envs.
 */
export async function signInAsTestUser(page: Page): Promise<void> {
  if (process.env.E2E_ORG1_OWNER_EMAIL) {
    await signInAs(page, "org1-owner");
    return;
  }
  if (!hasTestCreds) {
    throw new Error(
      "E2E_USER_EMAIL / E2E_USER_PASSWORD (or E2E_ORG1_OWNER_*) must be set",
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

// e2e/global-setup.ts
import { chromium, type FullConfig } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { E2E_ROLES, getAccount, storageStatePath } from "./helpers/roles";

/**
 * Logs in as each E2E role once and saves storage state to .playwright-auth/{role}.json.
 * Tests then reuse these via `test.use({ storageState: ... })` — no per-test login.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  // Either all 8 E2E envs are set (CI or properly sourced .env.e2e) or none are (existing smoke suite).
  // Partial configuration is misconfiguration — fail loudly up front with actionable message
  // instead of crashing mid-loop at requireEnv().
  const REQUIRED_ENVS = [
    "E2E_PLATFORM_EMAIL", "E2E_PLATFORM_PASSWORD",
    "E2E_ORG1_OWNER_EMAIL", "E2E_ORG1_OWNER_PASSWORD",
    "E2E_ORG1_MEMBER_EMAIL", "E2E_ORG1_MEMBER_PASSWORD",
    "E2E_ORG2_OWNER_EMAIL", "E2E_ORG2_OWNER_PASSWORD",
  ] as const;
  const missing = REQUIRED_ENVS.filter((name) => !process.env[name]);
  if (missing.length === REQUIRED_ENVS.length) {
    console.warn("[global-setup] No E2E_* account envs found. Skipping storageState generation.");
    return;
  }
  if (missing.length > 0) {
    throw new Error(
      `[global-setup] Partial E2E env config. Missing: ${missing.join(", ")}. ` +
      `Set all 8 envs or none. For local runs: copy .env.e2e.example → .env.e2e and source it.`,
    );
  }

  const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  if (!existsSync(".playwright-auth")) mkdirSync(".playwright-auth", { recursive: true });

  const browser = await chromium.launch();
  try {
    for (const role of E2E_ROLES) {
      const { email, password } = getAccount(role);
      const ctx = await browser.newContext({ baseURL });
      const page = await ctx.newPage();
      try {
        await page.goto("/login");
        await page.getByLabel(/이메일|email/i).fill(email);
        await page.getByLabel(/비밀번호|password/i).fill(password);
        await page.getByRole("button", { name: /로그인|sign in/i }).click();
        await page.waitForURL(/\/(dashboard|platform-admin|clients|projects)/, { timeout: 15_000 });
        await ctx.storageState({ path: storageStatePath(role) });
        console.log(`[global-setup] Saved storage state for ${role}`);
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
}

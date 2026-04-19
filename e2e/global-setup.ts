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
      try {
        // Authenticate via Auth.js API directly (bypasses UI hydration timing issues).
        // Steps: GET /api/auth/csrf → POST /api/auth/callback/credentials → session cookie set.
        const api = ctx.request;
        const csrfRes = await api.get("/api/auth/csrf");
        if (!csrfRes.ok()) {
          throw new Error(`csrf fetch failed: ${csrfRes.status()} ${await csrfRes.text()}`);
        }
        const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

        const loginRes = await api.post("/api/auth/callback/credentials", {
          form: {
            csrfToken,
            email,
            password,
            callbackUrl: `${baseURL}/dashboard`,
            json: "true",
          },
          maxRedirects: 0,
          failOnStatusCode: false,
        });
        // Auth.js returns 302 to callbackUrl on success, 302 to /api/auth/error on failure.
        const location = loginRes.headers()["location"] ?? "";
        if (loginRes.status() !== 302 || location.includes("/api/auth/error")) {
          throw new Error(
            `login failed for ${role}: status=${loginRes.status()} location=${location}`,
          );
        }

        await ctx.storageState({ path: storageStatePath(role) });
        console.log(`[global-setup] Saved storage state for ${role}`);
      } catch (err) {
        console.error(`[global-setup] Login failed for ${role}:`, err);
        throw err;
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
}

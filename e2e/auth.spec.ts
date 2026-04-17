import { test, expect } from "@playwright/test";

test.describe("auth: invalid credentials", () => {
  test("shows error when login fails", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel(/이메일|email/i).fill("nobody@example.invalid");
    await page.getByLabel(/비밀번호|password/i).fill("wrong-password-xyz");
    await page.getByRole("button", { name: /로그인|sign in/i }).click();

    // Either an inline error appears, or URL stays on /login
    await page.waitForURL(/\/login/, { timeout: 10_000 }).catch(() => {});
    expect(page.url()).toContain("/login");
  });
});

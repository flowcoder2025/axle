import { test, expect } from "@playwright/test";

test.describe("smoke: public pages render @smoke", () => {
  test("login page renders without JS errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/login");

    // Login form should be present
    await expect(page.getByRole("heading", { name: /로그인/i })).toBeVisible();

    // No uncaught page errors (ignore typical hydration noise from next-auth probes)
    const blocking = consoleErrors.filter(
      (e) => !/Failed to load resource|net::ERR_|favicon/i.test(e),
    );
    expect(blocking).toEqual([]);
  });

  test("signup page renders", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /회원가입|sign up/i })).toBeVisible();
  });

  test("root redirects unauthenticated users to landing or login", async ({ page }) => {
    const response = await page.goto("/");
    expect(response).not.toBeNull();
    // Should either land on marketing home or redirect to /login
    const url = page.url();
    expect(url).toMatch(/\/(login|$)/);
  });
});

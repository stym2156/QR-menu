import { test, expect } from "@playwright/test";

// Smoke tests — cheapest signal that the app boots and the public surface
// hasn't catastrophically broken. Auth-gated dashboard flows belong in
// follow-up specs that handle login fixtures.

test.describe("public surface", () => {
  test("login page renders the form", async ({ page }) => {
    await page.goto("/login");
    // The login surface should expose the two essentials for any auth UI.
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("signup page is reachable", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("unauthenticated dashboard redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    // layout.tsx redirects when there's no session.
    await expect(page).toHaveURL(/\/login/);
  });

  test("home page responds with 200", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(400);
  });
});

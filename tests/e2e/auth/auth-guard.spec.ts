import { test, expect } from "@playwright/test";

test.describe("Auth guard", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("unauthenticated /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("unauthenticated /onboarding redirects to /login", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("auth callback with no token shows generic error redirect", async ({ page }) => {
    await page.goto("/auth/callback");
    await expect(page).toHaveURL(/\/login\?error=auth_callback_failed$/);
  });

  test("auth callback with garbage token shows generic error redirect", async ({ page }) => {
    await page.goto("/auth/callback?token_hash=garbage&type=signup");
    await expect(page).toHaveURL(/\/login\?error=auth_callback_failed$/);
  });
});

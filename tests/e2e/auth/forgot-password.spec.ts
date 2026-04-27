import { test, expect } from "@playwright/test";

test.describe("Forgot password flow", () => {
  test("renders the reset form", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: /reset your password/i })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /send reset link/i })).toBeVisible();
  });

  test("submitting any email shows the non-enumerable success message", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.locator('input[type="email"]').fill(`unknown-${Date.now()}@example.com`);
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText(/if an account exists for that email/i)).toBeVisible();
  });

  test("back-to-sign-in link goes to /login", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByRole("link", { name: /back to sign in/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

import { test, expect } from "@playwright/test";

test.describe("Signup flow", () => {
  test("signup page renders all required fields", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible();
    await expect(page.locator('input[name="full_name"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
  });

  test("short password shows server-side error", async ({ page }) => {
    await page.goto("/signup");
    await page.locator('input[name="full_name"]').fill("Test User");
    await page.locator('input[type="email"]').fill("test@example.com");
    await page.locator('input[type="password"]').fill("short");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });

  test("REGRESSION: form fields should retain values after server-side validation error", async ({
    page,
  }) => {
    await page.goto("/signup");
    await page.locator('input[name="full_name"]').fill("Test User");
    await page.locator('input[type="email"]').fill("test@example.com");
    await page.locator('input[type="password"]').fill("short");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
    await expect(page.locator('input[name="full_name"]')).toHaveValue("Test User");
    await expect(page.locator('input[type="email"]')).toHaveValue("test@example.com");
  });

  test("valid signup redirects to /verify-email with the email shown", async ({ page }) => {
    const email = `qa-pw-${Date.now()}@mailinator.com`;
    await page.goto("/signup");
    await page.locator('input[name="full_name"]').fill("Playwright User");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill("longenough123");
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page).toHaveURL(new RegExp(`/verify-email\\?email=${encodeURIComponent(email)}$`));
    await expect(page.getByRole("heading", { name: /check your inbox/i })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });

  test("sign-in link goes to /login", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("link", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

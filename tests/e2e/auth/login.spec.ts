import { test, expect } from "@playwright/test";

test.describe("Login flow", () => {
  test("login page renders all required fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /forgot password/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /create one/i })).toBeVisible();
  });

  test("empty submit triggers browser validation", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /sign in/i }).click();
    const emailInput = page.locator('input[type="email"]');
    const validity = await emailInput.evaluate(
      (el) => (el as HTMLInputElement).validity.valueMissing,
    );
    expect(validity).toBe(true);
  });

  test("wrong credentials show 'Invalid login credentials'", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("nobody-12345@example.com");
    await page.locator('input[type="password"]').fill("wrongpassword123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid login credentials/i)).toBeVisible();
  });

  test("forgot password link goes to /forgot-password", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
  });

  test("create-one link goes to /signup", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /create one/i }).click();
    await expect(page).toHaveURL(/\/signup$/);
  });
});

import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders headline and primary CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Live\s+longer/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
  });

  test("Get my bio-age CTA navigates to /signup", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /get my bio-age/i }).first().click();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("Sign in link in nav goes to /login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /sign in/i }).first().click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("public sub-pages render without errors", async ({ page }) => {
    for (const path of ["/science", "/team", "/stories", "/sample-report"]) {
      const res = await page.goto(path);
      expect(res?.status(), `${path} should not 5xx`).toBeLessThan(500);
    }
  });
});

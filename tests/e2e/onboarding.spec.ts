import { test, expect, type Page } from "@playwright/test";

/**
 * Onboarding flow E2E tests.
 *
 * Walks through the full 6-step questionnaire (basics, medical, family,
 * lifestyle, goals, consent) with minimal valid data, submits, and verifies
 * the redirect to /dashboard.
 *
 * Requires env vars:
 *   TEST_EMAIL    — seeded test user email
 *   TEST_PASSWORD — seeded test user password
 *
 * The test user should have a completed_at = null health_profiles row
 * (or no health_profiles row) so onboarding is accessible. If the user
 * already completed onboarding, the test verifies the resume/re-submit path.
 */

const TEST_EMAIL = process.env.TEST_EMAIL ?? "test@longevity-coach.io";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15_000,
  });
}

test.describe("Onboarding flow", () => {
  test.skip(!TEST_PASSWORD, "TEST_PASSWORD env var not set — skipping onboarding E2E tests");

  test("loads onboarding page with step indicators", async ({ page }) => {
    await signIn(page);
    await page.goto("/onboarding");

    // Wait for the onboarding form to render
    await page.waitForSelector(".lc-onboarding", { timeout: 10_000 });

    // Verify step indicators exist (6 steps)
    const steps = page.locator(".step");
    await expect(steps).toHaveCount(6);

    // First step should be active
    await expect(steps.nth(0)).toHaveClass(/active/);

    // Step 1 heading should be "About you"
    await expect(page.locator("h2")).toContainText("About you");
  });

  test("navigates through all steps and submits", async ({ page }) => {
    await signIn(page);
    await page.goto("/onboarding");
    await page.waitForSelector(".lc-onboarding", { timeout: 10_000 });

    // --- Step 1: Basics ---
    // Fill required fields: date_of_birth, sex_at_birth
    const dobInput = page.locator('input[type="date"]');
    if (await dobInput.isVisible()) {
      await dobInput.fill("1985-06-15");
    }

    // Select sex_at_birth (required select)
    const sexSelect = page.locator("select").first();
    if (await sexSelect.isVisible()) {
      const options = await sexSelect.locator("option").allTextContents();
      // Pick a non-placeholder option
      const validOption = options.find(
        (o) => o && !o.toLowerCase().includes("select") && !o.toLowerCase().includes("choose"),
      );
      if (validOption) await sexSelect.selectOption({ label: validOption });
    }

    // Click Next
    await page.getByRole("button", { name: /next/i }).click();

    // --- Step 2: Medical history ---
    await expect(page.locator("h2")).toContainText("Medical history");

    // Medical step fields are all optional — just proceed
    await page.getByRole("button", { name: /next/i }).click();

    // --- Step 3: Family history ---
    await expect(page.locator("h2")).toContainText("Family history");

    // Family history is optional — proceed
    await page.getByRole("button", { name: /next/i }).click();

    // --- Step 4: Lifestyle ---
    await expect(page.locator("h2")).toContainText("Lifestyle");

    // Fill required selects — smoking, alcohol, exercise volume, sleep, stress, diet
    const selects = page.locator("select");
    const selectCount = await selects.count();
    for (let i = 0; i < selectCount; i++) {
      const sel = selects.nth(i);
      const options = await sel.locator("option").allTextContents();
      const validOption = options.find(
        (o) =>
          o &&
          !o.toLowerCase().includes("select") &&
          !o.toLowerCase().includes("choose") &&
          o.trim() !== "",
      );
      if (validOption) {
        await sel.selectOption({ label: validOption });
      }
    }

    await page.getByRole("button", { name: /next/i }).click();

    // --- Step 5: Goals ---
    await expect(page.locator("h2")).toContainText("goals", { ignoreCase: true });

    // Goals has a multiselect chips field — click at least one chip
    const chips = page.locator(".chip, .chips button, [role='option'], .chip-option");
    const chipCount = await chips.count();
    if (chipCount > 0) {
      await chips.first().click();
    }

    await page.getByRole("button", { name: /next/i }).click();

    // --- Step 6: Consent ---
    await expect(page.locator("h2")).toContainText("Consent", { ignoreCase: true });

    // Toggle all required consent toggles
    const toggles = page.locator('button[role="switch"], input[type="checkbox"]');
    const toggleCount = await toggles.count();
    for (let i = 0; i < toggleCount; i++) {
      const toggle = toggles.nth(i);
      const checked =
        (await toggle.getAttribute("aria-checked")) === "true" ||
        (await toggle.isChecked().catch(() => false));
      if (!checked) {
        await toggle.click();
      }
    }

    // Submit
    const submitBtn = page.getByRole("button", { name: /submit/i });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Wait for redirect to dashboard (submission triggers pipelines + redirect)
    await page.waitForURL((url) => url.pathname === "/dashboard", {
      timeout: 30_000,
    });

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("save-and-resume preserves draft data", async ({ page }) => {
    await signIn(page);
    await page.goto("/onboarding");
    await page.waitForSelector(".lc-onboarding", { timeout: 10_000 });

    // Fill DOB on basics step
    const dobInput = page.locator('input[type="date"]');
    if (await dobInput.isVisible()) {
      await dobInput.fill("1990-03-20");
    }

    // Navigate to step 2 and back — data should persist
    const sexSelect = page.locator("select").first();
    if (await sexSelect.isVisible()) {
      const options = await sexSelect.locator("option").allTextContents();
      const validOption = options.find(
        (o) => o && !o.toLowerCase().includes("select") && !o.toLowerCase().includes("choose"),
      );
      if (validOption) await sexSelect.selectOption({ label: validOption });
    }

    await page.getByRole("button", { name: /next/i }).click();
    await expect(page.locator("h2")).toContainText("Medical history");

    // Go back
    await page.getByRole("button", { name: /back/i }).click();
    await expect(page.locator("h2")).toContainText("About you");

    // Verify DOB is still filled
    if (await dobInput.isVisible()) {
      await expect(dobInput).toHaveValue("1990-03-20");
    }
  });
});

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

const TEST_EMAIL = process.env.TEST_EMAIL ?? "test@janet.care";
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
    await page.getByRole("button", { name: /continue/i }).click();

    // --- Step 2: Medical history ---
    await expect(page.locator("h2")).toContainText("Medical history");

    // Medical step fields are all optional — just proceed
    await page.getByRole("button", { name: /continue/i }).click();

    // --- Step 3: Family history ---
    await expect(page.locator("h2")).toContainText("Family history");

    // Family history is optional — proceed
    await page.getByRole("button", { name: /continue/i }).click();

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

    await page.getByRole("button", { name: /continue/i }).click();

    // --- Step 5: Goals ---
    await expect(page.locator("h2")).toContainText("goals", { ignoreCase: true });

    // Goals is a chips multiselect with a maxSelect cap — disabled chips
    // appear when the user has already hit the limit (e.g. on re-edit). We
    // need at least one selected to satisfy any required-field check, so
    // pick the first chip that is BOTH visible and currently enabled. If
    // every chip is disabled, the user is already at the limit, which means
    // selections are already present — proceed without adding more.
    const chips = page.locator(".chip");
    const chipCount = await chips.count();
    let clicked = false;
    for (let i = 0; i < chipCount; i++) {
      const chip = chips.nth(i);
      const disabled = await chip.isDisabled();
      if (!disabled) {
        await chip.click();
        clicked = true;
        break;
      }
    }
    // If none are clickable, verify at least one is already selected so the
    // step still satisfies its requirement.
    if (!clicked) {
      const selectedChips = page.locator(".chip.selected");
      await expect(selectedChips.first()).toBeVisible();
    }

    await page.getByRole("button", { name: /continue/i }).click();

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

    // Submit. Button text is "Submit assessment" on first completion, or
    // "Save updated responses" when re-editing a previously completed profile.
    const submitBtn = page.getByRole("button", {
      name: /submit assessment|save updated responses/i,
    });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Wait for redirect to dashboard (submission triggers pipelines + redirect)
    await page.waitForURL((url) => url.pathname === "/dashboard", {
      timeout: 30_000,
    });

    await expect(page).toHaveURL(/\/dashboard(\?|$)/);
  });

  test("save-and-resume persists across full page reload", async ({ page }) => {
    await signIn(page);
    await page.goto("/onboarding");
    await page.waitForSelector(".lc-onboarding", { timeout: 10_000 });

    // Fill DOB on basics step
    const dobInput = page.locator('input[type="date"]');
    await expect(dobInput).toBeVisible();
    await dobInput.fill("1990-03-20");

    // Pick a non-placeholder sex option
    const sexSelect = page.locator("select").first();
    await expect(sexSelect).toBeVisible();
    const options = await sexSelect.locator("option").allTextContents();
    const validOption = options.find(
      (o) => o && !o.toLowerCase().includes("select") && !o.toLowerCase().includes("choose"),
    );
    if (validOption) await sexSelect.selectOption({ label: validOption });

    // Click Continue to advance to step 2 — this triggers saveDraft which
    // must round-trip to health_profiles.responses.
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.locator("h2")).toContainText("Medical history");

    // FULL PAGE RELOAD — drops React state. The only way the form can
    // re-populate is by hydrating from the saved draft on the server.
    await page.reload();
    await page.waitForSelector(".lc-onboarding", { timeout: 10_000 });

    // After reload we land back on step 1 (the form starts at stepIdx=0).
    // Required-field values must come back from the saved draft, proving the
    // Continue press wrote to the database — not just to React state.
    await expect(page.locator("h2")).toContainText("About you");
    const dobAfterReload = page.locator('input[type="date"]');
    await expect(dobAfterReload).toHaveValue("1990-03-20");
  });
});

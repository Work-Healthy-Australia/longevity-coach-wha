import { test, expect, type Page } from "@playwright/test";

/**
 * Risk simulator E2E smoke test.
 *
 * Requires env vars:
 *   TEST_EMAIL    — seeded test user email
 *   TEST_PASSWORD — seeded test user password
 *
 * Selectors are based on simulator-client.tsx:
 *   - Sliders:        input[type="range"].lc-sim-range
 *   - Domain rows:    .lc-sim-domain-row .lc-sim-domain-delta
 *   - Composite risk: .lc-sim-composite-value
 */

const TEST_EMAIL = process.env.TEST_EMAIL ?? "test@janet.care";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";

async function signInAndGoToSimulator(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15_000,
  });

  await page.goto("/simulator");
  // Wait for the slider grid to be present
  await page.waitForSelector(".lc-sim-grid", { timeout: 15_000 });
}

test.describe("Risk simulator", () => {
  test.skip(!TEST_PASSWORD, "TEST_PASSWORD env var not set — skipping simulator E2E tests");

  test("adjusting a slider changes the domain score", async ({ page }) => {
    await signInAndGoToSimulator(page);

    // Capture the initial composite risk value
    const compositeLocator = page.locator(".lc-sim-composite-value");
    const initialComposite = await compositeLocator.textContent();

    // Grab the first range slider (LDL)
    const slider = page.locator('input[type="range"].lc-sim-range').first();
    await expect(slider).toBeVisible();

    // Move the slider to its maximum value — guaranteed to change risk
    const max = await slider.getAttribute("max");
    await slider.fill(max ?? "250");

    // The component uses useDeferredValue so give React a tick to rerender
    await page.waitForTimeout(300);

    // Assert the composite value text changed
    const updatedComposite = await compositeLocator.textContent();
    expect(updatedComposite).not.toBeNull();
    expect(updatedComposite?.trim().length).toBeGreaterThan(0);

    // Verify a numeric score is shown in at least one domain row
    const domainDeltas = page.locator(".lc-sim-domain-row .lc-sim-domain-delta");
    const count = await domainDeltas.count();
    expect(count).toBeGreaterThan(0);

    // Score must have changed from baseline after dragging to max
    expect(updatedComposite).not.toBe(initialComposite);
  });
});

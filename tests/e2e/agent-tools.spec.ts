import { test, expect, type Page } from "@playwright/test";

/**
 * E2E tests for Chef Agent (Meal Plan Tool) and PT Coach Tool.
 *
 * These tests verify that Janet correctly delegates to specialist agents:
 * - PT Coach: Exercise, fitness, training, and rehabilitation advice
 * - Chef Agent: Meal plans, nutrition, and shopping lists
 *
 * Requires env vars:
 *   TEST_EMAIL    — seeded test user email
 *   TEST_PASSWORD — seeded test user password
 */

const TEST_EMAIL = process.env.TEST_EMAIL ?? "test@longevity-coach.io";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";

/** Sign in and navigate to /report, leaving the page ready for chat interaction. */
async function signInAndGoToReport(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15_000,
  });

  await page.goto("/report");
  await page.waitForSelector("input.chat-input:not([disabled])", {
    timeout: 20_000,
  });
}

/**
 * Sends a message and waits for an assistant response to appear.
 * Returns the text content of the last assistant bubble.
 */
async function sendAndWaitForResponse(
  page: Page,
  question: string,
  timeoutMs = 20_000,
): Promise<string> {
  const chatInput = page.locator("input.chat-input");
  const sendButton = page.locator("button.chat-send");

  await chatInput.fill(question);
  await sendButton.click();

  // Wait until streaming completes (input becomes enabled again)
  await page.waitForSelector("input.chat-input:not([disabled])", {
    timeout: timeoutMs,
  });

  const assistantBubbles = page.locator("div.chat-message-assistant div.chat-bubble");
  const count = await assistantBubbles.count();
  const lastBubble = assistantBubbles.nth(count - 1);
  return (await lastBubble.textContent()) ?? "";
}

test.describe("PT Coach Tool", () => {
  test.skip(!TEST_PASSWORD, "TEST_PASSWORD env var not set — skipping PT Coach E2E tests");

  test("responds to exercise-specific questions with training advice", async ({ page }) => {
    await signInAndGoToReport(page);

    const response = await sendAndWaitForResponse(
      page,
      "What exercises should I do today based on my PT plan?",
      20_000,
    );

    expect(response.trim().length).toBeGreaterThan(0);
    // PT coach should provide exercise-specific guidance
    expect(response.toLowerCase()).toMatch(/exercise|workout|training|fitness|movement/);
  });

  test("provides rehabilitation advice when asked", async ({ page }) => {
    await signInAndGoToReport(page);

    const response = await sendAndWaitForResponse(
      page,
      "I have lower back pain. What exercises can help with rehabilitation?",
      20_000,
    );

    expect(response.trim().length).toBeGreaterThan(0);
    // Should contain exercise or rehabilitation guidance
    expect(response.toLowerCase()).toMatch(/exercise|stretch|strengthen|mobility|rehab/);
  });

  test("adapts advice based on MSK risk context", async ({ page }) => {
    await signInAndGoToReport(page);

    const response = await sendAndWaitForResponse(
      page,
      "My MSK risk is high. What exercises are safe for me?",
      20_000,
    );

    expect(response.trim().length).toBeGreaterThan(0);
    // High MSK risk should trigger safety-conscious advice
    expect(response.toLowerCase()).toMatch(/safe|careful|modify|adapt|low impact|gentle/);
  });

  test("references specific exercises from the PT plan", async ({ page }) => {
    await signInAndGoToReport(page);

    const response = await sendAndWaitForResponse(
      page,
      "Can you summarize my current PT plan?",
      20_000,
    );

    expect(response.trim().length).toBeGreaterThan(0);
    // Should reference plan structure or specific exercises
    expect(response.toLowerCase()).toMatch(/plan|exercise|routine|session/);
  });
});

test.describe("Chef Agent (Meal Plan Tool)", () => {
  test.skip(!TEST_PASSWORD, "TEST_PASSWORD env var not set — skipping Chef Agent E2E tests");

  test("triggers meal plan generation when requested", async ({ page }) => {
    await signInAndGoToReport(page);

    const response = await sendAndWaitForResponse(
      page,
      "Generate a meal plan for me this week",
      15_000,
    );

    expect(response.trim().length).toBeGreaterThan(0);
    // Should acknowledge the request and indicate generation is starting
    expect(response.toLowerCase()).toMatch(/generat|meal plan|working on|preparing/);
  });

  test("responds to nutrition questions with dietary guidance", async ({ page }) => {
    await signInAndGoToReport(page);

    const response = await sendAndWaitForResponse(
      page,
      "What should I eat to support my longevity goals?",
      20_000,
    );

    expect(response.trim().length).toBeGreaterThan(0);
    // Should provide nutrition or dietary advice
    expect(response.toLowerCase()).toMatch(/food|diet|nutrition|eat|meal|healthy/);
  });

  test("offers shopping list assistance", async ({ page }) => {
    await signInAndGoToReport(page);

    const response = await sendAndWaitForResponse(
      page,
      "Create a shopping list for my meal plan",
      15_000,
    );

    expect(response.trim().length).toBeGreaterThan(0);
    // Should acknowledge shopping list request
    expect(response.toLowerCase()).toMatch(/shopping|list|groceries|items|ingredients/);
  });

  test("integrates with existing meal plan context", async ({ page }) => {
    await signInAndGoToReport(page);

    const response = await sendAndWaitForResponse(
      page,
      "What's in my current meal plan?",
      20_000,
    );

    expect(response.trim().length).toBeGreaterThan(0);
    // Should reference existing plan or offer to create one
    expect(response.toLowerCase()).toMatch(/plan|meal|breakfast|lunch|dinner|snack|recipe/);
  });
});

test.describe("Agent Tool Integration", () => {
  test.skip(!TEST_PASSWORD, "TEST_PASSWORD env var not set — skipping integration tests");

  test("Janet maintains conversation context across tool calls", async ({ page }) => {
    await signInAndGoToReport(page);

    // First ask about exercise
    const exerciseResponse = await sendAndWaitForResponse(
      page,
      "What exercises are in my PT plan?",
      20_000,
    );
    expect(exerciseResponse.trim().length).toBeGreaterThan(0);

    // Follow-up question should maintain context
    const followUpResponse = await sendAndWaitForResponse(
      page,
      "How many days a week should I do those?",
      20_000,
    );
    expect(followUpResponse.trim().length).toBeGreaterThan(0);
    // Should reference the previous exercise discussion
    expect(followUpResponse.toLowerCase()).toMatch(/week|day|frequency|session|time|per/);
  });

  test("handles rapid sequential tool requests", async ({ page }) => {
    await signInAndGoToReport(page);

    // Request meal plan
    const mealResponse = await sendAndWaitForResponse(
      page,
      "Create a meal plan for me",
      15_000,
    );
    expect(mealResponse.trim().length).toBeGreaterThan(0);

    // Immediately follow with PT question
    const ptResponse = await sendAndWaitForResponse(
      page,
      "What about my exercise plan?",
      20_000,
    );
    expect(ptResponse.trim().length).toBeGreaterThan(0);
    expect(ptResponse.toLowerCase()).toMatch(/exercise|workout|training|fitness/);
  });
});

import { test, expect, type Page } from "@playwright/test";

/**
 * Janet conversation loop E2E tests.
 *
 * Requires env vars:
 *   TEST_EMAIL    — seeded test user email
 *   TEST_PASSWORD — seeded test user password
 *
 * Selectors are based on janet-chat.tsx:
 *   - Input:       input.chat-input  (type="text", placeholder="Ask Janet anything…")
 *   - Send button: button.chat-send  (type="submit")
 *   - Messages:    div.chat-message-assistant div.chat-bubble
 */

const TEST_EMAIL = process.env.TEST_EMAIL ?? "test@longevity-coach.io";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";

/** Sign in and navigate to /report, leaving the page ready for chat interaction. */
async function signInAndGoToReport(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for redirect away from /login (dashboard or onboarding)
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15_000,
  });

  await page.goto("/report");
  // Wait for the chat input to be ready (status === 'ready' → input is enabled)
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
  timeoutMs = 15_000,
): Promise<string> {
  const chatInput = page.locator("input.chat-input");
  const sendButton = page.locator("button.chat-send");

  await chatInput.fill(question);
  await sendButton.click();

  // Wait until status returns to 'ready' (input becomes enabled again)
  // which means streaming has completed.
  await page.waitForSelector("input.chat-input:not([disabled])", {
    timeout: timeoutMs,
  });

  // Return the last assistant message text
  const assistantBubbles = page.locator("div.chat-message-assistant div.chat-bubble");
  const count = await assistantBubbles.count();
  const lastBubble = assistantBubbles.nth(count - 1);
  return (await lastBubble.textContent()) ?? "";
}

test.describe("Janet conversation loop", () => {
  test.skip(!TEST_PASSWORD, "TEST_PASSWORD env var not set — skipping Janet E2E tests");

  test("responds to health, supplement, and exercise questions", async ({ page }) => {
    await signInAndGoToReport(page);

    // --- Health question (generous 10s for first token) ---
    const healthResponse = await sendAndWaitForResponse(
      page,
      "What does my biological age mean for my health?",
      10_000,
    );
    expect(healthResponse.trim().length).toBeGreaterThan(0);

    // --- Supplement question ---
    const supplementResponse = await sendAndWaitForResponse(
      page,
      "Which supplement should I prioritise first?",
      15_000,
    );
    expect(supplementResponse.trim().length).toBeGreaterThan(0);

    // --- Exercise question ---
    const exerciseResponse = await sendAndWaitForResponse(
      page,
      "What type of exercise would most improve my longevity?",
      15_000,
    );
    expect(exerciseResponse.trim().length).toBeGreaterThan(0);
  });
});

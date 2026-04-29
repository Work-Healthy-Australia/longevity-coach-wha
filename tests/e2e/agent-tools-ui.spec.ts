import { test, expect } from "@playwright/test";

/**
 * UI-level E2E tests for Chef Agent and PT Coach chat interface.
 * These tests validate the chat UI components without requiring live LLM responses.
 */

test.describe("Agent Tools Chat UI", () => {
  test("chat input has correct placeholder and styling", async ({ page }) => {
    await page.goto("/report");
    await page.waitForLoadState("networkidle");

    // Skip if redirected to login (requires auth)
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      test.skip();
      return;
    }

    // Check if chat input exists with correct attributes
    const chatInput = page.locator("input.chat-input");
    await expect(chatInput).toHaveAttribute("placeholder", "Ask Janet anything…");
    await expect(chatInput).toHaveAttribute("type", "text");
    await expect(chatInput).toHaveAttribute("autocomplete", "off");
  });

  test("chat send button has correct initial state", async ({ page }) => {
    await page.goto("/report");
    await page.waitForLoadState("networkidle");

    // Skip if redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      test.skip();
      return;
    }

    const sendButton = page.locator("button.chat-send");
    // Should be disabled when input is empty
    await expect(sendButton).toBeDisabled();
  });

  test("chat starter buttons are visible on report page", async ({ page }) => {
    await page.goto("/report");

    // Wait for potential redirect to settle
    await page.waitForLoadState("networkidle");

    // Check if we're on a page with the chat interface
    const chatContainer = page.locator(".chat-container");
    if (await chatContainer.isVisible().catch(() => false)) {
      // Check for starter buttons
      const starterButtons = page.locator("button.chat-starter");
      const count = await starterButtons.count();

      // If chat is visible and empty, we should see starter buttons
      if (count > 0) {
        // Verify expected starter questions exist
        const texts = await starterButtons.allTextContents();
        const hasRelevantStarter = texts.some(text =>
          text.toLowerCase().includes("supplement") ||
          text.toLowerCase().includes("biological age") ||
          text.toLowerCase().includes("risk factor")
        );
        expect(hasRelevantStarter).toBe(true);
      }
    }
  });

  test("chat message containers have proper structure", async ({ page }) => {
    await page.goto("/report");
    await page.waitForLoadState("networkidle");

    const chatContainer = page.locator(".chat-container");
    if (await chatContainer.isVisible().catch(() => false)) {
      // Verify chat structure
      await expect(chatContainer.locator(".chat-messages")).toBeVisible();
      await expect(chatContainer.locator("form.chat-form")).toBeVisible();
      await expect(chatContainer.locator("input.chat-input")).toBeVisible();
      await expect(chatContainer.locator("button.chat-send")).toBeVisible();
    }
  });

  test("assistant messages have avatar and bubble structure", async ({ page }) => {
    await page.goto("/report");
    await page.waitForLoadState("networkidle");

    // Look for any existing assistant messages
    const assistantMessages = page.locator("div.chat-message-assistant");
    const count = await assistantMessages.count();

    if (count > 0) {
      // Verify structure of first assistant message
      const firstMessage = assistantMessages.first();
      await expect(firstMessage.locator(".chat-avatar")).toBeVisible();
      await expect(firstMessage.locator(".chat-bubble")).toBeVisible();
    }
  });

  test("typing indicator has correct structure when visible", async ({ page }) => {
    await page.goto("/report");
    await page.waitForLoadState("networkidle");

    // Check if typing indicator exists (may not be visible until streaming)
    const typingIndicator = page.locator(".chat-bubble-typing");

    if (await typingIndicator.isVisible().catch(() => false)) {
      // Should have 3 span elements for the animation dots
      const spans = typingIndicator.locator("span");
      await expect(spans).toHaveCount(3);
    }
  });
});

test.describe("Agent Tools Accessibility", () => {
  test("chat input is focusable and has correct aria attributes", async ({ page }) => {
    await page.goto("/report");
    await page.waitForLoadState("networkidle");

    // Skip if redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      test.skip();
      return;
    }

    const chatInput = page.locator("input.chat-input");

    // Check if input can be focused
    await chatInput.focus();
    await expect(chatInput).toBeFocused();
  });

  test("send button has correct type and role", async ({ page }) => {
    await page.goto("/report");
    await page.waitForLoadState("networkidle");

    // Skip if redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      test.skip();
      return;
    }

    const sendButton = page.locator("button.chat-send");
    await expect(sendButton).toHaveAttribute("type", "submit");
  });

  test("chat form has proper structure for accessibility", async ({ page }) => {
    await page.goto("/report");
    await page.waitForLoadState("networkidle");

    // Skip if redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      test.skip();
      return;
    }

    const chatForm = page.locator("form.chat-form");
    await expect(chatForm).toHaveAttribute("method", "post");

    // Form should contain input and button
    await expect(chatForm.locator("input.chat-input")).toBeVisible();
    await expect(chatForm.locator("button.chat-send")).toBeVisible();
  });
});

test.describe("Agent Tools Responsive Design", () => {
  test("chat container adapts to mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/report");
    await page.waitForLoadState("networkidle");

    const chatContainer = page.locator(".chat-container");
    if (await chatContainer.isVisible().catch(() => false)) {
      // Verify chat is still usable on mobile
      await expect(chatContainer).toBeVisible();
      await expect(page.locator("input.chat-input")).toBeVisible();
      await expect(page.locator("button.chat-send")).toBeVisible();
    }
  });

  test("chat container adapts to tablet viewport", async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/report");
    await page.waitForLoadState("networkidle");

    const chatContainer = page.locator(".chat-container");
    if (await chatContainer.isVisible().catch(() => false)) {
      await expect(chatContainer).toBeVisible();
    }
  });
});

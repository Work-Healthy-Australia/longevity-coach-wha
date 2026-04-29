import { test, expect, type Page } from "@playwright/test";

/**
 * Janet latency benchmarks.
 *
 * Measures end-to-end response time for different Janet interaction patterns:
 *   1. Simple question (no tool invocation)
 *   2. Risk explanation (triggers risk_analyzer_summary tool)
 *   3. Supplement question (triggers supplement_advisor_summary tool)
 *   4. Exercise question (triggers consult_pt_coach tool)
 *   5. Multi-domain question (may trigger multiple tools)
 *
 * Each test records wall-clock time from send to response completion.
 * Results are logged to stdout for CI pipeline capture.
 *
 * Env vars:
 *   TEST_EMAIL    — seeded test user with completed assessment + risk scores
 *   TEST_PASSWORD — password for that user
 */

const TEST_EMAIL = process.env.TEST_EMAIL ?? "test@longevity-coach.io";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";

const RESPONSE_TIMEOUT_MS = 30_000;

interface BenchmarkResult {
  scenario: string;
  latencyMs: number;
  responseLength: number;
  toolsDetected: string[];
}

const results: BenchmarkResult[] = [];

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

async function sendAndMeasure(
  page: Page,
  scenario: string,
  question: string,
): Promise<BenchmarkResult> {
  const chatInput = page.locator("input.chat-input");
  const sendButton = page.locator("button.chat-send");

  await chatInput.fill(question);

  const t0 = Date.now();
  await sendButton.click();

  // Wait for streaming to complete (input re-enables)
  await page.waitForSelector("input.chat-input:not([disabled])", {
    timeout: RESPONSE_TIMEOUT_MS,
  });
  const latencyMs = Date.now() - t0;

  // Get the last assistant response
  const assistantBubbles = page.locator("div.chat-message-assistant div.chat-bubble");
  const count = await assistantBubbles.count();
  const lastBubble = assistantBubbles.nth(count - 1);
  const responseText = (await lastBubble.textContent()) ?? "";

  // Detect which tools were likely invoked based on response content patterns
  const toolsDetected: string[] = [];
  const lower = responseText.toLowerCase();
  if (lower.includes("risk") && lower.includes("score")) toolsDetected.push("risk_analyzer");
  if (lower.includes("supplement") && lower.includes("protocol")) toolsDetected.push("supplement_advisor");
  if (lower.includes("exercise") && (lower.includes("plan") || lower.includes("training")))
    toolsDetected.push("pt_coach");

  const result: BenchmarkResult = {
    scenario,
    latencyMs,
    responseLength: responseText.length,
    toolsDetected,
  };

  results.push(result);
  return result;
}

function logResult(r: BenchmarkResult) {
  console.log(
    `[BENCH] ${r.scenario}: ${r.latencyMs}ms | ${r.responseLength} chars | tools: ${r.toolsDetected.length > 0 ? r.toolsDetected.join(", ") : "none"}`,
  );
}

test.describe("Janet latency benchmarks", () => {
  test.skip(!TEST_PASSWORD, "TEST_PASSWORD env var not set — skipping latency benchmarks");

  test("measures latency across five interaction patterns", async ({ page }) => {
    await signInAndGoToReport(page);

    // --- 1. Simple greeting (no tool) ---
    const r1 = await sendAndMeasure(
      page,
      "simple-greeting",
      "Hi Janet, how are you?",
    );
    logResult(r1);
    expect(r1.latencyMs).toBeLessThan(RESPONSE_TIMEOUT_MS);
    expect(r1.responseLength).toBeGreaterThan(0);

    // --- 2. Risk explanation (risk_analyzer tool) ---
    const r2 = await sendAndMeasure(
      page,
      "risk-deep-dive",
      "Can you explain my cardiovascular risk score in detail and what is driving it?",
    );
    logResult(r2);
    expect(r2.latencyMs).toBeLessThan(RESPONSE_TIMEOUT_MS);

    // --- 3. Supplement question (supplement_advisor tool) ---
    const r3 = await sendAndMeasure(
      page,
      "supplement-deep-dive",
      "Why am I taking these supplements? Walk me through my protocol rationale.",
    );
    logResult(r3);
    expect(r3.latencyMs).toBeLessThan(RESPONSE_TIMEOUT_MS);

    // --- 4. Exercise question (pt_coach tool) ---
    const r4 = await sendAndMeasure(
      page,
      "exercise-advice",
      "What specific exercises should I do this week for my longevity goals?",
    );
    logResult(r4);
    expect(r4.latencyMs).toBeLessThan(RESPONSE_TIMEOUT_MS);

    // --- 5. Multi-domain synthesis ---
    const r5 = await sendAndMeasure(
      page,
      "multi-domain",
      "Give me a comprehensive overview: my biggest health risks, what supplements address them, and what exercise changes I should make.",
    );
    logResult(r5);
    expect(r5.latencyMs).toBeLessThan(RESPONSE_TIMEOUT_MS);

    // --- Summary ---
    console.log("\n[BENCH] === SUMMARY ===");
    console.log(`[BENCH] Total scenarios: ${results.length}`);

    const latencies = results.map((r) => r.latencyMs);
    const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    const p50 = latencies.sort((a, b) => a - b)[Math.floor(latencies.length / 2)]!;
    const p95 = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)]!;
    const max = Math.max(...latencies);

    console.log(`[BENCH] Avg: ${avg}ms | P50: ${p50}ms | P95: ${p95}ms | Max: ${max}ms`);

    for (const r of results) {
      logResult(r);
    }

    // Hard ceiling: no single turn should exceed 30s
    for (const r of results) {
      expect(r.latencyMs).toBeLessThan(30_000);
    }
  });
});

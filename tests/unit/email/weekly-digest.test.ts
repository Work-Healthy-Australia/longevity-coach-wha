import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Resend before importing the module
const mockSend = vi.fn().mockResolvedValue({ id: "mock-id" });
vi.mock("@/lib/email/client", () => ({
  getResend: () => ({ emails: { send: mockSend } }),
  getFromAddress: () => "noreply@longevity-coach.io",
}));

import { sendWeeklyDigestEmail } from "@/lib/email/weekly-digest";

const baseArgs = {
  to: "test@example.com",
  firstName: "Dave",
  appUrl: "https://longevity-coach.io",
  daysLogged: 5,
  avgSleep: 7.2,
  avgMood: 7.5,
  avgEnergy: 6.8,
  avgSteps: 8500,
  openAlerts: 0,
};

describe("sendWeeklyDigestEmail", () => {
  beforeEach(() => {
    mockSend.mockClear();
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "test@test.com";
  });

  it("sends email with correct subject", async () => {
    await sendWeeklyDigestEmail(baseArgs);
    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockSend.mock.calls[0][0].subject).toBe("Your week in review");
  });

  it("includes first name in greeting", async () => {
    await sendWeeklyDigestEmail(baseArgs);
    const html = mockSend.mock.calls[0][0].html as string;
    expect(html).toContain("Hi Dave,");
  });

  it("shows strong-week headline for 5+ days", async () => {
    await sendWeeklyDigestEmail({ ...baseArgs, daysLogged: 6 });
    const html = mockSend.mock.calls[0][0].html as string;
    expect(html).toContain("Strong week");
    expect(html).toContain("6 of 7 days");
  });

  it("shows neutral headline for 1-4 days", async () => {
    await sendWeeklyDigestEmail({ ...baseArgs, daysLogged: 3 });
    const html = mockSend.mock.calls[0][0].html as string;
    expect(html).toContain("3 of 7 days");
    expect(html).not.toContain("Strong week");
  });

  it("shows light-week headline for 0 days", async () => {
    await sendWeeklyDigestEmail({ ...baseArgs, daysLogged: 0 });
    const html = mockSend.mock.calls[0][0].html as string;
    expect(html).toContain("light on logs");
  });

  it("includes sleep, mood, energy, steps stats", async () => {
    await sendWeeklyDigestEmail(baseArgs);
    const html = mockSend.mock.calls[0][0].html as string;
    expect(html).toContain("7.2");  // sleep
    expect(html).toContain("7.5");  // mood
    expect(html).toContain("6.8");  // energy
    expect(html).toContain("8,500"); // steps formatted
  });

  it("shows dash for null stats", async () => {
    await sendWeeklyDigestEmail({
      ...baseArgs,
      avgSleep: null,
      avgMood: null,
      avgEnergy: null,
      avgSteps: null,
    });
    const html = mockSend.mock.calls[0][0].html as string;
    // Should contain em-dash placeholders
    const dashCount = (html.match(/—/g) || []).length;
    expect(dashCount).toBeGreaterThanOrEqual(4);
  });

  it("shows open alerts count when > 0", async () => {
    await sendWeeklyDigestEmail({ ...baseArgs, openAlerts: 3 });
    const html = mockSend.mock.calls[0][0].html as string;
    expect(html).toContain("<strong>3</strong>");
    expect(html).toContain("alerts");
  });

  it("hides alert section when 0 alerts", async () => {
    await sendWeeklyDigestEmail({ ...baseArgs, openAlerts: 0 });
    const html = mockSend.mock.calls[0][0].html as string;
    expect(html).not.toContain("open alert");
  });

  it("includes dashboard CTA link", async () => {
    await sendWeeklyDigestEmail(baseArgs);
    const html = mockSend.mock.calls[0][0].html as string;
    expect(html).toContain("https://longevity-coach.io/dashboard");
  });

  it("includes unsubscribe link to account page", async () => {
    await sendWeeklyDigestEmail(baseArgs);
    const html = mockSend.mock.calls[0][0].html as string;
    expect(html).toContain("https://longevity-coach.io/account");
    expect(html).toContain("Turn off");
  });

  it("no-ops silently when RESEND_API_KEY is unset", async () => {
    delete process.env.RESEND_API_KEY;
    await sendWeeklyDigestEmail(baseArgs);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("uses generic greeting when firstName is null", async () => {
    await sendWeeklyDigestEmail({ ...baseArgs, firstName: null });
    const html = mockSend.mock.calls[0][0].html as string;
    expect(html).toContain("Hello,");
    expect(html).not.toContain("Hi null");
  });

  it("handles singular alert text", async () => {
    await sendWeeklyDigestEmail({ ...baseArgs, openAlerts: 1 });
    const html = mockSend.mock.calls[0][0].html as string;
    expect(html).toContain("alert");
    expect(html).not.toContain("alerts");
  });
});

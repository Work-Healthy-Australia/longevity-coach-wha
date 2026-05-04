import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockVerifyOtp, mockExchangeCodeForSession, mockGetUser, mockSendWelcomeEmail } = vi.hoisted(() => ({
  mockVerifyOtp: vi.fn(),
  mockExchangeCodeForSession: vi.fn(),
  mockGetUser: vi.fn(),
  mockSendWelcomeEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      verifyOtp: mockVerifyOtp,
      exchangeCodeForSession: mockExchangeCodeForSession,
      getUser: mockGetUser,
    },
  })),
}));

vi.mock("@/lib/email/welcome", () => ({
  sendWelcomeEmail: mockSendWelcomeEmail,
}));

import { GET } from "@/app/auth/callback/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyOtp.mockResolvedValue({ error: null });
  mockExchangeCodeForSession.mockResolvedValue({ error: null });
  mockGetUser.mockResolvedValue({ data: { user: null } });
  mockSendWelcomeEmail.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.resetAllMocks();
});

function buildRequest(qs: string): NextRequest {
  return new NextRequest(`http://localhost/auth/callback?${qs}`);
}

function locationOf(res: Response): string {
  return res.headers.get("location") ?? "";
}

describe("/auth/callback — next-param resolution", () => {
  it("token_hash + type=email + valid next → redirects to /<next>", async () => {
    const res = await GET(buildRequest("token_hash=t&type=email&next=/insights"));
    expect(res.status).toBe(307);
    expect(locationOf(res)).toMatch(/\/insights$/);
  });

  it("token_hash + type=signup + valid next → /email-confirmed?next=<next>", async () => {
    const res = await GET(buildRequest("token_hash=t&type=signup&next=/insights"));
    expect(res.status).toBe(307);
    expect(locationOf(res)).toMatch(/\/email-confirmed\?next=%2Finsights$/);
  });

  it("token_hash + type=signup + missing next → /email-confirmed?next=%2Fdashboard", async () => {
    const res = await GET(buildRequest("token_hash=t&type=signup"));
    expect(res.status).toBe(307);
    expect(locationOf(res)).toMatch(/\/email-confirmed\?next=%2Fdashboard$/);
  });

  it("token_hash + type=email + open-redirect attempt → /dashboard", async () => {
    const res = await GET(buildRequest("token_hash=t&type=email&next=//evil.com"));
    expect(res.status).toBe(307);
    expect(locationOf(res)).toMatch(/\/dashboard$/);
  });

  it("token_hash + type=signup + open-redirect attempt → /email-confirmed?next=%2Fdashboard", async () => {
    const res = await GET(buildRequest("token_hash=t&type=signup&next=//evil.com"));
    expect(res.status).toBe(307);
    expect(locationOf(res)).toMatch(/\/email-confirmed\?next=%2Fdashboard$/);
  });

  it("token_hash + type=recovery + next=/reset-password → /reset-password", async () => {
    const res = await GET(buildRequest("token_hash=t&type=recovery&next=/reset-password"));
    expect(res.status).toBe(307);
    expect(locationOf(res)).toMatch(/\/reset-password$/);
  });

  it("token_hash + type=recovery + missing next → /reset-password (defensive default)", async () => {
    const res = await GET(buildRequest("token_hash=t&type=recovery"));
    expect(res.status).toBe(307);
    expect(locationOf(res)).toMatch(/\/reset-password$/);
  });

  it("token_hash + type=recovery + attacker next=/insights → /reset-password + console.warn", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await GET(buildRequest("token_hash=t&type=recovery&next=/insights"));
    expect(res.status).toBe(307);
    expect(locationOf(res)).toMatch(/\/reset-password$/);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it("code path + valid next → /<next>", async () => {
    const res = await GET(buildRequest("code=abc&next=/insights"));
    expect(res.status).toBe(307);
    expect(locationOf(res)).toMatch(/\/insights$/);
  });

  it("verifyOtp returns error → /login?error=auth_callback_failed", async () => {
    mockVerifyOtp.mockResolvedValue({ error: { message: "bad token" } });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(buildRequest("token_hash=t&type=email&next=/insights"));
    expect(res.status).toBe(307);
    expect(locationOf(res)).toMatch(/\/login\?error=auth_callback_failed$/);
    errSpy.mockRestore();
  });

  it("exchangeCodeForSession returns error → /login?error=auth_callback_failed", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: { message: "bad code" } });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(buildRequest("code=abc"));
    expect(res.status).toBe(307);
    expect(locationOf(res)).toMatch(/\/login\?error=auth_callback_failed$/);
    errSpy.mockRestore();
  });

  it("neither token_hash nor code → /login?error=auth_callback_failed", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(buildRequest(""));
    expect(res.status).toBe(307);
    expect(locationOf(res)).toMatch(/\/login\?error=auth_callback_failed$/);
    errSpy.mockRestore();
  });
});

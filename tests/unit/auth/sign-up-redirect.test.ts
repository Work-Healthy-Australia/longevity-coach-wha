import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSignUp, mockRedirect } = vi.hoisted(() => ({
  mockSignUp: vi.fn(),
  mockRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signUp: mockSignUp,
    },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (key: string) => {
      if (key === "x-forwarded-proto") return "https";
      if (key === "host") return "example.com";
      if (key === "x-forwarded-host") return null;
      return null;
    },
  })),
}));

import { signUp } from "@/app/(auth)/actions";

beforeEach(() => {
  vi.clearAllMocks();
  mockSignUp.mockResolvedValue({ error: null });
  mockRedirect.mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  });
});

afterEach(() => {
  vi.resetAllMocks();
});

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("signUp — redirect resolution", () => {
  it("auth success + valid redirect → carries through to verify-email AND emailRedirectTo", async () => {
    await expect(
      signUp(
        {},
        fd({
          email: "u@x.com",
          password: "secret123",
          full_name: "U X",
          redirect: "/insights",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/verify-email?email=u%40x.com&redirect=%2Finsights");

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: "https://example.com/auth/callback?next=%2Finsights",
        }),
      }),
    );
  });

  it("auth success + open-redirect attempt → sanitised to /dashboard, no &redirect= on verify-email URL", async () => {
    await expect(
      signUp(
        {},
        fd({
          email: "u@x.com",
          password: "secret123",
          full_name: "U X",
          redirect: "//evil.com",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/verify-email?email=u%40x.com");

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: "https://example.com/auth/callback?next=%2Fdashboard",
        }),
      }),
    );
  });

  it("auth success + missing redirect → no &redirect= on verify-email URL", async () => {
    await expect(
      signUp(
        {},
        fd({ email: "u@x.com", password: "secret123", full_name: "U X" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/verify-email?email=u%40x.com");
  });

  it("auth success + redirect=/login (auth loop) → sanitised away", async () => {
    await expect(
      signUp(
        {},
        fd({
          email: "u@x.com",
          password: "secret123",
          full_name: "U X",
          redirect: "/login",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/verify-email?email=u%40x.com");

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: "https://example.com/auth/callback?next=%2Fdashboard",
        }),
      }),
    );
  });

  it("auth error from Supabase → returns error, no redirect", async () => {
    mockSignUp.mockResolvedValue({ error: { message: "User already registered" } });

    const result = await signUp(
      {},
      fd({
        email: "u@x.com",
        password: "secret123",
        full_name: "U X",
        redirect: "/insights",
      }),
    );

    expect(result).toEqual({
      error: "User already registered",
      values: { email: "u@x.com", full_name: "U X" },
    });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("missing email → returns error, no auth call, no redirect", async () => {
    const result = await signUp(
      {},
      fd({ password: "secret123", full_name: "U X", redirect: "/insights" }),
    );

    expect(result).toEqual({
      error: "Email and password are required.",
      values: { email: "", full_name: "U X" },
    });
    expect(mockSignUp).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("password too short → returns error, no auth call, no redirect", async () => {
    const result = await signUp(
      {},
      fd({
        email: "u@x.com",
        password: "short",
        full_name: "U X",
        redirect: "/insights",
      }),
    );

    expect(result).toEqual({
      error: "Password must be at least 8 characters.",
      values: { email: "u@x.com", full_name: "U X" },
    });
    expect(mockSignUp).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

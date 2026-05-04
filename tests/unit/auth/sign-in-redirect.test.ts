import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSignInWithPassword, mockRedirect } = vi.hoisted(() => ({
  mockSignInWithPassword: vi.fn(),
  mockRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
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
    get: () => null,
  })),
}));

import { signIn } from "@/app/(auth)/actions";

beforeEach(() => {
  vi.clearAllMocks();
  mockSignInWithPassword.mockResolvedValue({ error: null });
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

describe("signIn — redirect resolution", () => {
  it("auth success + valid redirect → throws NEXT_REDIRECT to that path", async () => {
    await expect(
      signIn({}, fd({ email: "u@x.com", password: "secret123", redirect: "/insights" })),
    ).rejects.toThrow("NEXT_REDIRECT:/insights");
  });

  it("auth success + redirect with query string → preserved", async () => {
    await expect(
      signIn({}, fd({ email: "u@x.com", password: "secret123", redirect: "/insights?tab=heart" })),
    ).rejects.toThrow("NEXT_REDIRECT:/insights?tab=heart");
  });

  it("auth success + open-redirect attempt (//evil.com) → falls back to /dashboard", async () => {
    await expect(
      signIn({}, fd({ email: "u@x.com", password: "secret123", redirect: "//evil.com" })),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("auth success + missing redirect → /dashboard", async () => {
    await expect(
      signIn({}, fd({ email: "u@x.com", password: "secret123" })),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("auth success + empty-string redirect → /dashboard", async () => {
    await expect(
      signIn({}, fd({ email: "u@x.com", password: "secret123", redirect: "" })),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("auth success + redirect=/login (loop) → /dashboard", async () => {
    await expect(
      signIn({}, fd({ email: "u@x.com", password: "secret123", redirect: "/login" })),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("auth error from Supabase → returns error, no redirect", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    const result = await signIn(
      {},
      fd({ email: "u@x.com", password: "wrong", redirect: "/insights" }),
    );

    expect(result).toEqual({
      error: "Invalid login credentials",
      values: { email: "u@x.com" },
    });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("missing email → returns error, no auth call, no redirect", async () => {
    const result = await signIn({}, fd({ password: "secret123", redirect: "/insights" }));

    expect(result).toEqual({
      error: "Email and password are required.",
      values: { email: "" },
    });
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("missing password → returns error, no auth call, no redirect", async () => {
    const result = await signIn({}, fd({ email: "u@x.com", redirect: "/insights" }));

    expect(result).toEqual({
      error: "Email and password are required.",
      values: { email: "u@x.com" },
    });
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

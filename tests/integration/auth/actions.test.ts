import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signOut: mockSignOut,
      resetPasswordForEmail: mockResetPasswordForEmail,
      updateUser: mockUpdateUser,
    },
  })),
}));

import {
  signIn,
  signUp,
  requestPasswordReset,
  updatePassword,
} from "@/app/(auth)/actions";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.resetAllMocks();
});

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("signIn", () => {
  it("rejects empty email or password", async () => {
    const r = await signIn({}, fd({ email: "", password: "" }));
    expect(r.error).toBe("Email and password are required.");
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it("trims the email before calling Supabase", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });
    try {
      await signIn({}, fd({ email: "  user@example.com  ", password: "pw" }));
    } catch {
      // signIn redirects on success
    }
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "pw",
    });
  });

  it("returns Supabase error message when sign-in fails", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      error: { message: "Invalid login credentials" },
    });
    const r = await signIn({}, fd({ email: "u@e.com", password: "wrong" }));
    expect(r.error).toBe("Invalid login credentials");
  });

  it("redirects to /dashboard on success", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });
    await expect(
      signIn({}, fd({ email: "u@e.com", password: "right" })),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });
});

describe("signUp", () => {
  it("rejects empty email or password", async () => {
    const r = await signUp({}, fd({ email: "", password: "" }));
    expect(r.error).toBe("Email and password are required.");
  });

  it("rejects passwords shorter than 8 characters", async () => {
    const r = await signUp({}, fd({ email: "u@e.com", password: "short" }));
    expect(r.error).toBe("Password must be at least 8 characters.");
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("passes the full_name through to Supabase metadata", async () => {
    mockSignUp.mockResolvedValueOnce({ error: null });
    try {
      await signUp(
        {},
        fd({ email: "u@e.com", password: "longenough", full_name: "Jane Doe" }),
      );
    } catch {
      // redirect
    }
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "u@e.com",
        password: "longenough",
        options: expect.objectContaining({
          data: { full_name: "Jane Doe" },
        }),
      }),
    );
  });

  it("redirects to /verify-email with the encoded email on success", async () => {
    mockSignUp.mockResolvedValueOnce({ error: null });
    await expect(
      signUp({}, fd({ email: "u+tag@example.com", password: "longenough" })),
    ).rejects.toThrow("NEXT_REDIRECT:/verify-email?email=u%2Btag%40example.com");
  });

  it("surfaces Supabase signup errors", async () => {
    mockSignUp.mockResolvedValueOnce({
      error: { message: "User already registered" },
    });
    const r = await signUp({}, fd({ email: "dup@e.com", password: "longenough" }));
    expect(r.error).toBe("User already registered");
  });
});

describe("requestPasswordReset", () => {
  it("rejects empty email", async () => {
    const r = await requestPasswordReset({}, fd({ email: "" }));
    expect(r.error).toBe("Email is required.");
  });

  it("returns a non-enumerable success message even if Supabase returns ok", async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });
    const r = await requestPasswordReset({}, fd({ email: "u@e.com" }));
    expect(r.success).toMatch(/If an account exists/i);
  });

  it("surfaces Supabase errors when the call fails", async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({
      error: { message: "Network error" },
    });
    const r = await requestPasswordReset({}, fd({ email: "u@e.com" }));
    expect(r.error).toBe("Network error");
  });
});

describe("updatePassword", () => {
  it("rejects passwords shorter than 8 characters", async () => {
    const r = await updatePassword({}, fd({ password: "short" }));
    expect(r.error).toBe("Password must be at least 8 characters.");
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("redirects to /dashboard on success", async () => {
    mockUpdateUser.mockResolvedValueOnce({ error: null });
    await expect(
      updatePassword({}, fd({ password: "longenough" })),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("surfaces Supabase errors", async () => {
    mockUpdateUser.mockResolvedValueOnce({
      error: { message: "Token expired" },
    });
    const r = await updatePassword({}, fd({ password: "longenough" }));
    expect(r.error).toBe("Token expired");
  });
});

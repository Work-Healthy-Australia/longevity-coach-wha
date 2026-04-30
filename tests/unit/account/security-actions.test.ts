import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
      updateUser: mockUpdateUser,
    },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (key: string) => {
      if (key === "x-forwarded-proto") return "https";
      if (key === "host") return "example.com";
      return null;
    },
  })),
}));

import {
  changeEmail,
  changePassword,
  emailSchema,
  passwordSchema,
} from "@/app/(app)/account/security-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({
    data: { user: { id: "u1", email: "old@example.com" } },
  });
  mockUpdateUser.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.resetAllMocks();
});

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("passwordSchema", () => {
  it("accepts a valid matching pair", () => {
    const r = passwordSchema.safeParse({
      password: "supersecret",
      confirm_password: "supersecret",
    });
    expect(r.success).toBe(true);
  });

  it("rejects passwords shorter than 8 chars", () => {
    const r = passwordSchema.safeParse({
      password: "short",
      confirm_password: "short",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/at least 8/);
    }
  });

  it("rejects mismatched confirmation", () => {
    const r = passwordSchema.safeParse({
      password: "supersecret",
      confirm_password: "different1",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/do not match/);
    }
  });
});

describe("emailSchema", () => {
  it("accepts a valid email and trims whitespace", () => {
    const r = emailSchema.safeParse({ new_email: "  user@example.com  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.new_email).toBe("user@example.com");
  });

  it("rejects malformed email", () => {
    const r = emailSchema.safeParse({ new_email: "not-an-email" });
    expect(r.success).toBe(false);
  });
});

describe("changePassword", () => {
  it("rejects validation failure without calling Supabase", async () => {
    const r = await changePassword(
      null,
      fd({ password: "short", confirm_password: "short" }),
    );
    expect(r.error).toMatch(/at least 8/);
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("rejects when not signed in", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const r = await changePassword(
      null,
      fd({ password: "supersecret", confirm_password: "supersecret" }),
    );
    expect(r.error).toBe("Not signed in.");
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("calls auth.updateUser with new password and never echoes it", async () => {
    const r = await changePassword(
      null,
      fd({ password: "supersecret", confirm_password: "supersecret" }),
    );
    expect(r.success).toBe("Password updated.");
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: "supersecret" });
    // Critical security check — never return password values
    expect(JSON.stringify(r)).not.toContain("supersecret");
  });

  it("returns Supabase error message on auth failure", async () => {
    mockUpdateUser.mockResolvedValueOnce({
      error: { message: "Password is too weak" },
    });
    const r = await changePassword(
      null,
      fd({ password: "supersecret", confirm_password: "supersecret" }),
    );
    expect(r.error).toBe("Password is too weak");
  });
});

describe("changeEmail", () => {
  it("rejects malformed email and echoes submitted value", async () => {
    const r = await changeEmail(null, fd({ new_email: "nope" }));
    expect(r.error).toBeDefined();
    expect(r.values?.new_email).toBe("nope");
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("rejects same-as-current email (case-insensitive)", async () => {
    const r = await changeEmail(null, fd({ new_email: "OLD@example.com" }));
    expect(r.error).toMatch(/already your current/);
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("calls auth.updateUser with emailRedirectTo pointed at /account", async () => {
    const r = await changeEmail(null, fd({ new_email: "new@example.com" }));
    expect(r.success).toMatch(/Verification email sent/);
    expect(mockUpdateUser).toHaveBeenCalledWith(
      { email: "new@example.com" },
      { emailRedirectTo: "https://example.com/auth/callback?next=/account" },
    );
  });

  it("surfaces Supabase error", async () => {
    mockUpdateUser.mockResolvedValueOnce({
      error: { message: "Email rate limit exceeded" },
    });
    const r = await changeEmail(null, fd({ new_email: "new@example.com" }));
    expect(r.error).toBe("Email rate limit exceeded");
  });
});

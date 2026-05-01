import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({ update: mockUpdate })),
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { identitySchema } from "@/app/(app)/account/identity-schema";
import { updateIdentity } from "@/app/(app)/account/identity-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockEq.mockResolvedValue({ error: null });
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
});

afterEach(() => {
  vi.resetAllMocks();
});

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("identitySchema", () => {
  it("accepts a valid full payload", () => {
    const r = identitySchema.safeParse({
      full_name: "Jane Smith",
      date_of_birth: "1990-05-12",
      phone: "+61 400 000 000",
      address_postal: "12 Example St, Sydney NSW 2000",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.full_name).toBe("Jane Smith");
      expect(r.data.date_of_birth).toBe("1990-05-12");
      expect(r.data.phone).toBe("+61 400 000 000");
    }
  });

  it("coerces empty optionals to null", () => {
    const r = identitySchema.safeParse({
      full_name: "Jane Smith",
      date_of_birth: "",
      phone: "",
      address_postal: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.date_of_birth).toBeNull();
      expect(r.data.phone).toBeNull();
      expect(r.data.address_postal).toBeNull();
    }
  });

  it("trims phone and address whitespace", () => {
    const r = identitySchema.safeParse({
      full_name: "Jane Smith",
      date_of_birth: "",
      phone: "  0400000000  ",
      address_postal: "  12 Example St  ",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.phone).toBe("0400000000");
      expect(r.data.address_postal).toBe("12 Example St");
    }
  });

  it("rejects names shorter than 2 characters", () => {
    const r = identitySchema.safeParse({
      full_name: "J",
      date_of_birth: "",
      phone: "",
      address_postal: "",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/at least 2 characters/);
    }
  });

  it("rejects malformed DOB", () => {
    const r = identitySchema.safeParse({
      full_name: "Jane Smith",
      date_of_birth: "12/05/1990",
      phone: "",
      address_postal: "",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/YYYY-MM-DD/);
    }
  });

  it("rejects DOB in the future", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const iso = future.toISOString().slice(0, 10);
    const r = identitySchema.safeParse({
      full_name: "Jane Smith",
      date_of_birth: iso,
      phone: "",
      address_postal: "",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/in the past/);
    }
  });

  it("rejects users under 13", () => {
    const recent = new Date();
    recent.setFullYear(recent.getFullYear() - 5);
    const iso = recent.toISOString().slice(0, 10);
    const r = identitySchema.safeParse({
      full_name: "Jane Smith",
      date_of_birth: iso,
      phone: "",
      address_postal: "",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/at least 13/);
    }
  });
});

describe("updateIdentity", () => {
  it("returns error when not signed in", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const r = await updateIdentity(
      null,
      fd({
        full_name: "Jane Smith",
        date_of_birth: "1990-01-01",
        phone: "",
        address_postal: "",
      }),
    );
    expect(r.error).toBe("Not signed in.");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns validation error and echoes submitted values", async () => {
    const r = await updateIdentity(
      null,
      fd({
        full_name: "J",
        date_of_birth: "",
        phone: "",
        address_postal: "",
      }),
    );
    expect(r.error).toMatch(/at least 2 characters/);
    expect(r.values?.full_name).toBe("J");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("writes to profiles and returns success on valid input", async () => {
    const r = await updateIdentity(
      null,
      fd({
        full_name: "Jane Smith",
        date_of_birth: "1990-05-12",
        phone: "0400000000",
        address_postal: "12 Example St",
      }),
    );
    expect(r.success).toBe("Saved.");
    expect(mockUpdate).toHaveBeenCalledWith({
      full_name: "Jane Smith",
      date_of_birth: "1990-05-12",
      phone: "0400000000",
      address_postal: "12 Example St",
    });
    expect(mockEq).toHaveBeenCalledWith("id", "u1");
  });

  it("returns Supabase error message when update fails", async () => {
    mockEq.mockResolvedValueOnce({ error: { message: "DB exploded" } });
    const r = await updateIdentity(
      null,
      fd({
        full_name: "Jane Smith",
        date_of_birth: "1990-01-01",
        phone: "",
        address_postal: "",
      }),
    );
    expect(r.error).toBe("DB exploded");
  });
});

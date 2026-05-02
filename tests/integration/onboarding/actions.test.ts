import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockHealthMaybeSingle = vi.fn();

// per-table mock chains so we can assert profiles vs health_profiles writes
const mockProfilesUpdateEq = vi.fn(() => Promise.resolve({ error: null }));
const mockProfilesUpdate = vi.fn(() => ({ eq: mockProfilesUpdateEq }));

const mockHealthSelect = vi.fn(() => ({
  eq: vi.fn(() => ({
    is: vi.fn(() => ({
      maybeSingle: mockHealthMaybeSingle,
    })),
  })),
}));
const mockHealthUpdate = vi.fn(() => ({
  eq: vi.fn(() => Promise.resolve({ error: null })),
}));
const mockHealthInsert = vi.fn(() => Promise.resolve({ error: null }));

const mockFrom = vi.fn((table: string) => {
  if (table === "profiles") {
    return { update: mockProfilesUpdate };
  }
  return {
    select: mockHealthSelect,
    update: mockHealthUpdate,
    insert: mockHealthInsert,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

import { saveDraft, submitAssessment } from "@/app/(app)/onboarding/actions";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("saveDraft", () => {
  it("returns an error when no user is signed in", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await saveDraft({});
    expect(result.error).toBe("Not signed in");
  });

  it("inserts a new draft when none exists, with PII stripped from responses", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockHealthMaybeSingle.mockResolvedValueOnce({ data: null });

    const result = await saveDraft({
      basics: {
        date_of_birth: "1990-04-15",
        phone_mobile: "+61400000000",
        address_postal: "1 Test St, Sydney",
        sex: "Male",
        height_cm: 180,
      },
    });

    expect(result.ok).toBe(true);

    // PII routed to profiles.update
    expect(mockProfilesUpdate).toHaveBeenCalledTimes(1);
    const profileArg = mockProfilesUpdate.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
    expect(profileArg.date_of_birth).toBe("1990-04-15");
    expect(profileArg.phone).toBe("+61400000000");
    expect(profileArg.address_postal).toBe("1 Test St, Sydney");

    // Responses to health_profiles must NOT contain PII keys
    const healthArg = mockHealthInsert.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
    const cleanedBasics = (healthArg.responses as Record<string, Record<string, unknown>>)
      .basics;
    expect(cleanedBasics.sex).toBe("Male");
    expect(cleanedBasics.height_cm).toBe(180);
    expect(cleanedBasics.date_of_birth).toBeUndefined();
    expect(cleanedBasics.phone_mobile).toBeUndefined();
    expect(cleanedBasics.address_postal).toBeUndefined();
  });

  it("updates the existing draft when one exists", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockHealthMaybeSingle.mockResolvedValueOnce({ data: { id: "draft-1" } });

    const result = await saveDraft({ basics: { sex: "Female" } });

    expect(result.ok).toBe(true);
    expect(mockHealthUpdate).toHaveBeenCalled();
    expect(mockHealthInsert).not.toHaveBeenCalled();
    // No PII fields touched → no profiles.update call
    expect(mockProfilesUpdate).not.toHaveBeenCalled();
  });

  it("does not call profiles.update when no PII fields are present", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockHealthMaybeSingle.mockResolvedValueOnce({ data: null });

    await saveDraft({ medical: { conditions: ["None"] } });

    expect(mockProfilesUpdate).not.toHaveBeenCalled();
    expect(mockHealthInsert).toHaveBeenCalled();
  });
});

describe("submitAssessment", () => {
  it("returns an error when no user is signed in", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await submitAssessment({});
    expect(result.error).toBe("Not signed in");
  });

  it("sets completed_at when finalising an existing draft and writes PII to profiles", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockHealthMaybeSingle.mockResolvedValueOnce({ data: { id: "draft-1" } });

    try {
      await submitAssessment({
        basics: {
          date_of_birth: "1985-12-01",
          phone_mobile: "+61411111111",
          sex: "Female",
        },
      });
    } catch (err) {
      expect((err as Error).message).toContain("NEXT_REDIRECT");
    }

    expect(mockProfilesUpdate).toHaveBeenCalledTimes(1);
    const profileArg = mockProfilesUpdate.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
    expect(profileArg.date_of_birth).toBe("1985-12-01");
    expect(profileArg.phone).toBe("+61411111111");

    expect(mockHealthUpdate).toHaveBeenCalled();
    const updateArg = mockHealthUpdate.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
    expect(updateArg.completed_at).toBeDefined();
    const basics = (updateArg.responses as Record<string, Record<string, unknown>>).basics;
    expect(basics.date_of_birth).toBeUndefined();
    expect(basics.sex).toBe("Female");
  });

  it("inserts with completed_at when no draft exists", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockHealthMaybeSingle.mockResolvedValueOnce({ data: null });

    try {
      await submitAssessment({ basics: { sex: "Male" } });
    } catch (err) {
      expect((err as Error).message).toContain("NEXT_REDIRECT");
    }

    expect(mockHealthInsert).toHaveBeenCalled();
    const insertArg = mockHealthInsert.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
    expect(insertArg.user_uuid).toBe("user-123");
    expect(insertArg.completed_at).toBeDefined();
  });

  it("redirects to /dashboard?onboarding=complete on success", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockHealthMaybeSingle.mockResolvedValueOnce({ data: null });

    await expect(submitAssessment({})).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard?onboarding=complete",
    );
  });
});

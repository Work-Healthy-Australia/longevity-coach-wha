import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSelect = vi.fn(() => ({
  eq: vi.fn(() => ({
    is: vi.fn(() => ({
      maybeSingle: mockMaybeSingle,
    })),
  })),
}));
const mockUpdate = vi.fn(() => ({
  eq: vi.fn(() => Promise.resolve({ error: null })),
}));
const mockInsert = vi.fn(() => Promise.resolve({ error: null }));

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  update: mockUpdate,
  insert: mockInsert,
}));

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

  it("inserts a new draft when none exists", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: null });

    const result = await saveDraft({ basics: { first_name: "Jane" } });

    expect(result.ok).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith({
      user_uuid: "user-123",
      responses: { basics: { first_name: "Jane" } },
    });
  });

  it("updates the existing draft when one exists", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: "draft-1" } });

    const result = await saveDraft({ basics: { first_name: "Updated" } });

    expect(result.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    const updateArg = mockUpdate.mock.calls[0]![0] as Record<string, unknown>;
    expect(updateArg.responses).toEqual({ basics: { first_name: "Updated" } });
    expect(updateArg.updated_at).toBeDefined();
  });
});

describe("submitAssessment", () => {
  it("returns an error when no user is signed in", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await submitAssessment({});
    expect(result.error).toBe("Not signed in");
  });

  it("sets completed_at when finalising an existing draft", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: "draft-1" } });

    try {
      await submitAssessment({ basics: { first_name: "Final" } });
    } catch (err) {
      // submitAssessment redirects on success — surfaces as a thrown NEXT_REDIRECT
      expect((err as Error).message).toContain("NEXT_REDIRECT");
    }

    expect(mockUpdate).toHaveBeenCalled();
    const updateArg = mockUpdate.mock.calls[0]![0] as Record<string, unknown>;
    expect(updateArg.completed_at).toBeDefined();
    expect(updateArg.responses).toEqual({ basics: { first_name: "Final" } });
  });

  it("inserts with completed_at when no draft exists", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: null });

    try {
      await submitAssessment({ basics: { first_name: "Direct" } });
    } catch (err) {
      expect((err as Error).message).toContain("NEXT_REDIRECT");
    }

    expect(mockInsert).toHaveBeenCalled();
    const insertArg = mockInsert.mock.calls[0]![0] as Record<string, unknown>;
    expect(insertArg.user_uuid).toBe("user-123");
    expect(insertArg.completed_at).toBeDefined();
  });

  it("redirects to /dashboard?onboarding=complete on success", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: null });

    await expect(submitAssessment({})).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard?onboarding=complete",
    );
  });
});

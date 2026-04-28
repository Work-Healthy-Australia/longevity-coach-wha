import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/uploads/janet", () => ({
  analyzeUpload: vi.fn(),
}));

vi.mock("@/lib/ai/trigger", () => ({
  triggerPipeline: vi.fn(),
}));

const mockSingle = vi.fn();
const mockEqHash = vi.fn(() => ({ single: mockSingle }));
const mockEqUser = vi.fn(() => ({ eq: mockEqHash }));
const mockSelect = vi.fn(() => ({ eq: mockEqUser }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-abc" } } })),
    },
    from: mockFrom,
  })),
}));

import { checkDuplicate } from "@/app/(app)/uploads/actions";

const VALID_HASH = "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";

beforeEach(() => vi.clearAllMocks());

describe("checkDuplicate", () => {
  it("returns { duplicate: false } when no row exists", async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });
    const result = await checkDuplicate(VALID_HASH);
    expect(result).toEqual({ duplicate: false });
  });

  it("returns duplicate info when a matching row exists", async () => {
    mockSingle.mockResolvedValue({
      data: { original_filename: "blood-work.pdf", created_at: "2026-03-10T07:42:00Z" },
      error: null,
    });
    const result = await checkDuplicate(VALID_HASH);
    expect(result).toEqual({
      duplicate: true,
      originalFilename: "blood-work.pdf",
      uploadedAt: "2026-03-10T07:42:00Z",
    });
  });

  it("returns { duplicate: false } when user is not signed in", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
      from: mockFrom,
    } as never);
    const result = await checkDuplicate(VALID_HASH);
    expect(result).toEqual({ duplicate: false });
  });
});

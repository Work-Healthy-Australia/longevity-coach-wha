import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

vi.mock("@/lib/ai/trigger", () => ({
  triggerPipeline: vi.fn(),
}));

const mockUpsert = vi.fn();
const mockFrom = vi.fn(() => ({ upsert: mockUpsert }));
const mockSchema = vi.fn(() => ({ from: mockFrom }));

const mockGetUser = vi.fn(async () => ({
  data: { user: { id: "user-123" } },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    schema: mockSchema,
  })),
}));

import { saveCheckIn } from "@/app/(app)/check-in/actions";
import { triggerPipeline } from "@/lib/ai/trigger";

function buildForm(overrides: Record<string, string> = {}): FormData {
  const defaults: Record<string, string> = {
    mood: "7",
    energy: "6",
    sleep_hours: "7.5",
    exercise_minutes: "30",
    steps: "8000",
    water_glasses: "8",
    notes: "",
  };
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) fd.set(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("saveCheckIn", () => {
  it("returns error when user is not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await saveCheckIn({}, buildForm());
    expect(result).toEqual({ error: "Not authenticated" });
    expect(triggerPipeline).not.toHaveBeenCalled();
  });

  it("fires Atlas pipeline and returns success on a valid save", async () => {
    mockUpsert.mockResolvedValue({ error: null });
    const result = await saveCheckIn({}, buildForm());
    expect(result).toEqual({ success: true });
    expect(triggerPipeline).toHaveBeenCalledOnce();
    expect(triggerPipeline).toHaveBeenCalledWith("risk-narrative", "user-123");
  });

  it("does NOT fire Atlas pipeline when the upsert fails", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "db error" } });
    const result = await saveCheckIn({}, buildForm());
    expect(result).toEqual({ error: "db error" });
    expect(triggerPipeline).not.toHaveBeenCalled();
  });

  it("does NOT fire Atlas pipeline when form validation fails", async () => {
    const result = await saveCheckIn({}, buildForm({ mood: "0" }));
    expect(result.error).toBeDefined();
    expect(triggerPipeline).not.toHaveBeenCalled();
  });
});

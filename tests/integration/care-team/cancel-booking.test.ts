import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* -------------------------------------------------------------------------- */
/*  Mocks                                                                     */
/* -------------------------------------------------------------------------- */

const mockGetUser = vi.fn();
const mockMaybeSingle = vi.fn();
const mockUpdateEq = vi.fn();
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
const mockSelectEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockSelectEq }));

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  update: mockUpdate,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/loose-table", () => ({
  loose: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { cancelBooking } from "@/app/(app)/care-team/actions";

const PATIENT_UUID = "11111111-2222-3333-4444-555555555555";
const OTHER_PATIENT_UUID = "99999999-8888-7777-6666-555555555555";
const APPOINTMENT_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateEq.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("cancelBooking", () => {
  it("rejects when no user is signed in", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const result = await cancelBooking(APPOINTMENT_UUID);

    expect(result).toEqual({ error: "You must be signed in." });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects malformed appointment ids without making any DB calls", async () => {
    const result = await cancelBooking("not-a-uuid");

    expect("error" in result).toBe(true);
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns not_found when the appointment does not exist", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: PATIENT_UUID } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await cancelBooking(APPOINTMENT_UUID);

    expect(result).toEqual({
      error: "Appointment not found.",
      reason: "not_found",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns wrong_owner when the appointment belongs to another patient", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: PATIENT_UUID } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: APPOINTMENT_UUID,
        patient_uuid: OTHER_PATIENT_UUID,
        status: "confirmed",
        scheduled_at: hoursFromNow(48),
      },
      error: null,
    });

    const result = await cancelBooking(APPOINTMENT_UUID);

    expect(result).toMatchObject({ reason: "wrong_owner" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it.each([
    "cancelled",
    "cancelled_by_patient",
    "cancelled_by_clinician",
    "completed",
    "no_show",
  ])("returns wrong_status when appointment status is %s", async (status) => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: PATIENT_UUID } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: APPOINTMENT_UUID,
        patient_uuid: PATIENT_UUID,
        status,
        scheduled_at: hoursFromNow(48),
      },
      error: null,
    });

    const result = await cancelBooking(APPOINTMENT_UUID);

    expect(result).toMatchObject({ reason: "wrong_status" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns inside_24h when the session is less than 24 hours away and writes nothing", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: PATIENT_UUID } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: APPOINTMENT_UUID,
        patient_uuid: PATIENT_UUID,
        status: "confirmed",
        scheduled_at: hoursFromNow(23.5),
      },
      error: null,
    });

    const result = await cancelBooking(APPOINTMENT_UUID);

    expect(result).toMatchObject({ reason: "inside_24h" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("cancels successfully when the session is exactly at the 24h boundary", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: PATIENT_UUID } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: APPOINTMENT_UUID,
        patient_uuid: PATIENT_UUID,
        status: "confirmed",
        // 24h + 1 minute to dodge the millisecond drift between mock setup and code execution
        scheduled_at: hoursFromNow(24.02),
      },
      error: null,
    });

    const result = await cancelBooking(APPOINTMENT_UUID);

    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({ status: "cancelled_by_patient" });
  });

  it("cancels a confirmed session that is more than 24 hours away", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: PATIENT_UUID } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: APPOINTMENT_UUID,
        patient_uuid: PATIENT_UUID,
        status: "confirmed",
        scheduled_at: hoursFromNow(72),
      },
      error: null,
    });

    const result = await cancelBooking(APPOINTMENT_UUID);

    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({ status: "cancelled_by_patient" });
    expect(mockUpdateEq).toHaveBeenCalledWith("id", APPOINTMENT_UUID);
  });

  it("cancels a pending session that is more than 24 hours away", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: PATIENT_UUID } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: APPOINTMENT_UUID,
        patient_uuid: PATIENT_UUID,
        status: "pending",
        scheduled_at: hoursFromNow(48),
      },
      error: null,
    });

    const result = await cancelBooking(APPOINTMENT_UUID);

    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({ status: "cancelled_by_patient" });
  });

  it("returns a generic error when the DB update fails", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: PATIENT_UUID } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: APPOINTMENT_UUID,
        patient_uuid: PATIENT_UUID,
        status: "confirmed",
        scheduled_at: hoursFromNow(48),
      },
      error: null,
    });
    mockUpdateEq.mockResolvedValueOnce({ error: { message: "RLS violation" } });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await cancelBooking(APPOINTMENT_UUID);

    expect(result).toEqual({ error: "Failed to cancel appointment." });
    errSpy.mockRestore();
  });
});

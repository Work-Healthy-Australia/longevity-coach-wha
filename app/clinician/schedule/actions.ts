"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_REGEX = /^\d{2}:\d{2}$/;

const UpsertAvailabilitySchema = z.object({
  day: z.number().int().min(0).max(6),
  startTime: z.string().regex(TIME_REGEX, "Start time must be HH:MM"),
  endTime: z.string().regex(TIME_REGEX, "End time must be HH:MM"),
});

const DeleteAvailabilitySchema = z.object({
  id: z.string().regex(UUID_REGEX, "id must be a valid UUID"),
});

const AppointmentIdSchema = z.object({
  appointmentId: z.string().regex(UUID_REGEX, "appointmentId must be a valid UUID"),
});

const DeclineSchema = z.object({
  appointmentId: z.string().regex(UUID_REGEX, "appointmentId must be a valid UUID"),
  reason: z.string().max(500).optional(),
});

type ActionSuccess = { success: true };
type ActionError = { error: string };

export async function upsertAvailabilitySlot(
  day: number,
  startTime: string,
  endTime: string
): Promise<ActionSuccess | ActionError> {
  const parsed = UpsertAvailabilitySchema.safeParse({ day, startTime, endTime });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  if (endTime <= startTime) {
    return { error: "End time must be after start time." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("clinician_availability")
    .insert({
      clinician_uuid: user.id,
      day_of_week: day,
      start_time: startTime,
      end_time: endTime,
      is_active: true,
    });

  if (error) {
    // Postgres unique constraint violation code
    if (error.code === "23505") {
      return { error: "Slot already exists for that time." };
    }
    return { error: error.message };
  }

  return { success: true };
}

export async function deleteAvailabilitySlot(
  id: string
): Promise<ActionSuccess | ActionError> {
  const parsed = DeleteAvailabilitySchema.safeParse({ id });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid id." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("clinician_availability")
    .delete()
    .eq("id", id)
    .eq("clinician_uuid", user.id);

  if (error) return { error: error.message };

  return { success: true };
}

export async function acceptBookingRequest(
  appointmentId: string
): Promise<ActionSuccess | ActionError> {
  const parsed = AppointmentIdSchema.safeParse({ appointmentId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid appointment id." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("appointments")
    .update({
      status: "confirmed",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", appointmentId)
    .eq("clinician_uuid", user.id)
    .eq("status", "pending");

  if (error) return { error: error.message };

  return { success: true };
}

export async function declineBookingRequest(
  appointmentId: string,
  reason?: string
): Promise<ActionSuccess | ActionError> {
  const parsed = DeclineSchema.safeParse({ appointmentId, reason });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId)
    .eq("clinician_uuid", user.id)
    .eq("status", "pending");

  if (error) return { error: error.message };

  return { success: true };
}

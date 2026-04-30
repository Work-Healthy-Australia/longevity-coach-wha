"use server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { loose } from "@/lib/supabase/loose-table";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RequestBookingSchema = z.object({
  clinicianUuid: z.string().regex(UUID_REGEX, "clinicianUuid must be a valid UUID"),
  scheduledAt: z.string().refine((val) => {
    const d = new Date(val);
    return !isNaN(d.getTime()) && d > new Date();
  }, "scheduledAt must be a valid future ISO 8601 datetime"),
  patientNotes: z.string().max(500),
});

export async function requestBooking(
  clinicianUuid: string,
  scheduledAt: string,
  patientNotes: string
): Promise<{ success: true; appointmentId: string } | { error: string }> {
  // Validate inputs
  const parsed = RequestBookingSchema.safeParse({
    clinicianUuid,
    scheduledAt,
    patientNotes,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // Verify the clinician is the patient's assigned clinician
  const { data: assignment } = await supabase
    .from("patient_assignments")
    .select("clinician_uuid")
    .eq("patient_uuid", user.id)
    .eq("clinician_uuid", clinicianUuid)
    .eq("status", "active")
    .maybeSingle();

  if (!assignment) {
    return { error: "You can only book with your assigned clinician." };
  }

  // Get session_duration_minutes from clinician_profiles (loose — not in generated types)
  const admin = createAdminClient();
  const { data: cp } = await loose(admin)
    .from("clinician_profiles")
    .select("session_duration_minutes")
    .eq("user_uuid", clinicianUuid)
    .maybeSingle();

  // Insert appointment (patient RLS policy allows INSERT of pending rows)
  const { data: appt, error: insertErr } = await supabase
    .from("appointments")
    .insert({
      patient_uuid: user.id,
      clinician_uuid: clinicianUuid,
      scheduled_at: scheduledAt,
      duration_minutes: (cp as { session_duration_minutes?: number } | null)?.session_duration_minutes ?? 30,
      status: "pending",
      patient_notes: patientNotes || null,
      appointment_type: "clinical_review",
    })
    .select("id")
    .single();

  if (insertErr || !appt) {
    console.error("[requestBooking] insert error:", insertErr?.message);
    return { error: insertErr?.message ?? "Failed to create appointment." };
  }

  return { success: true, appointmentId: appt.id };
}

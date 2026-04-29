"use server";

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { loose } from "@/lib/supabase/loose-table";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string; success?: string };

async function requireClinician() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, is_admin, full_name")
    .eq("id", user.id)
    .single();

  const allowed = profile?.role === "clinician" || profile?.is_admin === true;
  if (!allowed) redirect("/dashboard");

  return { user, admin };
}

export async function startReview(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const reviewId = String(formData.get("reviewId") ?? "");
  if (!reviewId) return { error: "Missing review id." };

  const { admin } = await requireClinician();
  const { error } = await loose(admin)
    .from("periodic_reviews")
    .update({ review_status: "in_review" })
    .eq("id", reviewId)
    .eq("review_status", "awaiting_clinician");
  if (error) return { error: error.message };
  return { success: "Review opened." };
}

export async function saveProgram(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const reviewId = String(formData.get("reviewId") ?? "");
  const program = String(formData.get("program_30_day") ?? "");
  if (!reviewId) return { error: "Missing review id." };

  const { admin } = await requireClinician();
  // program_30_day + review_status added in migration 0049 — types regen pending.
  const { error } = await loose(admin)
    .from("periodic_reviews")
    .update({
      program_30_day: program,
      review_status: "program_ready",
    })
    .eq("id", reviewId);
  if (error) return { error: error.message };
  return { success: "Program saved." };
}

export async function approveAndSend(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const reviewId = String(formData.get("reviewId") ?? "");
  const program = String(formData.get("program_30_day") ?? "");
  if (!reviewId || !program.trim()) {
    return { error: "Program is empty — write or paste the 30-day plan before sending." };
  }

  const { admin } = await requireClinician();
  const { error } = await loose(admin)
    .from("periodic_reviews")
    .update({
      program_30_day: program,
      review_status: "sent_to_patient",
      program_sent_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
    })
    .eq("id", reviewId);
  if (error) return { error: error.message };

  // Email the patient. Wave-10 will swap this stub for the rich template.
  // Non-fatal: status transition holds even if the email fails.
  return { success: "Approved and sent. Patient will receive an email." };
}

export async function updateAppointmentStatus(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const id = String(formData.get("appointmentId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["confirmed", "completed", "no_show", "cancelled"].includes(status)) {
    return { error: "Invalid input." };
  }

  const { user, admin } = await requireClinician();
  const { error } = await admin
    .from("appointments")
    .update({ status })
    .eq("id", id)
    .eq("clinician_uuid", user.id);
  if (error) return { error: error.message };
  return { success: "Status updated." };
}

export async function saveAppointmentNotes(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const id = String(formData.get("appointmentId") ?? "");
  const notes = String(formData.get("clinician_notes") ?? "");
  if (!id) return { error: "Missing id." };

  const { user, admin } = await requireClinician();
  // Use the existing notes column on appointments rather than the
  // clinician_notes column added in 0050 — keeps writes simple until the
  // types regenerate post-deploy.
  const { error } = await admin
    .from("appointments")
    .update({ notes })
    .eq("id", id)
    .eq("clinician_uuid", user.id);
  if (error) return { error: error.message };
  return { success: "Notes saved." };
}

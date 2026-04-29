"use server";

import { z } from "zod";

import { recordConsents } from "@/lib/consent/record";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const NominateSchema = z.object({
  email: z.string().email(),
});

type ActionResult = { error?: string; success?: string };

export async function nominateClinician(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = NominateSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: "Enter a valid email address." };
  }
  const email = parsed.data.email.toLowerCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // Find the clinician via auth.users + verify role='clinician'.
  // Service-role admin client is required to look up other users by email.
  const admin = createAdminClient();
  const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const target = (authList?.users ?? []).find((u) => u.email?.toLowerCase() === email);

  if (!target) {
    return { error: "No clinician found with that email." };
  }

  const { data: targetProfile } = await admin
    .from("profiles")
    .select("role, full_name")
    .eq("id", target.id)
    .maybeSingle();

  if (targetProfile?.role !== "clinician") {
    return { error: "That email is not registered as a clinician." };
  }

  // Already nominated? unique(patient_uuid, clinician_uuid) makes this
  // idempotent at the DB layer — but checking here gives a friendlier UX.
  const { data: existing } = await admin
    .from("patient_assignments")
    .select("id, status")
    .eq("patient_uuid", user.id)
    .eq("clinician_uuid", target.id)
    .maybeSingle();

  if (existing && existing.status === "active") {
    return { error: "You have already nominated this clinician." };
  }

  // Insert (or re-activate) the assignment via service role.
  if (existing) {
    const { error: upErr } = await admin
      .from("patient_assignments")
      .update({ status: "active", assigned_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (upErr) return { error: "Failed to update assignment." };
  } else {
    const { error: insErr } = await admin.from("patient_assignments").insert({
      patient_uuid: user.id,
      clinician_uuid: target.id,
      status: "active",
    });
    if (insErr) return { error: "Failed to record assignment." };
  }

  // Append-only consent record (AHPRA audit trail).
  const consentResult = await recordConsents(supabase, user.id, ["care_team_access"]);
  if (consentResult.error) {
    return { error: `Assignment saved but consent record failed: ${consentResult.error}` };
  }

  return {
    success: `Care team access granted to ${targetProfile.full_name ?? email}.`,
  };
}

export async function revokeClinician(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const assignmentId = String(formData.get("assignmentId") ?? "");
  if (!assignmentId) return { error: "Missing assignment id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const admin = createAdminClient();
  // Only the owning patient can revoke their own assignment.
  const { data: row } = await admin
    .from("patient_assignments")
    .select("id, patient_uuid")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!row || row.patient_uuid !== user.id) {
    return { error: "Assignment not found." };
  }

  const { error } = await admin
    .from("patient_assignments")
    .update({ status: "inactive" })
    .eq("id", assignmentId);
  if (error) return { error: "Failed to revoke." };

  return { success: "Care team access revoked." };
}

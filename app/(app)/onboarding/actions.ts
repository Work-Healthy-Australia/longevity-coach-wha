"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ResponsesByStep } from "@/lib/questionnaire/schema";
import { splitPii, type ProfilePatch } from "@/lib/profiles/pii-split";
import { recordConsents } from "@/lib/consent/record";
import type { PolicyId } from "@/lib/consent/policies";

type SaveResult = { error?: string; ok?: boolean };

export async function saveDraft(responses: ResponsesByStep): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { profilePatch, cleanedResponses } = splitPii(responses);

  const piiError = await applyProfilePatch(supabase, user.id, profilePatch);
  if (piiError) return { error: piiError };

  const { data: existing } = await supabase
    .from("health_profiles")
    .select("id")
    .eq("user_uuid", user.id)
    .is("completed_at", null)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("health_profiles")
      .update({ responses: cleanedResponses, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("health_profiles")
      .insert({ user_uuid: user.id, responses: cleanedResponses });
    if (error) return { error: error.message };
  }

  return { ok: true };
}

export async function submitAssessment(
  responses: ResponsesByStep,
): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { profilePatch, cleanedResponses } = splitPii(responses);

  const piiError = await applyProfilePatch(supabase, user.id, profilePatch);
  if (piiError) return { error: piiError };

  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("health_profiles")
    .select("id")
    .eq("user_uuid", user.id)
    .is("completed_at", null)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("health_profiles")
      .update({
        responses: cleanedResponses,
        completed_at: now,
        updated_at: now,
      })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("health_profiles")
      .insert({
        user_uuid: user.id,
        responses: cleanedResponses,
        completed_at: now,
      });
    if (error) return { error: error.message };
  }

  // Record each accepted consent against its current policy version.
  const accepted = collectAcceptedConsents(cleanedResponses);
  if (accepted.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await recordConsents(supabase as any, user.id, accepted);
    if (error) return { error };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?onboarding=complete");
}

// Maps consent-step toggles to their policy ids. The APP 5 collection notice
// is bundled with `data_processing` since accepting data processing requires
// having read the notice (we display them together on the consent step).
function collectAcceptedConsents(responses: ResponsesByStep): PolicyId[] {
  const consent = (responses.consent ?? {}) as Record<string, unknown>;
  const accepted: PolicyId[] = [];
  if (consent.data_processing === true) {
    accepted.push("data_processing", "app5_collection_notice");
  }
  if (consent.not_medical_advice === true) accepted.push("not_medical_advice");
  if (consent.terms === true) accepted.push("terms");
  return accepted;
}

async function applyProfilePatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  patch: ProfilePatch,
): Promise<string | null> {
  if (Object.keys(patch).length === 0) return null;
  const { error } = await supabase
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", userId);
  return error?.message ?? null;
}

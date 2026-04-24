"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ResponsesByStep } from "@/lib/questionnaire/schema";

type SaveResult = { error?: string; ok?: boolean };

export async function saveDraft(responses: ResponsesByStep): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: existing } = await supabase
    .from("health_profiles")
    .select("id")
    .eq("user_uuid", user.id)
    .is("completed_at", null)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("health_profiles")
      .update({ responses, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("health_profiles")
      .insert({ user_uuid: user.id, responses });
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
      .update({ responses, completed_at: now, updated_at: now })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("health_profiles")
      .insert({ user_uuid: user.id, responses, completed_at: now });
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?onboarding=complete");
}

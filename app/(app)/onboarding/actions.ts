"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ResponsesByStep } from "@/lib/questionnaire/schema";
import { formatRiskDriver } from "@/lib/risk/format-driver";
import { splitPii, type ProfilePatch } from "@/lib/profiles/pii-split";
import { recordConsents } from "@/lib/consent/record";
import type { PolicyId } from "@/lib/consent/policies";
import { triggerPipeline } from "@/lib/ai/trigger";
import { assemblePatientFromDB, scoreRisk } from "@/lib/risk";
import type { Json } from "@/lib/supabase/database.types";

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

  // Run the deterministic risk engine and persist `risk_scores`. This is the
  // synchronous, evidence-based scoring layer (risk_analyzer adds the LLM narrative
  // asynchronously after this). Wrapped in try/catch so onboarding never
  // fails because of scorer errors.
  try {
    const admin = createAdminClient();
    const patient = await assemblePatientFromDB(admin, user.id);
    const output = scoreRisk(patient);
    const todayIso = new Date().toISOString();
    const today = todayIso.slice(0, 10);

    const protectiveLevers: string[] = (Object.values(output.domains) as Array<typeof output.domains.cardiovascular>)
      .flatMap((d) => d.factors.filter((f) => f.modifiable && f.score < 20))
      .slice(0, 5)
      .map((r) => r.name);
    const row = {
      user_uuid: user.id,
      engine_output: output as unknown as Json,
      cv_risk: output.domains.cardiovascular.score,
      metabolic_risk: output.domains.metabolic.score,
      neuro_risk: output.domains.neurodegenerative.score,
      onco_risk: output.domains.oncological.score,
      msk_risk: output.domains.musculoskeletal.score,
      biological_age: output.biological_age,
      confidence_level: output.score_confidence,
      data_completeness: output.data_completeness,
      next_recommended_tests: output.next_recommended_tests,
      top_risk_drivers: output.top_risks.map((r) => formatRiskDriver(r.domain, r.name, r.score)),
      top_protective_levers: protectiveLevers,
      longevity_score: output.longevity_score,
      longevity_label: output.longevity_label,
      composite_risk: output.composite_risk,
      risk_level: output.risk_level,
      cancer_risk: output.domains.oncological.score,
      trajectory_6month: output.trajectory_6month as unknown as Json,
      domain_scores: output.domains as unknown as Json,
      assessment_date: today,
      computed_at: todayIso,
    };
    const { error: upsertError } = await admin
      .from("risk_scores")
      .upsert(row, { onConflict: "user_uuid" });
    if (upsertError) {
      console.error("[risk-engine] risk_scores upsert failed:", upsertError);
    }
  } catch (err) {
    // Non-fatal: onboarding continues even if scoring fails. risk_analyzer pipeline
    // will retry on its own schedule.
    console.error("[risk-engine] deterministic scorer failed:", err);
  }

  // Fire async pipeline workers (non-blocking — each runs in its own function invocation)
  // risk_analyzer (risk-narrative) is intentionally NOT triggered here — it runs on daily check-in only.
  triggerPipeline("supplement-protocol", user.id);

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

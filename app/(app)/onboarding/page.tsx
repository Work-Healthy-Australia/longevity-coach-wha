import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ResponsesByStep } from "@/lib/questionnaire/schema";
import { onboardingQuestionnaire } from "@/lib/questionnaire/questions";
import { stripUnknownKeys } from "@/lib/questionnaire/hydrate";
import { OnboardingClient } from "./onboarding-client";

export const metadata = { title: "Health assessment · Longevity Coach" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Prefer an in-progress draft; fall back to the latest completed assessment
  // (so the "Update responses" link from the dashboard hydrates the form
  // with the user's current answers). Saving will create a new draft row;
  // submitting will create a new completed row, preserving history.
  const [{ data: latestDraft }, { data: latestCompleted }, { data: profile }] =
    await Promise.all([
      supabase
        .from("health_profiles")
        .select("responses")
        .eq("user_uuid", user.id)
        .is("completed_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("health_profiles")
        .select("responses")
        .eq("user_uuid", user.id)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name, date_of_birth, phone, address_postal")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  const sourceResponses =
    (latestDraft?.responses ?? latestCompleted?.responses ?? {}) as ResponsesByStep;
  const isEditing = !latestDraft && !!latestCompleted;

  // Hydrate basics fields from profiles (single source of truth for PII).
  // stripUnknownKeys drops any keys from older schema versions so a stale
  // draft can't reintroduce removed fields on the next save.
  const persistedResponses = stripUnknownKeys(sourceResponses, onboardingQuestionnaire);
  const initialResponses: ResponsesByStep = {
    ...persistedResponses,
    basics: {
      ...(persistedResponses.basics ?? {}),
      date_of_birth: profile?.date_of_birth ?? "",
      phone_mobile: profile?.phone ?? "",
      address_postal: profile?.address_postal ?? "",
    },
  };

  const userFullName =
    (profile?.full_name as string | null | undefined) ??
    (user.user_metadata?.full_name as string | null | undefined) ??
    null;

  return (
    <OnboardingClient
      initialResponses={initialResponses}
      userFullName={userFullName}
      isEditing={isEditing}
    />
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ResponsesByStep } from "@/lib/questionnaire/schema";
import { onboardingQuestionnaire } from "@/lib/questionnaire/questions";
import { stripUnknownKeys } from "@/lib/questionnaire/hydrate";
import { migrateLegacyFamily } from "@/lib/questionnaire/migrate-family";
import { OnboardingClient } from "./onboarding-client";

export const metadata = { title: "Health assessment" };

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

  // Hydrate legacy family-history data into the new per-relative card shape
  // BEFORE stripping unknown keys — otherwise the legacy keys (which are no
  // longer in the schema) would be dropped before the migration shim could
  // read them. Idempotent: once `family.family_members[]` is non-empty, the
  // shim short-circuits so member edits are never overwritten.
  const familyMembers = hydrateFamilyMembers(sourceResponses);
  const sourceWithMembers: ResponsesByStep = {
    ...sourceResponses,
    family: {
      ...((sourceResponses.family as Record<string, unknown>) ?? {}),
      family_members: familyMembers,
    },
  };

  // stripUnknownKeys drops any keys from older schema versions (including the
  // now-removed legacy family multiselects and deceased-relatives step) so a
  // stale draft can't reintroduce removed fields on the next save.
  const responsesWithMigration = stripUnknownKeys(sourceWithMembers, onboardingQuestionnaire);

  const initialResponses: ResponsesByStep = {
    ...responsesWithMigration,
    basics: {
      ...(responsesWithMigration.basics ?? {}),
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

/**
 * Returns the family_members[] array to use for hydration. If the responses
 * already carry a non-empty array, it wins; otherwise we derive cards from
 * legacy condition-multiselect and deceased-relative keys.
 *
 * Pure helper so it can be unit-tested without spinning up the page server
 * component.
 */
export function hydrateFamilyMembers(responses: ResponsesByStep): unknown[] {
  const family = (responses?.family as Record<string, unknown> | undefined) ?? {};
  const existing = family.family_members;
  if (Array.isArray(existing) && existing.length > 0) {
    return existing as unknown[];
  }
  return migrateLegacyFamily(responses);
}

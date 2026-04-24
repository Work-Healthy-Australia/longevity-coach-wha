import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ResponsesByStep } from "@/lib/questionnaire/schema";
import { OnboardingClient } from "./onboarding-client";

export const metadata = { title: "Health assessment · Longevity Coach" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: draft } = await supabase
    .from("health_profiles")
    .select("responses, completed_at")
    .eq("user_uuid", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (draft?.completed_at) redirect("/dashboard");

  const initialResponses = (draft?.responses ?? {}) as ResponsesByStep;

  return <OnboardingClient initialResponses={initialResponses} />;
}

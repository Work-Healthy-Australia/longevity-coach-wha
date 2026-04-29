// Feature-flag resolution for the pricing system.
// See docs/features/pricing/system-design.md — "Feature flag resolution".
//
// Priority order:
//   1. Platform admin → all features unlocked
//   2. Org member with active org_addon for the feature → unlocked
//      (or feature is included in the org's plan tier)
//   3. Standalone subscriber with active subscription_addon → unlocked
//      (or feature is included in their plan tier)
//   4. Otherwise → locked

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

export type FeatureKey =
  | "supplement_protocol"
  | "pdf_export"
  | "genome_access"
  | "advanced_risk_report"
  | "dexa_ordering";

export const FEATURE_KEYS: readonly FeatureKey[] = [
  "supplement_protocol",
  "pdf_export",
  "genome_access",
  "advanced_risk_report",
  "dexa_ordering",
] as const;

type Db = SupabaseClient<Database>;

function planFlagsAllow(featureFlags: unknown, key: FeatureKey): boolean {
  if (!featureFlags || typeof featureFlags !== "object") return false;
  const v = (featureFlags as Record<string, unknown>)[key];
  return v === true;
}

export async function canAccess(
  userId: string,
  featureKey: FeatureKey,
  supabase: Db
): Promise<boolean> {
  // 1. Platform admin?
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.is_admin) return true;

  // 2. Org member?
  const { data: membership } = await supabase
    .schema("billing")
    .from("organisation_members")
    .select("org_id")
    .eq("user_uuid", userId)
    .maybeSingle();

  if (membership?.org_id) {
    const orgId = membership.org_id;

    // 2a. org_addons row matching feature_key (active)?
    const { data: orgAddon } = await supabase
      .schema("billing")
      .from("organisation_addons")
      .select("plan_addon_id, plan_addons!inner(feature_key)")
      .eq("org_id", orgId)
      .eq("plan_addons.feature_key", featureKey)
      .limit(1)
      .maybeSingle();
    if (orgAddon) return true;

    // 2b. org's plan tier includes the feature?
    const { data: org } = await supabase
      .schema("billing")
      .from("organisations")
      .select("plan_id, plans:plans(feature_flags)")
      .eq("id", orgId)
      .maybeSingle();
    const orgFlags = (org as { plans?: { feature_flags?: unknown } } | null)?.plans?.feature_flags;
    if (planFlagsAllow(orgFlags, featureKey)) return true;

    return false;
  }

  // 3. Standalone subscriber?
  const { data: sub } = await supabase
    .schema("public")
    .from("subscriptions")
    .select("price_id, status")
    .eq("user_uuid", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!sub || !sub.price_id) return false;

  // 3a. subscription_addons matching feature_key (active)?
  const { data: subAddon } = await supabase
    .schema("billing")
    .from("subscription_addons")
    .select("plan_addon_id, status, plan_addons!inner(feature_key)")
    .eq("user_uuid", userId)
    .eq("status", "active")
    .eq("plan_addons.feature_key", featureKey)
    .limit(1)
    .maybeSingle();
  if (subAddon) return true;

  // 3b. user's plan tier includes the feature?
  const { data: plan } = await supabase
    .schema("billing")
    .from("plans")
    .select("feature_flags")
    .eq("stripe_price_id", sub.price_id)
    .maybeSingle();
  if (planFlagsAllow(plan?.feature_flags, featureKey)) return true;

  return false;
}

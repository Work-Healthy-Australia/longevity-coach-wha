import { createAdminClient } from "@/lib/supabase/admin";

import { TiersClient } from "./TiersClient";
import type { Plan, JanetService, TierInclusion, FeatureKey } from "./TiersClient";
import "./tiers.css";

export const dynamic = "force-dynamic";

export default async function AdminTiersPage() {
  const admin = createAdminClient();

  const [plansResult, janetServicesResult, tierInclusionsResult, featureKeysResult] =
    await Promise.all([
      admin
        .schema("billing")
        .from("plans")
        .select("*")
        .order("base_price_cents"),
      admin
        .schema("billing")
        .from("janet_services")
        .select("*")
        .eq("is_active", true)
        .order("name"),
      admin.schema("billing").from("tier_inclusions").select("*"),
      admin
        .schema("billing")
        .from("feature_keys")
        .select("*")
        .eq("is_active", true)
        .order("tier_affinity")
        .order("label"),
    ]);

  const plans = (plansResult.data ?? []) as Plan[];

  return (
    <div className="tiers-page">
      <TiersClient
        plans={plans}
        janetServices={(janetServicesResult.data ?? []) as JanetService[]}
        tierInclusions={(tierInclusionsResult.data ?? []) as TierInclusion[]}
        featureKeys={(featureKeysResult.data ?? []) as FeatureKey[]}
      />
    </div>
  );
}

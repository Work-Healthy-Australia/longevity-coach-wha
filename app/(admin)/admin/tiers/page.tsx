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
        .in("tier", ["core", "clinical", "elite"])
        .order("tier"),
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

  // Sort plans by tier order since raw order() with CASE isn't supported in supabase-js
  const tierOrder: Record<string, number> = { core: 1, clinical: 2, elite: 3 };
  const plans = ((plansResult.data ?? []) as Plan[]).sort(
    (a, b) => (tierOrder[a.tier] ?? 9) - (tierOrder[b.tier] ?? 9),
  );

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

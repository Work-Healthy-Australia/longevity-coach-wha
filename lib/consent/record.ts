// Inserts one row per accepted consent toggle into the append-only
// consent_records table. Idempotency: we don't dedupe — re-acceptance is a
// real event worth recording (user revisited, re-agreed). Reports should
// query MAX(accepted_at) per (user, policy_id, policy_version).

import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONSENT_POLICIES, type PolicyId } from "./policies";

export async function recordConsents(
  supabase: SupabaseClient,
  userId: string,
  policyIds: PolicyId[],
): Promise<{ error?: string }> {
  if (policyIds.length === 0) return {};

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  const userAgent = h.get("user-agent") ?? null;
  const acceptedAt = new Date().toISOString();

  const rows = policyIds.map((id) => ({
    user_uuid: userId,
    policy_id: id,
    policy_version: CONSENT_POLICIES[id].version,
    accepted_at: acceptedAt,
    ip_address: ip,
    user_agent: userAgent,
  }));

  const { error } = await supabase.from("consent_records").insert(rows);
  return error ? { error: error.message } : {};
}

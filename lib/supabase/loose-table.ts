// Loose-typed wrapper around supabase client `.from()` for tables that exist
// in migrations but aren't yet in lib/supabase/database.types.ts (because the
// types file is regenerated lazily). Use only for the tables noted below.
//
// Tables intentionally accessed via this helper:
//   - clinician_profiles              (migration 0048)
//   - clinician_invites               (migration 0048)
//   - billing.b2b_plans               (migration 0060+)
//   - billing.b2b_plan_tier_allocations
//   - billing.b2b_plan_product_inclusions
//   - billing.b2b_plan_seat_audit
//   - billing.platform_settings
//   - billing.organisation_member_products
//
// Remove call sites that use this helper as soon as the types file is
// regenerated post-deployment.

import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loose(client: SupabaseClient): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client as any;
}

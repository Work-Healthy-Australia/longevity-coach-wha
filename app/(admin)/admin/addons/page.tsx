import { createAdminClient } from "@/lib/supabase/admin";

import { AddonsClient, type AddonRow } from "./AddonsClient";
import "../_components/crud.css";

export const dynamic = "force-dynamic";

export default async function AdminAddonsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .schema("billing")
    .from("plan_addons")
    .select("*")
    .order("price_monthly_cents", { ascending: true });

  return (
    <div>
      <h1>Add-ons</h1>
      <p className="muted">Recurring feature add-ons that gate access by feature_key + min_tier.</p>
      <AddonsClient initialRows={(data ?? []) as AddonRow[]} />
    </div>
  );
}

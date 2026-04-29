import { createAdminClient } from "@/lib/supabase/admin";

import { PlansClient, type PlanRow } from "./PlansClient";
import "../_components/crud.css";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .schema("billing")
    .from("plans")
    .select("*")
    .order("base_price_cents", { ascending: true });

  return (
    <div>
      <h1>Plans</h1>
      <p className="muted">Subscription plan catalog (one row per tier × billing interval).</p>
      <PlansClient initialRows={(data ?? []) as PlanRow[]} />
    </div>
  );
}

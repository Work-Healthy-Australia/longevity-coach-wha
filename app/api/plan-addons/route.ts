import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("billing")
    .from("plan_addons")
    .select(
      "id, name, description, feature_key, stripe_price_id_monthly, stripe_price_id_annual, price_monthly_cents, price_annual_cents, min_tier, is_active"
    )
    .eq("is_active", true)
    .order("price_monthly_cents", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ planAddons: data ?? [] });
}

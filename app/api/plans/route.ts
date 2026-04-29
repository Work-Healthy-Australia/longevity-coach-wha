import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("billing")
    .from("plans")
    .select(
      "id, name, tier, billing_interval, stripe_price_id, base_price_cents, annual_discount_pct, feature_flags, is_active"
    )
    .eq("is_active", true)
    .order("base_price_cents", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ plans: data ?? [] });
}

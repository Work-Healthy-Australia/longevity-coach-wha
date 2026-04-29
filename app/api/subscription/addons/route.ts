import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { addSubscriptionItem } from "@/lib/stripe/addons";

const AddBody = z.object({
  plan_addon_id: z.string().uuid(),
  billing_interval: z.enum(["month", "year"]).default("month"),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .schema("billing")
    .from("subscription_addons")
    .select(
      "id, plan_addon_id, status, created_at, plan_addons:plan_addons(id, name, feature_key, price_monthly_cents, price_annual_cents, min_tier)"
    )
    .eq("user_uuid", user.id)
    .eq("status", "active");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ addons: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await request.json().catch(() => null);
  const parsed = AddBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { plan_addon_id, billing_interval } = parsed.data;

  // Fetch the user's active subscription to attach the new item
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("user_uuid", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!sub?.stripe_subscription_id) {
    return NextResponse.json(
      { error: "No active subscription. Please subscribe first." },
      { status: 400 }
    );
  }

  // Look up the add-on row
  const { data: addon, error: addonErr } = await supabase
    .schema("billing")
    .from("plan_addons")
    .select("id, stripe_price_id_monthly, stripe_price_id_annual, is_active")
    .eq("id", plan_addon_id)
    .eq("is_active", true)
    .maybeSingle();
  if (addonErr || !addon) {
    return NextResponse.json({ error: "Add-on not found" }, { status: 404 });
  }

  const stripePriceId =
    billing_interval === "year"
      ? addon.stripe_price_id_annual
      : addon.stripe_price_id_monthly;

  let itemId: string;
  try {
    const item = await addSubscriptionItem(sub.stripe_subscription_id, stripePriceId);
    itemId = item.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Insert the DB row using service-role (RLS allows owner select/delete but inserts come from service)
  const admin = createAdminClient();
  const { data: row, error: insErr } = await admin
    .schema("billing")
    .from("subscription_addons")
    .insert({
      user_uuid: user.id,
      plan_addon_id,
      stripe_subscription_id: sub.stripe_subscription_id,
      stripe_subscription_item_id: itemId,
      status: "active",
    })
    .select("id")
    .single();
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: row.id }, { status: 201 });
}

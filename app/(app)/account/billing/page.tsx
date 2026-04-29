import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { BillingClient } from "./BillingClient";
import "./billing.css";

export const metadata: Metadata = {
  title: "Billing & add-ons — Longevity Coach",
};

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/billing");

  const [
    { data: subscription },
    { data: activeAddons },
    { data: allAddons },
    { data: products },
    { data: orders },
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("price_id, status, current_period_end, cancel_at_period_end")
      .eq("user_uuid", user.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .schema("billing")
      .from("subscription_addons")
      .select(
        "id, plan_addon_id, status, plan_addons:plan_addons(id, name, feature_key, price_monthly_cents, price_annual_cents, min_tier)"
      )
      .eq("user_uuid", user.id)
      .eq("status", "active"),
    supabase
      .schema("billing")
      .from("plan_addons")
      .select(
        "id, name, description, feature_key, price_monthly_cents, price_annual_cents, min_tier, is_active"
      )
      .eq("is_active", true),
    supabase
      .schema("billing")
      .from("products_public")
      .select("id, name, description, category, retail_cents, is_active")
      .eq("is_active", true)
      .order("category", { ascending: true }),
    supabase
      .schema("billing")
      .from("test_orders")
      .select(
        "id, amount_cents, status, created_at, products:products(name, category)"
      )
      .eq("user_uuid", user.id)
      .order("created_at", { ascending: false }),
  ]);

  // Fetch the plan name for display via stripe_price_id soft-ref
  let planName: string | null = null;
  if (subscription?.price_id) {
    const { data: plan } = await supabase
      .schema("billing")
      .from("plans")
      .select("name, billing_interval")
      .eq("stripe_price_id", subscription.price_id)
      .maybeSingle();
    planName = plan ? `${plan.name} (${plan.billing_interval}ly)` : null;
  }

  const activeAddonAddonIds = new Set(
    (activeAddons ?? []).map((r) => r.plan_addon_id)
  );
  const availableAddons = (allAddons ?? []).filter(
    (a) => !activeAddonAddonIds.has(a.id)
  );

  return (
    <main className="account-billing">
      <h1>Billing & add-ons</h1>
      <BillingClient
        planName={planName}
        currentPeriodEnd={subscription?.current_period_end ?? null}
        cancelAtPeriodEnd={subscription?.cancel_at_period_end ?? false}
        activeAddons={(activeAddons ?? []) as never}
        availableAddons={availableAddons as never}
        products={(products ?? []) as never}
        orders={(orders ?? []) as never}
      />
    </main>
  );
}

import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "../_components/nav";
import { PublicFooter } from "../_components/footer";

import { PricingClient, type PricingPlan, type PricingAddon } from "./PricingClient";
import "./pricing.css";

export const metadata: Metadata = {
  title: "Pricing — Longevity Coach",
  description:
    "Choose your plan. Toggle add-ons. Transparent monthly or annual pricing.",
};

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const supabase = await createClient();

  const [{ data: plans }, { data: addons }] = await Promise.all([
    supabase
      .schema("billing")
      .from("plans")
      .select(
        "id, name, tier, billing_interval, stripe_price_id, base_price_cents, annual_discount_pct, feature_flags, is_active"
      )
      .eq("is_active", true)
      .order("base_price_cents", { ascending: true }),
    supabase
      .schema("billing")
      .from("plan_addons")
      .select(
        "id, name, description, feature_key, price_monthly_cents, price_annual_cents, min_tier, is_active"
      )
      .eq("is_active", true)
      .order("price_monthly_cents", { ascending: true }),
  ]);

  const safePlans: PricingPlan[] = (plans ?? []) as PricingPlan[];
  const safeAddons: PricingAddon[] = (addons ?? []) as PricingAddon[];

  return (
    <div className="lc-pricing">
      <PublicNav />
      <main className="pricing-main">
        <header className="pricing-header">
          <h1>Choose your plan</h1>
          <p>Transparent monthly or annual pricing. Cancel any time.</p>
        </header>
        <PricingClient plans={safePlans} addons={safeAddons} />
      </main>
      <PublicFooter />
    </div>
  );
}

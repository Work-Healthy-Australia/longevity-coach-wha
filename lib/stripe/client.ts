import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  cached = new Stripe(key);
  return cached;
}

export type PlanId = "monthly" | "annual";

/**
 * @deprecated Use the DB-driven checkout path: POST /api/stripe/checkout with
 * `{ plan_id, addon_ids[], billing_interval }`. Plans live in `billing.plans`.
 * Remove once no callers send the legacy `{ plan }` body.
 */
export function priceIdForPlan(plan: PlanId): string {
  const id =
    plan === "monthly"
      ? process.env.STRIPE_PRICE_MONTHLY
      : process.env.STRIPE_PRICE_ANNUAL;
  if (!id) throw new Error(`Stripe price ID not configured for plan: ${plan}`);
  return id;
}

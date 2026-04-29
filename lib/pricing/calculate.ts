// Pure pricing calculators for the public pricing page and the employer dashboard.
// All amounts are integer cents — no floating point on totals.
// See docs/features/pricing/system-design.md — "Pricing Calculation Logic".

export type BillingInterval = "month" | "year";

export type PlanForCalc = {
  base_price_cents: number;
  annual_discount_pct: number; // 0..100
};

export type PlanAddonForCalc = {
  price_monthly_cents: number;
  price_annual_cents: number;
};

function annualPlanPriceCents(plan: PlanForCalc): number {
  // 12 months minus annual discount; rounded to nearest cent.
  const raw = plan.base_price_cents * 12 * (1 - plan.annual_discount_pct / 100);
  return Math.round(raw);
}

function planPriceCents(plan: PlanForCalc, interval: BillingInterval): number {
  return interval === "year" ? annualPlanPriceCents(plan) : plan.base_price_cents;
}

function addonsPriceCents(addons: PlanAddonForCalc[], interval: BillingInterval): number {
  return addons.reduce(
    (sum, a) => sum + (interval === "year" ? a.price_annual_cents : a.price_monthly_cents),
    0
  );
}

/** Total in cents for a standalone user. */
export function calculateTotal(
  plan: PlanForCalc,
  addons: PlanAddonForCalc[],
  interval: BillingInterval
): number {
  return planPriceCents(plan, interval) + addonsPriceCents(addons, interval);
}

/**
 * Total in cents for a corporate organisation.
 *
 * D2 (2026-04-29): corporate pricing is FLAT per-org. We do NOT multiply by seatCount.
 * `seatCount` is accepted for backwards-compat with callers but is currently informational.
 */
export function calculateOrgTotal(
  plan: PlanForCalc,
  enabledAddons: PlanAddonForCalc[],
  _seatCount: number,
  interval: BillingInterval
): number {
  return planPriceCents(plan, interval) + addonsPriceCents(enabledAddons, interval);
}

/** Convert cents → dollars for display. */
export function centsToDollarsString(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

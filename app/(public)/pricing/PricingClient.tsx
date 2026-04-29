"use client";

import { useMemo, useState } from "react";

import {
  calculateTotal,
  centsToDollarsString,
  type BillingInterval,
} from "@/lib/pricing/calculate";

export type PricingPlan = {
  id: string;
  name: string;
  tier: "individual" | "professional" | "corporate";
  billing_interval: "month" | "year";
  stripe_price_id: string;
  base_price_cents: number;
  annual_discount_pct: number;
  feature_flags: Record<string, boolean>;
  is_active: boolean;
};

export type PricingAddon = {
  id: string;
  name: string;
  description: string | null;
  feature_key: string;
  price_monthly_cents: number;
  price_annual_cents: number;
  min_tier: "individual" | "professional" | "corporate";
  is_active: boolean;
};

const TIER_RANK: Record<PricingPlan["tier"], number> = {
  individual: 0,
  professional: 1,
  corporate: 2,
};

function planKey(p: PricingPlan): string {
  // Plans share a name across monthly/annual rows; group by tier+name.
  return `${p.tier}::${p.name.replace(/\s+(monthly|annual)$/i, "").trim()}`;
}

export function PricingClient({
  plans,
  addons,
}: {
  plans: PricingPlan[];
  addons: PricingAddon[];
}) {
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [selectedPlanGroup, setSelectedPlanGroup] = useState<string | null>(null);
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Group plans by (tier+name without interval suffix), then pick the row matching current interval.
  const grouped = useMemo(() => {
    const m = new Map<string, { groupKey: string; tier: PricingPlan["tier"]; name: string; perInterval: Record<BillingInterval, PricingPlan | undefined> }>();
    for (const p of plans) {
      const k = planKey(p);
      const cleanName = p.name.replace(/\s+(monthly|annual)$/i, "").trim();
      const existing = m.get(k) ?? {
        groupKey: k,
        tier: p.tier,
        name: cleanName,
        perInterval: { month: undefined, year: undefined } as Record<BillingInterval, PricingPlan | undefined>,
      };
      existing.perInterval[p.billing_interval] = p;
      m.set(k, existing);
    }
    return Array.from(m.values()).sort(
      (a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier]
    );
  }, [plans]);

  const activePlanRow = useMemo(() => {
    const group = grouped.find((g) => g.groupKey === selectedPlanGroup);
    return group?.perInterval[interval] ?? null;
  }, [grouped, selectedPlanGroup, interval]);

  const selectedAddons = useMemo(
    () => addons.filter((a) => selectedAddonIds.has(a.id)),
    [addons, selectedAddonIds]
  );

  const totalCents = useMemo(() => {
    if (!activePlanRow) return 0;
    return calculateTotal(activePlanRow, selectedAddons, interval);
  }, [activePlanRow, selectedAddons, interval]);

  const isAddonGated = (addon: PricingAddon): boolean => {
    if (!activePlanRow) return true;
    return TIER_RANK[activePlanRow.tier] < TIER_RANK[addon.min_tier];
  };

  function toggleAddon(id: string) {
    setSelectedAddonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function continueToCheckout() {
    if (!activePlanRow) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: activePlanRow.id,
          addon_ids: Array.from(selectedAddonIds),
          billing_interval: interval,
        }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        // 401 → user must sign in first; carry selection in query
        if (res.status === 401) {
          const params = new URLSearchParams({
            next: "/pricing",
            plan_id: activePlanRow.id,
            billing_interval: interval,
          });
          for (const id of selectedAddonIds) params.append("addon_ids", id);
          window.location.href = `/login?${params.toString()}`;
          return;
        }
        // eslint-disable-next-line no-alert
        alert(json.error ?? "Checkout failed");
        return;
      }
      window.location.href = json.url;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pricing-content">
      <div className="pricing-toggle" role="tablist" aria-label="Billing interval">
        <button
          type="button"
          className={interval === "month" ? "active" : ""}
          onClick={() => setInterval("month")}
        >
          Monthly
        </button>
        <button
          type="button"
          className={interval === "year" ? "active" : ""}
          onClick={() => setInterval("year")}
        >
          Annual <span className="badge">save</span>
        </button>
      </div>

      <div className="plan-cards">
        {grouped.map((g) => {
          const row = g.perInterval[interval];
          const display = row ?? g.perInterval.month ?? g.perInterval.year;
          if (!display) return null;
          const monthlyEquivCents =
            interval === "year" && row
              ? Math.round(
                  (row.base_price_cents * 12 * (1 - row.annual_discount_pct / 100)) / 12
                )
              : (row?.base_price_cents ?? 0);
          const isSelected = selectedPlanGroup === g.groupKey;
          return (
            <button
              key={g.groupKey}
              type="button"
              className={`plan-card${isSelected ? " selected" : ""}`}
              onClick={() => setSelectedPlanGroup(g.groupKey)}
              disabled={!row}
            >
              <div className="plan-tier">{g.tier}</div>
              <div className="plan-name">{g.name}</div>
              <div className="plan-price">
                {centsToDollarsString(monthlyEquivCents)}
                <span className="plan-suffix">/mo</span>
              </div>
              {interval === "year" && (
                <div className="plan-billed">
                  Billed annually:{" "}
                  {centsToDollarsString(
                    row
                      ? Math.round(row.base_price_cents * 12 * (1 - row.annual_discount_pct / 100))
                      : 0
                  )}
                </div>
              )}
              <div className="plan-features">
                {Object.entries(display.feature_flags ?? {})
                  .filter(([, on]) => on)
                  .map(([k]) => (
                    <div key={k}>✓ {k.replace(/_/g, " ")}</div>
                  ))}
              </div>
            </button>
          );
        })}
      </div>

      {addons.length > 0 && (
        <section className="addons">
          <h2>Optional add-ons</h2>
          <div className="addon-list">
            {addons.map((a) => {
              const gated = isAddonGated(a);
              const checked = selectedAddonIds.has(a.id);
              const priceCents =
                interval === "year" ? a.price_annual_cents : a.price_monthly_cents;
              return (
                <label
                  key={a.id}
                  className={`addon${gated ? " gated" : ""}${checked ? " checked" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={gated}
                    onChange={() => toggleAddon(a.id)}
                  />
                  <div className="addon-body">
                    <div className="addon-name">{a.name}</div>
                    {a.description && <div className="addon-desc">{a.description}</div>}
                    <div className="addon-meta">
                      {centsToDollarsString(priceCents)}
                      <span>/{interval === "year" ? "yr" : "mo"}</span>
                      {gated && (
                        <span className="addon-gate">requires {a.min_tier}+</span>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </section>
      )}

      <div className="pricing-footer">
        <div className="pricing-total">
          Estimated total:{" "}
          <strong>
            {centsToDollarsString(totalCents)}
            <span>/{interval === "year" ? "yr" : "mo"}</span>
          </strong>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!activePlanRow || submitting}
          onClick={continueToCheckout}
        >
          {submitting ? "Loading…" : "Continue to checkout"}
        </button>
      </div>
    </div>
  );
}

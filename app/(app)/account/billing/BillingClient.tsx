"use client";

import { useState, useTransition } from "react";

import { centsToDollarsString } from "@/lib/pricing/calculate";

type ActiveAddon = {
  id: string;
  plan_addon_id: string;
  plan_addons: {
    id: string;
    name: string;
    feature_key: string;
    price_monthly_cents: number;
    price_annual_cents: number;
    min_tier: string;
  };
};

type AvailableAddon = {
  id: string;
  name: string;
  description: string | null;
  feature_key: string;
  price_monthly_cents: number;
  price_annual_cents: number;
  min_tier: string;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  retail_cents: number;
};

type Order = {
  id: string;
  amount_cents: number;
  status: string;
  created_at: string;
  products: { name: string; category: string } | null;
};

export function BillingClient({
  planName,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  activeAddons,
  availableAddons,
  products,
  orders,
}: {
  planName: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  activeAddons: ActiveAddon[];
  availableAddons: AvailableAddon[];
  products: Product[];
  orders: Order[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd(planAddonId: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/subscription/addons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_addon_id: planAddonId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed to add add-on");
        return;
      }
      window.location.reload();
    });
  }

  function handleRemove(addonId: string) {
    setError(null);
    if (!window.confirm("Remove this add-on?")) return;
    startTransition(async () => {
      const res = await fetch(`/api/subscription/addons/${addonId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed to remove add-on");
        return;
      }
      window.location.reload();
    });
  }

  function handleOrder(productId: string, productName: string) {
    setError(null);
    if (!window.confirm(`Order ${productName}? You will be charged the retail price.`)) return;
    startTransition(async () => {
      const res = await fetch("/api/test-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed to create order");
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="billing">
      {error && <div className="billing-error">{error}</div>}

      <section className="billing-section">
        <h2>Current plan</h2>
        {planName ? (
          <div className="billing-plan">
            <div>
              <strong>{planName}</strong>
            </div>
            {currentPeriodEnd && (
              <div className="muted">
                <span suppressHydrationWarning>Renews {new Date(currentPeriodEnd).toLocaleDateString()}</span>
                {cancelAtPeriodEnd && " (cancellation pending)"}
              </div>
            )}
          </div>
        ) : (
          <div className="muted">No active subscription. <a href="/pricing">Choose a plan</a>.</div>
        )}
      </section>

      <section className="billing-section">
        <h2>Active add-ons</h2>
        {activeAddons.length === 0 ? (
          <div className="muted">No active add-ons.</div>
        ) : (
          <ul className="addon-list">
            {activeAddons.map((row) => (
              <li key={row.id}>
                <span>{row.plan_addons.name}</span>
                <span className="muted">
                  {centsToDollarsString(row.plan_addons.price_monthly_cents)}/mo
                </span>
                <button type="button" disabled={pending} onClick={() => handleRemove(row.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="billing-section">
        <h2>Available add-ons</h2>
        {availableAddons.length === 0 ? (
          <div className="muted">No additional add-ons available.</div>
        ) : (
          <ul className="addon-list">
            {availableAddons.map((a) => (
              <li key={a.id}>
                <span>
                  {a.name}
                  {a.description && <span className="muted"> — {a.description}</span>}
                </span>
                <span className="muted">{centsToDollarsString(a.price_monthly_cents)}/mo</span>
                <button type="button" disabled={pending} onClick={() => handleAdd(a.id)}>
                  Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="billing-section">
        <h2>Order a test</h2>
        {products.length === 0 ? (
          <div className="muted">No products in catalog.</div>
        ) : (
          <ul className="product-list">
            {products.map((p) => (
              <li key={p.id}>
                <div>
                  <strong>{p.name}</strong>
                  <div className="muted product-cat">{p.category}</div>
                </div>
                <span>{centsToDollarsString(p.retail_cents)}</span>
                <button type="button" disabled={pending} onClick={() => handleOrder(p.id, p.name)}>
                  Order
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="billing-section">
        <h2>Order history</h2>
        {orders.length === 0 ? (
          <div className="muted">No previous orders.</div>
        ) : (
          <table className="orders">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{new Date(o.created_at).toLocaleDateString()}</td>
                  <td>{o.products?.name ?? "—"}</td>
                  <td>{centsToDollarsString(o.amount_cents)}</td>
                  <td>{o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

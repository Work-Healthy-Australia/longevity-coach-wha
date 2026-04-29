"use client";

import { CrudTable } from "../_components/CrudTable";
import { centsToDollarsString } from "@/lib/pricing/calculate";

export type PlanRow = {
  id: string;
  name: string;
  tier: string;
  billing_interval: string;
  stripe_price_id: string;
  base_price_cents: number;
  annual_discount_pct: number;
  feature_flags: Record<string, boolean>;
  is_active: boolean;
};

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `Request failed (${res.status})`);
  }
}

async function putJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `Request failed (${res.status})`);
  }
}

function flagsToCsv(flags: Record<string, boolean>): string {
  return Object.entries(flags ?? {})
    .filter(([, on]) => on)
    .map(([k]) => k)
    .join(", ");
}

function csvToFlags(csv: string): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  for (const k of csv.split(",").map((s) => s.trim()).filter(Boolean)) {
    flags[k] = true;
  }
  return flags;
}

export function PlansClient({ initialRows }: { initialRows: PlanRow[] }) {
  return (
    <CrudTable<PlanRow>
      rows={initialRows}
      columns={[
        { header: "Name", cell: (r) => r.name },
        { header: "Tier", cell: (r) => r.tier },
        { header: "Interval", cell: (r) => r.billing_interval },
        { header: "Price", cell: (r) => centsToDollarsString(r.base_price_cents) },
        { header: "Stripe Price ID", cell: (r) => <code>{r.stripe_price_id}</code> },
      ]}
      onPatch={(id, body) => putJson(`/api/admin/plans/${id}`, body)}
      onUpdate={async (id, form) => {
        const fd = new FormData(form);
        await putJson(`/api/admin/plans/${id}`, {
          name: String(fd.get("name") ?? ""),
          stripe_price_id: String(fd.get("stripe_price_id") ?? ""),
          base_price_cents: Number(fd.get("base_price_cents") ?? 0),
          annual_discount_pct: Number(fd.get("annual_discount_pct") ?? 0),
          feature_flags: csvToFlags(String(fd.get("feature_flags") ?? "")),
        });
      }}
      editForm={(row) => (
        <>
          <label>Name<input name="name" defaultValue={row.name} required /></label>
          <label>Stripe Price ID<input name="stripe_price_id" defaultValue={row.stripe_price_id} required /></label>
          <label>Base price (cents)
            <input name="base_price_cents" type="number" min="0" defaultValue={row.base_price_cents} required />
          </label>
          <label>Annual discount %
            <input
              name="annual_discount_pct"
              type="number"
              min="0"
              max="100"
              step="0.01"
              defaultValue={row.annual_discount_pct}
            />
          </label>
          <label>Feature flags (csv)
            <input name="feature_flags" defaultValue={flagsToCsv(row.feature_flags ?? {})} />
          </label>
        </>
      )}
      onCreate={async (form) => {
        const fd = new FormData(form);
        const flags: Record<string, boolean> = {};
        const featureFlagsCsv = String(fd.get("feature_flags") ?? "");
        for (const k of featureFlagsCsv.split(",").map((s) => s.trim()).filter(Boolean)) {
          flags[k] = true;
        }
        await postJson("/api/admin/plans", {
          name: String(fd.get("name") ?? ""),
          tier: String(fd.get("tier") ?? "individual"),
          billing_interval: String(fd.get("billing_interval") ?? "month"),
          stripe_price_id: String(fd.get("stripe_price_id") ?? ""),
          base_price_cents: Number(fd.get("base_price_cents") ?? 0),
          annual_discount_pct: Number(fd.get("annual_discount_pct") ?? 0),
          feature_flags: flags,
          is_active: true,
        });
      }}
      createForm={
        <>
          <label>Name<input name="name" required /></label>
          <label>Tier
            <select name="tier" defaultValue="individual">
              <option value="individual">individual</option>
              <option value="professional">professional</option>
              <option value="corporate">corporate</option>
            </select>
          </label>
          <label>Billing interval
            <select name="billing_interval" defaultValue="month">
              <option value="month">month</option>
              <option value="year">year</option>
            </select>
          </label>
          <label>Stripe Price ID<input name="stripe_price_id" required /></label>
          <label>Base price (cents)<input name="base_price_cents" type="number" min="0" required /></label>
          <label>Annual discount %<input name="annual_discount_pct" type="number" min="0" max="100" defaultValue="0" /></label>
          <label>Feature flags (csv)<input name="feature_flags" placeholder="supplement_protocol, pdf_export" /></label>
        </>
      }
    />
  );
}

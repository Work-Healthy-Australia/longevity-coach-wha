"use client";

import { CrudTable } from "../_components/CrudTable";
import { centsToDollarsString } from "@/lib/pricing/calculate";

export type AddonRow = {
  id: string;
  name: string;
  description: string | null;
  feature_key: string;
  stripe_price_id_monthly: string;
  stripe_price_id_annual: string;
  price_monthly_cents: number;
  price_annual_cents: number;
  min_tier: string;
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

export function AddonsClient({ initialRows }: { initialRows: AddonRow[] }) {
  return (
    <CrudTable<AddonRow>
      rows={initialRows}
      columns={[
        { header: "Name", cell: (r) => r.name },
        { header: "Feature key", cell: (r) => <code>{r.feature_key}</code> },
        { header: "Min tier", cell: (r) => r.min_tier },
        { header: "Monthly", cell: (r) => centsToDollarsString(r.price_monthly_cents) },
        { header: "Annual", cell: (r) => centsToDollarsString(r.price_annual_cents) },
      ]}
      onPatch={(id, body) => putJson(`/api/admin/plan-addons/${id}`, body)}
      onUpdate={async (id, form) => {
        const fd = new FormData(form);
        await putJson(`/api/admin/plan-addons/${id}`, {
          name: String(fd.get("name") ?? ""),
          description: (fd.get("description") as string) || null,
          price_monthly_cents: Number(fd.get("price_monthly_cents") ?? 0),
          price_annual_cents: Number(fd.get("price_annual_cents") ?? 0),
          min_tier: String(fd.get("min_tier") ?? "individual"),
          stripe_price_id_monthly: String(fd.get("stripe_price_id_monthly") ?? ""),
          stripe_price_id_annual: String(fd.get("stripe_price_id_annual") ?? ""),
        });
      }}
      editForm={(row) => (
        <>
          <label>Name<input name="name" defaultValue={row.name} required /></label>
          <label>Description<input name="description" defaultValue={row.description ?? ""} /></label>
          <label>Min tier
            <select name="min_tier" defaultValue={row.min_tier}>
              <option value="individual">individual</option>
              <option value="professional">professional</option>
              <option value="corporate">corporate</option>
            </select>
          </label>
          <label>Stripe price ID (monthly)<input name="stripe_price_id_monthly" defaultValue={row.stripe_price_id_monthly} required /></label>
          <label>Stripe price ID (annual)<input name="stripe_price_id_annual" defaultValue={row.stripe_price_id_annual} required /></label>
          <label>Price monthly (cents)<input name="price_monthly_cents" type="number" min="0" defaultValue={row.price_monthly_cents} required /></label>
          <label>Price annual (cents)<input name="price_annual_cents" type="number" min="0" defaultValue={row.price_annual_cents} required /></label>
        </>
      )}
      onCreate={async (form) => {
        const fd = new FormData(form);
        await postJson("/api/admin/plan-addons", {
          name: String(fd.get("name") ?? ""),
          description: (fd.get("description") as string) || null,
          feature_key: String(fd.get("feature_key") ?? ""),
          stripe_price_id_monthly: String(fd.get("stripe_price_id_monthly") ?? ""),
          stripe_price_id_annual: String(fd.get("stripe_price_id_annual") ?? ""),
          price_monthly_cents: Number(fd.get("price_monthly_cents") ?? 0),
          price_annual_cents: Number(fd.get("price_annual_cents") ?? 0),
          min_tier: String(fd.get("min_tier") ?? "individual"),
          is_active: true,
        });
      }}
      createForm={
        <>
          <label>Name<input name="name" required /></label>
          <label>Description<input name="description" /></label>
          <label>Feature key
            <select name="feature_key" required defaultValue="">
              <option value="" disabled>Choose…</option>
              <option value="supplement_protocol">supplement_protocol</option>
              <option value="pdf_export">pdf_export</option>
              <option value="genome_access">genome_access</option>
              <option value="advanced_risk_report">advanced_risk_report</option>
              <option value="dexa_ordering">dexa_ordering</option>
            </select>
          </label>
          <label>Min tier
            <select name="min_tier" defaultValue="individual">
              <option value="individual">individual</option>
              <option value="professional">professional</option>
              <option value="corporate">corporate</option>
            </select>
          </label>
          <label>Stripe price ID (monthly)<input name="stripe_price_id_monthly" required /></label>
          <label>Stripe price ID (annual)<input name="stripe_price_id_annual" required /></label>
          <label>Price monthly (cents)<input name="price_monthly_cents" type="number" min="0" required /></label>
          <label>Price annual (cents)<input name="price_annual_cents" type="number" min="0" required /></label>
        </>
      }
    />
  );
}

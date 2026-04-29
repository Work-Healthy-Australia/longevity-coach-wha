"use client";

import { CrudTable } from "../_components/CrudTable";
import { centsToDollarsString } from "@/lib/pricing/calculate";

export type SupplierOption = { id: string; name: string };

export type ProductRow = {
  id: string;
  supplier_id: string;
  product_code: string;
  name: string;
  description: string | null;
  category: string;
  wholesale_cents: number;
  retail_cents: number;
  stripe_price_id: string | null;
  is_active: boolean;
  supplier: { name: string } | null;
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

export function ProductsClient({
  initialRows,
  suppliers,
}: {
  initialRows: ProductRow[];
  suppliers: SupplierOption[];
}) {
  return (
    <CrudTable<ProductRow>
      rows={initialRows}
      columns={[
        { header: "Code", cell: (r) => <code>{r.product_code}</code> },
        { header: "Name", cell: (r) => r.name },
        { header: "Supplier", cell: (r) => r.supplier?.name ?? "—" },
        { header: "Category", cell: (r) => r.category },
        { header: "Retail", cell: (r) => centsToDollarsString(r.retail_cents) },
        { header: "Wholesale", cell: (r) => centsToDollarsString(r.wholesale_cents) },
        { header: "Stripe", cell: (r) => (r.stripe_price_id ? "✓" : "—") },
      ]}
      onPatch={(id, body) => putJson(`/api/admin/products/${id}`, body)}
      onCreate={async (form) => {
        const fd = new FormData(form);
        await postJson("/api/admin/products", {
          supplier_id: String(fd.get("supplier_id") ?? ""),
          product_code: String(fd.get("product_code") ?? ""),
          name: String(fd.get("name") ?? ""),
          description: (fd.get("description") as string) || null,
          category: String(fd.get("category") ?? "other"),
          wholesale_cents: Number(fd.get("wholesale_cents") ?? 0),
          retail_cents: Number(fd.get("retail_cents") ?? 0),
          stripe_price_id: (fd.get("stripe_price_id") as string) || null,
          is_active: true,
        });
      }}
      createForm={
        <>
          <label>Supplier
            <select name="supplier_id" required defaultValue="">
              <option value="" disabled>Choose…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label>Product code<input name="product_code" required /></label>
          <label>Name<input name="name" required /></label>
          <label>Description<input name="description" /></label>
          <label>Category
            <select name="category" defaultValue="other">
              <option value="imaging">imaging</option>
              <option value="pathology">pathology</option>
              <option value="genomics">genomics</option>
              <option value="hormonal">hormonal</option>
              <option value="microbiome">microbiome</option>
              <option value="other">other</option>
            </select>
          </label>
          <label>Wholesale (cents)<input name="wholesale_cents" type="number" min="0" required /></label>
          <label>Retail (cents)<input name="retail_cents" type="number" min="0" required /></label>
          <label>Stripe price ID<input name="stripe_price_id" /></label>
        </>
      }
    />
  );
}

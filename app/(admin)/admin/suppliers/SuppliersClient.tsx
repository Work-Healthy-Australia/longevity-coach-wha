"use client";

import { CrudTable } from "../_components/CrudTable";

export type SupplierRow = {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  external_identifier: string | null;
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

export function SuppliersClient({ initialRows }: { initialRows: SupplierRow[] }) {
  return (
    <CrudTable<SupplierRow>
      rows={initialRows}
      columns={[
        { header: "Name", cell: (r) => r.name },
        { header: "Email", cell: (r) => r.contact_email ?? "—" },
        { header: "Phone", cell: (r) => r.contact_phone ?? "—" },
        { header: "ABN / ID", cell: (r) => r.external_identifier ?? "—" },
      ]}
      onPatch={(id, body) => putJson(`/api/admin/suppliers/${id}`, body)}
      onUpdate={async (id, form) => {
        const fd = new FormData(form);
        await putJson(`/api/admin/suppliers/${id}`, {
          name: String(fd.get("name") ?? ""),
          contact_email: (fd.get("contact_email") as string) || null,
          contact_phone: (fd.get("contact_phone") as string) || null,
          address: (fd.get("address") as string) || null,
          external_identifier: (fd.get("external_identifier") as string) || null,
        });
      }}
      editForm={(row) => (
        <>
          <label>Name<input name="name" defaultValue={row.name} required /></label>
          <label>Contact email<input name="contact_email" type="email" defaultValue={row.contact_email ?? ""} /></label>
          <label>Contact phone<input name="contact_phone" defaultValue={row.contact_phone ?? ""} /></label>
          <label>Address<input name="address" defaultValue={row.address ?? ""} /></label>
          <label>External identifier (ABN / provider #)<input name="external_identifier" defaultValue={row.external_identifier ?? ""} /></label>
        </>
      )}
      onCreate={async (form) => {
        const fd = new FormData(form);
        await postJson("/api/admin/suppliers", {
          name: String(fd.get("name") ?? ""),
          contact_email: (fd.get("contact_email") as string) || null,
          contact_phone: (fd.get("contact_phone") as string) || null,
          address: (fd.get("address") as string) || null,
          external_identifier: (fd.get("external_identifier") as string) || null,
          is_active: true,
        });
      }}
      createForm={
        <>
          <label>Name<input name="name" required /></label>
          <label>Contact email<input name="contact_email" type="email" /></label>
          <label>Contact phone<input name="contact_phone" /></label>
          <label>Address<input name="address" /></label>
          <label>External identifier (ABN / provider #)<input name="external_identifier" /></label>
        </>
      }
    />
  );
}

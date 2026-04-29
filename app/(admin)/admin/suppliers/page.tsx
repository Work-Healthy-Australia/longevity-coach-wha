import { createAdminClient } from "@/lib/supabase/admin";

import { SuppliersClient, type SupplierRow } from "./SuppliersClient";
import "../_components/crud.css";

export const dynamic = "force-dynamic";

export default async function AdminSuppliersPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .schema("billing")
    .from("suppliers")
    .select("*")
    .order("name", { ascending: true });

  return (
    <div>
      <h1>Suppliers</h1>
      <p className="muted">External providers that fulfil test orders (labs, imaging, genomics).</p>
      <SuppliersClient initialRows={(data ?? []) as SupplierRow[]} />
    </div>
  );
}

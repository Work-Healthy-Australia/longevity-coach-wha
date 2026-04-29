import { createAdminClient } from "@/lib/supabase/admin";

import { ProductsClient, type ProductRow, type SupplierOption } from "./ProductsClient";
import "../_components/crud.css";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const admin = createAdminClient();
  const [{ data: rows }, { data: suppliers }] = await Promise.all([
    admin
      .schema("billing")
      .from("products")
      .select("*, supplier:suppliers(name)")
      .order("name", { ascending: true }),
    admin
      .schema("billing")
      .from("suppliers")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
  ]);

  return (
    <div>
      <h1>Products</h1>
      <p className="muted">Test catalog. Wholesale price is admin-only and never exposed via the public view.</p>
      <ProductsClient
        initialRows={(rows ?? []) as ProductRow[]}
        suppliers={(suppliers ?? []) as SupplierOption[]}
      />
    </div>
  );
}

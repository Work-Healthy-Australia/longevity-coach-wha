import { createAdminClient } from "@/lib/supabase/admin";

import { SuppliersClient, type Supplier, type Product } from "./SuppliersClient";

export const dynamic = "force-dynamic";

export default async function AdminSuppliersPage() {
  const admin = createAdminClient();

  const [{ data: suppliersData }, { data: productsData }] = await Promise.all([
    admin
      .schema("billing")
      .from("suppliers")
      .select("*")
      .order("name", { ascending: true }),
    admin
      .schema("billing")
      .from("products")
      .select("*")
      .order("name", { ascending: true }),
  ]);

  return (
    <SuppliersClient
      suppliers={(suppliersData ?? []) as unknown as Supplier[]}
      allProducts={(productsData ?? []) as unknown as Product[]}
    />
  );
}

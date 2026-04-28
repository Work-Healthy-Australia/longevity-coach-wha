import { createClient } from "@/lib/supabase/server";
import type { SupplementCatalogItem } from "@/lib/supplements/catalog";

/**
 * Loads the full supplement catalog. Server-only — uses the SSR Supabase client.
 * RLS allows authenticated reads; service-role bypasses RLS for pipeline workers.
 */
export async function loadCatalog(): Promise<SupplementCatalogItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("supplement_catalog").select("*");
  if (error) throw error;
  return (data ?? []) as unknown as SupplementCatalogItem[];
}

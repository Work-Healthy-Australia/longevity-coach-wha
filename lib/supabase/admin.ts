import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Service-role client - bypasses RLS. Server-only. NEVER import from
// client components or expose the secret. Used by Stripe/webhook handlers
// that need to write rows on behalf of any user.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error("Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY");
  }
  return createClient<Database>(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

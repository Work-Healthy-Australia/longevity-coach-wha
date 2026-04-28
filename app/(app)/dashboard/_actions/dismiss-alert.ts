"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Dismiss an open member_alert. RLS already restricts updates to
 * `auth.uid() = user_uuid`; the explicit `.eq("user_uuid", user.id)` is
 * defensive belt-and-braces.
 */
export async function dismissAlert(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("member_alerts")
    .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_uuid", user.id);

  revalidatePath("/dashboard");
}

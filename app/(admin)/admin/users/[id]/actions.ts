"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loose } from "@/lib/supabase/loose-table";

const Schema = z.object({
  user_id: z.string().uuid(),
});

async function requireAdminAndRequestMeta() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!callerProfile?.is_admin) redirect("/dashboard");

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  const userAgent = h.get("user-agent") ?? null;

  return { actorId: user.id, ip, userAgent };
}

/**
 * Mark a member as deceased. Admin-only — the acting admin's UUID is stored
 * as `deceased_reported_by` on the profile and an append-only row is written
 * to `deceased_log` with request metadata for AHPRA-style audit forensics.
 * Uses the service-role client because the admin doesn't own the target row.
 */
export async function markDeceased(formData: FormData) {
  const parsed = Schema.safeParse({ user_id: formData.get("user_id") });
  if (!parsed.success) throw new Error("Invalid user_id");
  const { user_id: targetId } = parsed.data;

  const { actorId, ip, userAgent } = await requireAdminAndRequestMeta();

  const admin = createAdminClient();
  await loose(admin)
    .from("profiles")
    .update({
      deceased_at: new Date().toISOString(),
      deceased_reported_by: actorId,
    })
    .eq("id", targetId);

  await loose(admin).from("deceased_log").insert({
    target_user_uuid: targetId,
    actor_uuid: actorId,
    event_type: "marked",
    request_ip: ip,
    request_user_agent: userAgent,
  });

  redirect(`/admin/users/${targetId}`);
}

/**
 * Undo a deceased marking — in case of an error. Clears both fields and
 * records a separate `unmarked` audit row.
 */
export async function unmarkDeceased(formData: FormData) {
  const parsed = Schema.safeParse({ user_id: formData.get("user_id") });
  if (!parsed.success) throw new Error("Invalid user_id");
  const { user_id: targetId } = parsed.data;

  const { actorId, ip, userAgent } = await requireAdminAndRequestMeta();

  const admin = createAdminClient();
  await loose(admin)
    .from("profiles")
    .update({
      deceased_at: null,
      deceased_reported_by: null,
    })
    .eq("id", targetId);

  await loose(admin).from("deceased_log").insert({
    target_user_uuid: targetId,
    actor_uuid: actorId,
    event_type: "unmarked",
    request_ip: ip,
    request_user_agent: userAgent,
  });

  redirect(`/admin/users/${targetId}`);
}

"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loose } from "@/lib/supabase/loose-table";
import {
  ASSIGNABLE_ROLES,
  SELF_GRANT_BLOCKED,
  type AssignableRole,
} from "@/lib/auth/roles";

const Schema = z.object({
  user_id: z.string().uuid(),
});

// Three-layer defence-in-depth: proxy.ts (URL prefix gate), (admin)/layout.tsx
// (auth + is_admin check), and requireAdminAndRequestMeta() inside each
// action (catches direct POSTs that bypass the page render). Each layer
// catches a different failure mode — not redundant.
type RoleActionState = { error?: string; success?: string };

const GrantRoleSchema = z.object({
  target_user_id: z.string().uuid(),
  role: z.enum(ASSIGNABLE_ROLES),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : v)),
});

const RevokeRoleSchema = z.object({
  assignment_id: z.string().uuid(),
  target_user_id: z.string().uuid(),
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

/**
 * Grant a role to a user via the SECURITY DEFINER `grant_role()` RPC.
 *
 * Uses the user-context client (NOT admin client) because grant_role()
 * reads `auth.uid()` to (a) enforce the actor privilege check at
 * migration 0068:293 and (b) populate `granted_by` on user_role_assignments
 * + `actor_uuid` on role_audit_log. Service-role JWT has no auth.uid(), so
 * admin client would silently bypass the gate and write NULL audit rows.
 *
 * Self-grant of admin/super_admin is blocked here (defence against lateral
 * escalation; migration 0068 has no DB-side self check). The DB still gates
 * via has_role('admin'|'super_admin') and "only super_admin can grant
 * super_admin or admin" — UI guard is layer 4 of defence.
 */
export async function grantRole(
  _prev: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const parsed = GrantRoleSchema.safeParse({
    target_user_id: formData.get("target_user_id"),
    role: formData.get("role"),
    reason: formData.get("reason") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { target_user_id, role, reason } = parsed.data;

  const { actorId } = await requireAdminAndRequestMeta();

  if (target_user_id === actorId && SELF_GRANT_BLOCKED.has(role as AssignableRole)) {
    return {
      error:
        "Self-grant of admin roles is blocked — ask another super_admin.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("grant_role", {
    target_user_uuid: target_user_id,
    grant_role: role,
    grant_scope_type: "global",
    grant_scope_id: null,
    grant_reason: reason ?? null,
  });

  if (error) {
    // Postgres unique_violation SQLSTATE — caught by the partial unique index
    // on user_role_assignments (migration 0068:109). Friendlier message than
    // the raw "duplicate key value violates unique constraint …".
    if (error.code === "23505") {
      return { error: "User already has this role." };
    }
    return { error: error.message };
  }

  revalidatePath(`/admin/users/${target_user_id}`);
  return { success: "Role granted." };
}

/**
 * Revoke a role assignment via the SECURITY DEFINER `revoke_role()` RPC.
 * Same user-context-client rationale as grantRole.
 */
export async function revokeRoleAssignment(
  _prev: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const parsed = RevokeRoleSchema.safeParse({
    assignment_id: formData.get("assignment_id"),
    target_user_id: formData.get("target_user_id"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { assignment_id, target_user_id } = parsed.data;

  await requireAdminAndRequestMeta();

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_role", {
    assignment_id,
    revoke_reason: null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/admin/users/${target_user_id}`);
  return { success: "Role revoked." };
}

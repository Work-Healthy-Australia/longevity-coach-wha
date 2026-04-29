"use server";

import { randomBytes } from "node:crypto";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getResend, getFromAddress } from "@/lib/email/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { loose } from "@/lib/supabase/loose-table";
import { createClient } from "@/lib/supabase/server";

const InviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).optional(),
  role: z.enum(["clinician", "coach"]).default("clinician"),
});

type ActionResult = { error?: string; success?: string };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin, full_name")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) redirect("/dashboard");

  return { user, admin, inviterName: profile.full_name ?? user.email ?? "The team" };
}

export async function inviteClinician(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = InviteSchema.safeParse({
    email: formData.get("email"),
    full_name: (formData.get("full_name") as string) || undefined,
    role: (formData.get("role") as string) || "clinician",
  });
  if (!parsed.success) return { error: "Enter a valid email address." };

  const { email, full_name, role } = parsed.data;
  const lower = email.toLowerCase();
  const { user, admin, inviterName } = await requireAdmin();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = (authList?.users ?? []).find((u) => u.email?.toLowerCase() === lower);

  if (existing) {
    const { data: profile } = await admin
      .from("profiles")
      .select("role, full_name")
      .eq("id", existing.id)
      .maybeSingle();

    if (profile?.role === role) {
      return { error: `${lower} is already a ${role}.` };
    }

    const { error: roleErr } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", existing.id);
    if (roleErr) return { error: "Failed to update role." };

    if (role === "clinician") {
      await loose(admin)
        .from("clinician_profiles")
        .upsert(
          {
            user_uuid: existing.id,
            full_name: full_name ?? profile?.full_name ?? lower,
            contact_email: lower,
          },
          { onConflict: "user_uuid", ignoreDuplicates: true }
        );
    }

    try {
      const resend = getResend();
      await resend.emails.send({
        from: getFromAddress(),
        to: lower,
        subject: `You've been added as a ${role} — Longevity Coach`,
        html: `<p>${inviterName} has granted you ${role} access to the Longevity Coach platform.</p>
<p><a href="${siteUrl}/clinician">Open the clinician portal →</a></p>`,
      });
    } catch {
      // Email failure is non-fatal — the role is already granted.
    }

    return { success: `${role} access granted to ${lower}.` };
  }

  // New user — record a single-use token in clinician_invites and send the
  // Supabase invite. The token is the audit anchor; status flips to 'accepted'
  // when the user signs up via the invite link.
  const token = randomBytes(24).toString("hex");
  const { error: insertError } = await loose(admin)
    .from("clinician_invites")
    .upsert(
      {
        email: lower,
        full_name: full_name ?? null,
        role,
        token,
        invited_by: user.id,
        status: "pending",
      },
      { onConflict: "email,status" }
    );
  if (insertError) return { error: "Failed to record invite." };

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(lower, {
    redirectTo: `${siteUrl}/auth/callback`,
    data: { invited_as: role, clinician_invite_token: token },
  });
  if (inviteError) {
    await loose(admin).from("clinician_invites").delete().eq("token", token);
    return { error: inviteError.message };
  }

  return { success: `Invite sent to ${lower}. They will have ${role} access on sign-up.` };
}

export async function revokeClinician(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const targetId = String(formData.get("userId") ?? "");
  if (!targetId) return { error: "Missing user id." };

  const { user, admin } = await requireAdmin();
  if (targetId === user.id) {
    return { error: "Use a different admin to change your own role." };
  }

  const { error } = await admin
    .from("profiles")
    .update({ role: "user" })
    .eq("id", targetId);
  if (error) return { error: "Failed to revoke." };

  // Soft-delete the clinician_profiles row to preserve historical appointments.
  await loose(admin).from("clinician_profiles").update({ is_active: false }).eq("user_uuid", targetId);

  return { success: "Clinician access revoked." };
}

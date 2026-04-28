"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend, getFromAddress } from "@/lib/email/client";
import { z } from "zod";

const emailSchema = z.string().email();

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

export async function inviteAdmin(_prev: unknown, formData: FormData) {
  const raw = formData.get("email");
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) return { error: "Enter a valid email address." };

  const email = parsed.data.toLowerCase();
  const { user, admin, inviterName } = await requireAdmin();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  // Check if this email already has an account.
  const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = (authList?.users ?? []).find((u) => u.email?.toLowerCase() === email);

  if (existing) {
    // User exists — check if already admin.
    const { data: profile } = await admin
      .from("profiles")
      .select("is_admin, full_name")
      .eq("id", existing.id)
      .single();

    if (profile?.is_admin) return { error: `${email} is already an admin.` };

    // Grant admin directly.
    await admin.from("profiles").update({ is_admin: true }).eq("id", existing.id);

    // Send notification email (non-fatal).
    try {
      const resend = getResend();
      await resend.emails.send({
        from: getFromAddress(),
        to: email,
        subject: "You've been granted admin access — Longevity Coach",
        html: `<p>Hi${profile?.full_name ? ` ${profile.full_name}` : ""},</p>
<p>${inviterName} has granted you admin access to the Longevity Coach platform.</p>
<p><a href="${siteUrl}/admin">Go to admin dashboard →</a></p>`,
      });
    } catch {
      // Email failure is non-fatal — access is already granted.
    }

    return { success: `Admin access granted to ${email}.` };
  }

  // New user — add to admin_invites then send Supabase invite.
  const { error: insertError } = await admin
    .from("admin_invites")
    .upsert({ email, invited_by: user.id }, { onConflict: "email" });

  if (insertError) return { error: "Failed to record invite. Try again." };

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/callback`,
    data: { invited_as_admin: true },
  });

  if (inviteError) {
    // Roll back the invite record.
    await admin.from("admin_invites").delete().eq("email", email);
    return { error: inviteError.message };
  }

  return { success: `Invite sent to ${email}. They will have admin access on sign-up.` };
}

export async function revokeAdmin(_prev: unknown, formData: FormData) {
  const targetId = formData.get("userId") as string;
  if (!targetId) return { error: "Missing user ID." };

  const { user, admin } = await requireAdmin();

  if (targetId === user.id) return { error: "You cannot revoke your own admin access." };

  const { error } = await admin
    .from("profiles")
    .update({ is_admin: false })
    .eq("id", targetId);

  if (error) return { error: "Failed to revoke access. Try again." };

  return { success: "Admin access revoked." };
}

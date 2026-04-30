"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loose } from "@/lib/supabase/loose-table";
import { parseInviteCSV } from "@/lib/org/csv-invite";
import { sendOrgInviteEmail } from "@/lib/email/org-invite";

export type BulkInviteResult = {
  sent: number;
  skipped: string[];
  errors: string[];
};

export async function bulkInvite(
  _prev: BulkInviteResult | null,
  formData: FormData,
): Promise<BulkInviteResult> {
  /* ── Auth + role check ─────────────────────────────────────────────── */
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { sent: 0, skipped: [], errors: ["Not authenticated"] };
  }

  const admin = createAdminClient();
  const db = loose(admin);

  const { data: managerRow } = await db
    .schema("billing")
    .from("organisation_members")
    .select("org_id")
    .eq("user_uuid", user.id)
    .eq("role", "health_manager")
    .maybeSingle();

  if (!managerRow) {
    return { sent: 0, skipped: [], errors: ["Not authorised — health_manager role required"] };
  }

  const orgId = (managerRow as { org_id: string }).org_id;

  /* ── Org + inviter info ────────────────────────────────────────────── */
  const [orgResult, profileResult] = await Promise.all([
    db.schema("billing").from("organisations").select("name").eq("id", orgId).single(),
    admin.from("profiles").select("full_name").eq("id", user.id).single(),
  ]);

  const orgName = (orgResult.data as { name: string } | null)?.name ?? "your organisation";
  const inviterName = (profileResult.data as { full_name: string } | null)?.full_name ?? "A team manager";

  /* ── Parse CSV ─────────────────────────────────────────────────────── */
  const csvText = formData.get("csv") as string | null;
  if (!csvText || csvText.trim().length === 0) {
    return { sent: 0, skipped: [], errors: ["No CSV data provided"] };
  }

  const { rows, errors: parseErrors } = parseInviteCSV(csvText);
  if (rows.length === 0) {
    return { sent: 0, skipped: [], errors: parseErrors.length > 0 ? parseErrors : ["No valid rows found in CSV"] };
  }

  /* ── Dedup against existing members + pending invites ───────────── */
  const emails = rows.map((r) => r.email);

  const [existingMembersResult, pendingInvitesResult] = await Promise.all([
    // Find users who are already org members by checking auth.users email
    // then cross-referencing organisation_members
    db
      .schema("billing")
      .from("organisation_members")
      .select("user_uuid")
      .eq("org_id", orgId),
    db
      .schema("billing")
      .from("org_invites")
      .select("email")
      .eq("org_id", orgId)
      .eq("status", "pending"),
  ]);

  // Get emails of existing members
  const memberUuids = ((existingMembersResult.data ?? []) as { user_uuid: string }[]).map(
    (m) => m.user_uuid,
  );
  const existingEmails = new Set<string>();
  if (memberUuids.length > 0) {
    const usersPage = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of usersPage.data?.users ?? []) {
      if (u.email && memberUuids.includes(u.id)) {
        existingEmails.add(u.email.toLowerCase());
      }
    }
  }

  const pendingEmails = new Set(
    ((pendingInvitesResult.data ?? []) as { email: string }[]).map((i) => i.email.toLowerCase()),
  );

  const skipped: string[] = [];
  const toInvite = rows.filter((r) => {
    if (existingEmails.has(r.email)) {
      skipped.push(`${r.email} (already a member)`);
      return false;
    }
    if (pendingEmails.has(r.email)) {
      skipped.push(`${r.email} (invite already pending)`);
      return false;
    }
    return true;
  });

  if (toInvite.length === 0) {
    return { sent: 0, skipped, errors: parseErrors };
  }

  /* ── Insert invites ────────────────────────────────────────────────── */
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const inviteRecords = toInvite.map((r) => ({
    org_id: orgId,
    email: r.email,
    role: "member" as const,
    token: crypto.randomUUID(),
    invited_by: user.id,
    status: "pending" as const,
    expires_at: expiresAt,
  }));

  const { error: insertError } = await db
    .schema("billing")
    .from("org_invites")
    .insert(inviteRecords);

  if (insertError) {
    return {
      sent: 0,
      skipped,
      errors: [...parseErrors, `Database error: ${insertError.message}`],
    };
  }

  /* ── Send emails (one per invite) ──────────────────────────────────── */
  const emailErrors: string[] = [];
  let sentCount = 0;

  for (const record of inviteRecords) {
    const row = toInvite.find((r) => r.email === record.email);
    try {
      await sendOrgInviteEmail({
        to: record.email,
        name: row?.name ?? "",
        orgName,
        inviterName,
        token: record.token,
      });
      sentCount++;
    } catch (err) {
      emailErrors.push(
        `Failed to email ${record.email}: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
  }

  revalidatePath("/org/members");

  return {
    sent: sentCount,
    skipped,
    errors: [...parseErrors, ...emailErrors],
  };
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAlertNotificationEmail } from "@/lib/email/alert-notification";
import { splitFullName } from "@/lib/profiles/name";

// Runs every 4 hours. Emails any open member_alerts row that hasn't been
// emailed yet, when the patient has alert_emails=true and isn't paused.
// Stamps email_sent_at to make the dispatch idempotent.

type AlertRow = {
  id: string;
  user_uuid: string;
  alert_type: string;
  severity: "info" | "attention" | "urgent";
  title: string;
  body: string;
  link_href: string | null;
};

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://janet.care";

  const { data: alerts, error } = await admin
    .from("member_alerts")
    .select("id, user_uuid, alert_type, severity, title, body, link_href")
    .eq("status", "open")
    .is("email_sent_at", null)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    console.error("[alert-notification] failed to read member_alerts:", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const rows = (alerts ?? []) as AlertRow[];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const userIds = [...new Set(rows.map((r) => r.user_uuid))];
  const [{ data: profiles }, { data: prefsRows }, authUsersResult] = await Promise.all([
    admin.from("profiles").select("id, full_name, paused_at").in("id", userIds),
    admin.from("notification_prefs").select("user_uuid, alert_emails").in("user_uuid", userIds),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const profileMap = new Map<string, { full_name: string | null; paused_at: string | null }>(
    ((profiles ?? []) as Array<{ id: string; full_name: string | null; paused_at: string | null }>)
      .map((p) => [p.id, p]),
  );
  const prefsMap = new Map<string, boolean>(
    ((prefsRows ?? []) as Array<{ user_uuid: string; alert_emails: boolean }>)
      .map((r) => [r.user_uuid, r.alert_emails]),
  );
  const emailMap = new Map<string, string>(
    ((authUsersResult.data?.users ?? []) as Array<{ id: string; email?: string | null }>)
      .filter((u): u is { id: string; email: string } => Boolean(u.email))
      .map((u) => [u.id, u.email]),
  );

  let sent = 0;
  let skipped = 0;
  for (const alert of rows) {
    const profile = profileMap.get(alert.user_uuid);
    if (!profile || profile.paused_at) { skipped += 1; continue; }
    const optedIn = prefsMap.has(alert.user_uuid) ? prefsMap.get(alert.user_uuid)! : true;
    if (!optedIn) {
      // Stamp anyway so we don't keep scanning the row forever.
      await admin.from("member_alerts").update({ email_sent_at: new Date().toISOString() }).eq("id", alert.id);
      skipped += 1;
      continue;
    }
    const email = emailMap.get(alert.user_uuid);
    if (!email) { skipped += 1; continue; }

    const { firstName } = splitFullName(profile.full_name ?? "");
    try {
      await sendAlertNotificationEmail({
        to: email,
        firstName,
        appUrl,
        title: alert.title,
        body: alert.body,
        linkHref: alert.link_href,
        severity: alert.severity,
      });
      sent += 1;
      await admin.from("member_alerts").update({ email_sent_at: new Date().toISOString() }).eq("id", alert.id);
    } catch (err) {
      console.warn(`[alert-notification] send failed for ${alert.id} (non-fatal):`, err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ ok: true, scanned: rows.length, sent, skipped });
}

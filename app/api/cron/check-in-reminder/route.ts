import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCheckInReminderEmail } from "@/lib/email/check-in-reminder";
import { splitFullName } from "@/lib/profiles/name";

// Daily 09:00 UTC — sends a check-in nudge to opted-in members who haven't
// logged in the last 36h, aren't paused, and haven't already been nudged today.

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://longevity-coach.io";

  const now = Date.now();
  const HOUR_MS = 60 * 60 * 1000;
  const cutoff36h = new Date(now - 36 * HOUR_MS).toISOString();
  const cutoff20h = new Date(now - 20 * HOUR_MS).toISOString();
  const last36hDate = cutoff36h.slice(0, 10);

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, full_name, paused_at, created_at");

  if (error) {
    console.error("[check-in-reminder] failed to load profiles:", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const eligibleProfiles = ((profiles ?? []) as Array<{
    id: string;
    full_name: string | null;
    paused_at: string | null;
    created_at: string;
  }>).filter((p) => !p.paused_at && new Date(p.created_at).getTime() <= now - 24 * HOUR_MS);

  if (eligibleProfiles.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, scanned: 0 });
  }

  const ids = eligibleProfiles.map((p) => p.id);

  const [{ data: prefsRows }, { data: logRows }, authUsersResult] = await Promise.all([
    admin.from("notification_prefs").select("user_uuid, check_in_reminders, last_check_in_reminder_sent_at").in("user_uuid", ids),
    admin
      .schema("biomarkers")
      .from("daily_logs")
      .select("user_uuid, log_date")
      .in("user_uuid", ids)
      .gte("log_date", last36hDate),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const prefs = new Map<string, { check_in_reminders: boolean; last_check_in_reminder_sent_at: string | null }>(
    ((prefsRows ?? []) as Array<{ user_uuid: string; check_in_reminders: boolean; last_check_in_reminder_sent_at: string | null }>)
      .map((r) => [r.user_uuid, r]),
  );
  const recentLoggers = new Set(((logRows ?? []) as Array<{ user_uuid: string }>).map((l) => l.user_uuid));
  const emailMap = new Map<string, string>(
    ((authUsersResult.data?.users ?? []) as Array<{ id: string; email?: string | null }>)
      .filter((u): u is { id: string; email: string } => Boolean(u.email))
      .map((u) => [u.id, u.email]),
  );

  let sent = 0;
  let skipped = 0;

  for (const profile of eligibleProfiles) {
    const email = emailMap.get(profile.id);
    if (!email) { skipped += 1; continue; }
    if (recentLoggers.has(profile.id)) { skipped += 1; continue; }

    const pref = prefs.get(profile.id);
    // Default to opt-in if no row exists (legacy users — backfill should have caught most).
    const optedIn = pref ? pref.check_in_reminders : true;
    if (!optedIn) { skipped += 1; continue; }

    // Don't double-send within 20h.
    if (pref?.last_check_in_reminder_sent_at && pref.last_check_in_reminder_sent_at > cutoff20h) {
      skipped += 1;
      continue;
    }

    const { firstName } = splitFullName(profile.full_name ?? "");
    try {
      await sendCheckInReminderEmail({ to: email, firstName, appUrl });
      sent += 1;

      const stamp = new Date().toISOString();
      await admin
        .from("notification_prefs")
        .upsert({ user_uuid: profile.id, last_check_in_reminder_sent_at: stamp, updated_at: stamp }, { onConflict: "user_uuid" });
    } catch (err) {
      console.warn(`[check-in-reminder] send failed for ${profile.id} (non-fatal):`, err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ ok: true, scanned: eligibleProfiles.length, sent, skipped });
}

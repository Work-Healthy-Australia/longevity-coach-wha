import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWeeklyDigestEmail } from "@/lib/email/weekly-digest";
import { splitFullName } from "@/lib/profiles/name";

// Monday 08:00 UTC — sends a weekly digest summarising last week's logs.

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://longevity-coach.io";

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const cutoffIso = sevenDaysAgo.toISOString();
  const cutoffDate = cutoffIso.slice(0, 10);

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, full_name, paused_at, created_at");

  if (error) {
    console.error("[weekly-digest] failed to load profiles:", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const eligibleProfiles = ((profiles ?? []) as Array<{
    id: string;
    full_name: string | null;
    paused_at: string | null;
    created_at: string;
  }>).filter((p) => !p.paused_at && new Date(p.created_at).getTime() <= now - 7 * 24 * 60 * 60 * 1000);

  if (eligibleProfiles.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, scanned: 0 });
  }

  const ids = eligibleProfiles.map((p) => p.id);

  const [{ data: prefsRows }, { data: logRows }, { data: alertRows }, authUsersResult] = await Promise.all([
    admin.from("notification_prefs").select("user_uuid, weekly_digest, last_weekly_digest_sent_at").in("user_uuid", ids),
    admin
      .schema("biomarkers")
      .from("daily_logs")
      .select("user_uuid, mood, energy_level, sleep_hours, steps, log_date")
      .in("user_uuid", ids)
      .gte("log_date", cutoffDate),
    admin.from("member_alerts").select("user_uuid").in("user_uuid", ids).eq("status", "open"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const prefs = new Map<string, { weekly_digest: boolean; last_weekly_digest_sent_at: string | null }>(
    ((prefsRows ?? []) as Array<{ user_uuid: string; weekly_digest: boolean; last_weekly_digest_sent_at: string | null }>)
      .map((r) => [r.user_uuid, r]),
  );

  type LogRow = { user_uuid: string; mood: number | null; energy_level: number | null; sleep_hours: number | null; steps: number | null; log_date: string };
  const logsByUser = new Map<string, LogRow[]>();
  for (const log of (logRows ?? []) as LogRow[]) {
    const list = logsByUser.get(log.user_uuid) ?? [];
    list.push(log);
    logsByUser.set(log.user_uuid, list);
  }

  const openAlertCount = new Map<string, number>();
  for (const a of (alertRows ?? []) as Array<{ user_uuid: string }>) {
    openAlertCount.set(a.user_uuid, (openAlertCount.get(a.user_uuid) ?? 0) + 1);
  }

  const emailMap = new Map<string, string>(
    ((authUsersResult.data?.users ?? []) as Array<{ id: string; email?: string | null }>)
      .filter((u): u is { id: string; email: string } => Boolean(u.email))
      .map((u) => [u.id, u.email]),
  );

  // Don't double-send within 6 days (gives buffer if cron fires twice).
  const minGapMs = 6 * 24 * 60 * 60 * 1000;
  let sent = 0;
  let skipped = 0;

  for (const profile of eligibleProfiles) {
    const email = emailMap.get(profile.id);
    if (!email) { skipped += 1; continue; }
    const pref = prefs.get(profile.id);
    const optedIn = pref ? pref.weekly_digest : true;
    if (!optedIn) { skipped += 1; continue; }
    if (pref?.last_weekly_digest_sent_at && now - new Date(pref.last_weekly_digest_sent_at).getTime() < minGapMs) {
      skipped += 1;
      continue;
    }

    const logs = logsByUser.get(profile.id) ?? [];
    const avgOf = (sel: (l: LogRow) => number | null): number | null => {
      const nums = logs.map(sel).filter((v): v is number => v != null);
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    };

    const { firstName } = splitFullName(profile.full_name ?? "");
    try {
      await sendWeeklyDigestEmail({
        to: email,
        firstName,
        appUrl,
        daysLogged: logs.length,
        avgSleep: avgOf((l) => l.sleep_hours),
        avgMood: avgOf((l) => l.mood),
        avgEnergy: avgOf((l) => l.energy_level),
        avgSteps: avgOf((l) => l.steps),
        openAlerts: openAlertCount.get(profile.id) ?? 0,
      });
      sent += 1;
      const stamp = new Date().toISOString();
      await admin
        .from("notification_prefs")
        .upsert({ user_uuid: profile.id, last_weekly_digest_sent_at: stamp, updated_at: stamp }, { onConflict: "user_uuid" });
    } catch (err) {
      console.warn(`[weekly-digest] send failed for ${profile.id} (non-fatal):`, err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ ok: true, scanned: eligibleProfiles.length, sent, skipped });
}

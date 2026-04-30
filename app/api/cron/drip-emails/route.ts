import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDripEmail } from "@/lib/email/drip";
import { splitFullName } from "@/lib/profiles/name";

// Hard cap per cron run — keeps a backlog from blowing through Resend quota in one tick.
const MAX_SENDS_PER_RUN = 50;

// Vercel cron job — runs daily at 08:00 UTC.
// Secured by CRON_SECRET header that Vercel sets automatically.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://janet.care";

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, full_name, drip_day1_sent_at, drip_day3_sent_at, drip_day7_sent_at, created_at");

  if (error) {
    console.error("[Drip] Failed to load profiles:", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // Only email users whose address is confirmed — skips abandoned/unverified signups
  // that would otherwise waste sends and trip Resend's rate limit.
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map(
    authUsers.users
      .filter((u) => u.email && u.email_confirmed_at)
      .map((u) => [u.id, u.email!] as const)
  );

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  let sent = 0;
  let skippedUnconfirmed = 0;
  let cappedRemaining = 0;

  for (const profile of profiles ?? []) {
    if (sent >= MAX_SENDS_PER_RUN) {
      cappedRemaining++;
      continue;
    }

    const email = emailMap.get(profile.id);
    if (!email) {
      skippedUnconfirmed++;
      continue;
    }

    const signupMs = new Date(profile.created_at).getTime();
    const daysSince = (now - signupMs) / DAY_MS;
    const { firstName } = splitFullName(profile.full_name ?? "");
    const args = { to: email, firstName, appUrl };

    if (daysSince >= 1 && !profile.drip_day1_sent_at && sent < MAX_SENDS_PER_RUN) {
      try {
        await sendDripEmail({ ...args, day: 1 });
        await admin
          .from("profiles")
          .update({ drip_day1_sent_at: new Date().toISOString() })
          .eq("id", profile.id);
        sent++;
      } catch (err) {
        console.error(`[Drip] Day-1 failed for ${profile.id}:`, err);
      }
    }

    if (daysSince >= 3 && !profile.drip_day3_sent_at && sent < MAX_SENDS_PER_RUN) {
      try {
        await sendDripEmail({ ...args, day: 3 });
        await admin
          .from("profiles")
          .update({ drip_day3_sent_at: new Date().toISOString() })
          .eq("id", profile.id);
        sent++;
      } catch (err) {
        console.error(`[Drip] Day-3 failed for ${profile.id}:`, err);
      }
    }

    if (daysSince >= 7 && !profile.drip_day7_sent_at && sent < MAX_SENDS_PER_RUN) {
      try {
        await sendDripEmail({ ...args, day: 7 });
        await admin
          .from("profiles")
          .update({ drip_day7_sent_at: new Date().toISOString() })
          .eq("id", profile.id);
        sent++;
      } catch (err) {
        console.error(`[Drip] Day-7 failed for ${profile.id}:`, err);
      }
    }
  }

  console.log(
    `[Drip] Run complete. Sent: ${sent}, skipped unconfirmed: ${skippedUnconfirmed}, capped remaining: ${cappedRemaining}`
  );
  return NextResponse.json({ ok: true, sent, skippedUnconfirmed, cappedRemaining });
}

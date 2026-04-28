import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDripEmail } from "@/lib/email/drip";
import { splitFullName } from "@/lib/profiles/name";

// Vercel cron job — runs daily at 09:00 UTC.
// Secured by CRON_SECRET header that Vercel sets automatically.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://longevity-coach.io";

  // Load all users who have confirmed email addresses and no subscription cancellation.
  // auth.users is not directly queryable via the JS client with admin role in the same way,
  // so we join via profiles + subscriptions.
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, full_name, drip_day1_sent_at, drip_day3_sent_at, drip_day7_sent_at, created_at");

  if (error) {
    console.error("[Drip] Failed to load profiles:", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // Load emails from auth.users via admin auth API
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map(authUsers.users.map((u) => [u.id, u.email]));

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  let sent = 0;

  for (const profile of profiles ?? []) {
    const email = emailMap.get(profile.id);
    if (!email) continue;

    const signupMs = new Date(profile.created_at).getTime();
    const daysSince = (now - signupMs) / DAY_MS;
    const { firstName } = splitFullName(profile.full_name ?? "");
    const args = { to: email, firstName, appUrl };

    // Day 1 — send 1+ days after signup, only once
    if (daysSince >= 1 && !profile.drip_day1_sent_at) {
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

    // Day 3 — send 3+ days after signup, only once
    if (daysSince >= 3 && !profile.drip_day3_sent_at) {
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

    // Day 7 — send 7+ days after signup, only once
    if (daysSince >= 7 && !profile.drip_day7_sent_at) {
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

  console.log(`[Drip] Run complete. Sent: ${sent}`);
  return NextResponse.json({ ok: true, sent });
}

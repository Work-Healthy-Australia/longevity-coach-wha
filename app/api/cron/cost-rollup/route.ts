import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCostAlertEmail } from "@/lib/email/cost-alert";

// Vercel cron — runs at 01:00 UTC daily.
// Sums yesterday's agent_usage and writes an agent_cost_alerts row +
// emails admins if the daily budget is exceeded.

const DEFAULT_DAILY_BUDGET_USD_CENTS = 5000; // $50

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const budgetUsd = Number(process.env.COST_DAILY_BUDGET_USD);
  const thresholdCents = Number.isFinite(budgetUsd) && budgetUsd > 0
    ? Math.round(budgetUsd * 100)
    : DEFAULT_DAILY_BUDGET_USD_CENTS;

  // Yesterday in UTC, full day window
  const now = new Date();
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const yStart = yesterday.toISOString();
  const yEnd = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const periodDate = yesterday.toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: rows, error: usageErr } = await admin
    .from("agent_usage")
    .select("cost_usd_cents")
    .gte("created_at", yStart)
    .lt("created_at", yEnd);

  if (usageErr) {
    console.error("[cost-rollup] failed to read agent_usage:", usageErr);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const totalCents = ((rows ?? []) as Array<{ cost_usd_cents: number }>)
    .reduce((acc, r) => acc + (r.cost_usd_cents ?? 0), 0);

  if (totalCents <= thresholdCents) {
    return NextResponse.json({
      ok: true,
      period_date: periodDate,
      total_usd_cents: totalCents,
      threshold_usd_cents: thresholdCents,
      alert_fired: false,
    });
  }

  // Over budget — upsert one alert row per period (unique index on period_date).
  const severity = totalCents >= thresholdCents * 2 ? "urgent" : "attention";
  const { error: insErr } = await admin
    .from("agent_cost_alerts")
    .upsert(
      {
        period_date: periodDate,
        cost_usd_cents: totalCents,
        threshold_usd_cents: thresholdCents,
        severity,
        status: "open",
      },
      { onConflict: "period_date" },
    );
  if (insErr) {
    console.error("[cost-rollup] failed to upsert alert:", insErr);
  }

  // Email all active admins. Non-fatal if Resend not configured.
  const { data: admins } = await admin
    .from("profiles")
    .select("id")
    .eq("is_admin", true);

  const adminIds = ((admins ?? []) as Array<{ id: string }>).map((a) => a.id);
  if (adminIds.length > 0) {
    const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const adminEmails = (authUsers?.users ?? [])
      .filter((u: { id: string; email?: string | null }) => adminIds.includes(u.id) && u.email)
      .map((u: { email?: string | null }) => u.email as string);

    const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://janet.care";
    await Promise.all(
      adminEmails.map((to: string) =>
        sendCostAlertEmail({
          to,
          periodDate,
          costUsdCents: totalCents,
          thresholdUsdCents: thresholdCents,
          appUrl,
        }),
      ),
    );
  }

  return NextResponse.json({
    ok: true,
    period_date: periodDate,
    total_usd_cents: totalCents,
    threshold_usd_cents: thresholdCents,
    alert_fired: true,
    severity,
    admins_notified: adminIds.length,
  });
}

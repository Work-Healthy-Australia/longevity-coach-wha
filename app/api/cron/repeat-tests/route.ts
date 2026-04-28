// Daily cron — emits 'repeat_test' alerts to public.member_alerts when a user's risk_scores.recommended_screenings has no matching recent biomarker. Idempotent via the (user_uuid, alert_type, source_id) where status='open' unique partial index.
// NOTE: This iterates users sequentially. As user count grows, chunk via Promise.all with a concurrency cap (e.g. p-limit) to stay within Vercel's function timeout.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateRepeatTests, type AlertDraft } from "@/lib/alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RiskScoresRow = {
  user_uuid: string;
  recommended_screenings: string[] | null;
  computed_at: string;
};

/**
 * Pure helper. Given a list of risk_scores rows (any order), return the
 * single most recent row per user (by computed_at desc).
 */
export function selectLatestPerUser(rows: RiskScoresRow[]): RiskScoresRow[] {
  const latest = new Map<string, RiskScoresRow>();
  for (const row of rows) {
    const current = latest.get(row.user_uuid);
    if (!current || row.computed_at > current.computed_at) {
      latest.set(row.user_uuid, row);
    }
  }
  return Array.from(latest.values());
}

/**
 * Pure helper. Drop drafts whose `source_id` already has an open alert.
 * Implements addendum #4: deterministic JS pre-filter, not the fictitious
 * Supabase `onConflict: 'ignore'` option.
 */
export function filterAlreadyOpen(
  drafts: AlertDraft[],
  openSourceIds: Set<string>,
): AlertDraft[] {
  return drafts.filter((d) => !openSourceIds.has(d.source_id));
}

async function runRepeatTestsCron(): Promise<{
  scanned: number;
  emitted: number;
  failed: number;
}> {
  const admin = createAdminClient();

  const { data: rawRiskScores, error: riskErr } = await admin
    .from("risk_scores")
    .select("user_uuid, recommended_screenings, computed_at")
    .order("computed_at", { ascending: false });

  if (riskErr) {
    console.error("[B7 cron] Failed to load risk_scores:", riskErr);
    return { scanned: 0, emitted: 0, failed: 0 };
  }

  const allRows = ((rawRiskScores ?? []) as unknown) as RiskScoresRow[];
  const latestPerUser = selectLatestPerUser(allRows).filter(
    (r) => Array.isArray(r.recommended_screenings) && r.recommended_screenings.length > 0,
  );

  let emitted = 0;
  let failed = 0;

  for (const row of latestPerUser) {
    try {
      const screenings = row.recommended_screenings ?? [];
      const normalised = Array.from(
        new Set(
          screenings
            .map((s) => (typeof s === "string" ? s.trim().toLowerCase() : ""))
            .filter(Boolean),
        ),
      );
      if (normalised.length === 0) continue;

      const { data: rawLabRows } = await admin
        .schema("biomarkers" as never)
        .from("lab_results")
        .select("biomarker, test_date")
        .eq("user_uuid", row.user_uuid)
        .gte(
          "test_date",
          new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        );
      const labRows =
        ((rawLabRows ?? []) as unknown) as { biomarker: string; test_date: string }[];
      const biomarkerNames = Array.from(new Set(labRows.map((r) => r.biomarker)));

      const drafts = evaluateRepeatTests({
        recommendedScreenings: normalised,
        recentLabBiomarkers: biomarkerNames,
      });
      if (drafts.length === 0) continue;

      const { data: openRows } = await admin
        .from("member_alerts")
        .select("source_id")
        .eq("user_uuid", row.user_uuid)
        .eq("alert_type", "repeat_test")
        .eq("status", "open");
      const openSourceIds = new Set(
        (openRows ?? []).map((r) => r.source_id as string),
      );

      const fresh = filterAlreadyOpen(drafts, openSourceIds);
      if (fresh.length === 0) continue;

      const { error: insertErr } = await admin.from("member_alerts").insert(
        fresh.map((d) => ({
          alert_type: d.alert_type,
          severity: d.severity,
          source_id: d.source_id,
          title: d.title,
          body: d.body,
          link_href: d.link_href,
          user_uuid: row.user_uuid,
        })),
      );
      if (insertErr) {
        console.error(
          `[B7 cron] insert failed for user ${row.user_uuid}:`,
          insertErr,
        );
        failed++;
        continue;
      }
      emitted += fresh.length;
    } catch (err) {
      console.error(`[B7 cron] user ${row.user_uuid} failed:`, err);
      failed++;
    }
  }

  return { scanned: latestPerUser.length, emitted, failed };
}

async function handle(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runRepeatTestsCron();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[B7 cron] unhandled error:", err);
    return NextResponse.json({ ok: false, error: "cron_error" });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}

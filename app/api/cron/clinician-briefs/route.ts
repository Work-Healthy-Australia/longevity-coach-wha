import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runClinicianBriefPipeline } from "@/lib/ai/pipelines/clinician-brief";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function runClinicianBriefsCron(): Promise<{ triggered: number; failed: number }> {
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("risk_scores")
    .select("user_uuid");

  if (error) {
    console.error("[clinician-briefs cron] Failed to load risk_scores:", error);
    return { triggered: 0, failed: 0 };
  }

  const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_uuid)));

  let triggered = 0;
  let failed = 0;

  for (const userId of userIds) {
    try {
      await runClinicianBriefPipeline(userId);
      triggered++;
    } catch (err) {
      console.error(`[clinician-briefs cron] Failed for user ${userId}:`, err);
      failed++;
    }
  }

  return { triggered, failed };
}

async function handle(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runClinicianBriefsCron();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[clinician-briefs cron] Unhandled error:", err);
    return NextResponse.json({ ok: true });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}

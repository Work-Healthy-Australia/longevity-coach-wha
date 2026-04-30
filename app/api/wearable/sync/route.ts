import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type WearableSyncPayload = {
  provider: string;
  date: string;
  sleep_hours?: number;
  deep_sleep_pct?: number;
  steps?: number;
  resting_heart_rate?: number;
  hrv?: number;
  active_calories?: number;
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: WearableSyncPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.provider || !body.date) {
    return NextResponse.json(
      { error: "provider and date are required" },
      { status: 400 },
    );
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(body.date)) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const upsertFields: Record<string, unknown> = {
    user_uuid: user.id,
    log_date: body.date,
    source: body.provider,
  };

  if (body.sleep_hours != null) upsertFields.sleep_hours = body.sleep_hours;
  if (body.deep_sleep_pct != null) upsertFields.deep_sleep_pct = body.deep_sleep_pct;
  if (body.steps != null) upsertFields.steps = body.steps;
  if (body.resting_heart_rate != null) upsertFields.resting_heart_rate = body.resting_heart_rate;
  if (body.hrv != null) upsertFields.hrv = body.hrv;

  const { error } = await (
    supabase.schema("biomarkers" as never) as unknown as ReturnType<typeof supabase.schema>
  )
    .from("daily_logs")
    .upsert(upsertFields, { onConflict: "user_uuid,log_date" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

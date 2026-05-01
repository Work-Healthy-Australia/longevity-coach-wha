import { createClient } from "@/lib/supabase/server";
import { CheckInForm, type LogEntry } from "./_components/check-in-form";
import { RecentStrip } from "./_components/recent-strip";
import { Scoreboard } from "./_components/scoreboard";
import { deriveGoals, extractGoalInputs } from "@/lib/goals/derive";
import "./check-in.css";

export const metadata = { title: "Daily check-in · Janet Cares" };

export default async function CheckInPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [{ data: riskData }, { data: assessmentData }] = await Promise.all([
    supabase
      .from('risk_scores')
      .select('cv_risk, metabolic_risk, neuro_risk, onco_risk, msk_risk')
      .eq('user_uuid', user!.id)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('health_profiles')
      .select('responses')
      .eq('user_uuid', user!.id)
      .not('completed_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const { weightKg, stressLevel } = extractGoalInputs(
    (assessmentData?.responses ?? null) as Record<string, unknown> | null,
  );
  const goals = deriveGoals({
    cvRisk: riskData?.cv_risk ?? null,
    metabolicRisk: riskData?.metabolic_risk ?? null,
    neuroRisk: riskData?.neuro_risk ?? null,
    mskRisk: riskData?.msk_risk ?? null,
    oncoRisk: riskData?.onco_risk ?? null,
    weightKg,
    stressLevel,
  });

  const { data: recentLogs } = await supabase
    .schema("biomarkers" as never)
    .from("daily_logs")
    .select("log_date, mood, energy_level, sleep_hours, workout_duration_min, steps, water_ml, hrv, resting_heart_rate, deep_sleep_pct, notes")
    .eq("user_uuid", user!.id)
    .gte("log_date", sevenDaysAgo.toISOString().slice(0, 10))
    .order("log_date", { ascending: false });

  const logs = (recentLogs ?? []) as unknown as LogEntry[];
  const today = new Date().toISOString().slice(0, 10);
  const todayEntry = logs.find((l) => l.log_date === today) ?? null;

  const todayScoreboard = {
    steps: todayEntry?.steps ?? null,
    sleepHours: todayEntry?.sleep_hours ?? null,
    waterGlasses: todayEntry?.water_ml ? Math.round(todayEntry.water_ml / 250) : null,
  };

  return (
    <div className="lc-checkin">
      <header className="lc-checkin-header">
        <span className="lc-checkin-eyebrow">Daily · Log</span>
        <h1>How was <em>today</em>?</h1>
        <p className="lc-checkin-lede">
          A quick log helps Janet track your trends. Two minutes is enough.
        </p>
      </header>

      <Scoreboard goals={goals} today={todayScoreboard} />

      <CheckInForm todayEntry={todayEntry} />

      <RecentStrip logs={logs} />
    </div>
  );
}

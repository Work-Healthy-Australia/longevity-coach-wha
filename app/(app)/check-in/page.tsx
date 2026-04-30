import { createClient } from "@/lib/supabase/server";
import { CheckInForm, type LogEntry } from "./_components/check-in-form";
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

  return (
    <div className="lc-checkin">
      <h1>Daily check-in</h1>
      <p className="lede">
        A quick log each day helps Janet track your progress.
      </p>

      <div className="checkin-goals">
        <h2>Today&apos;s targets</h2>
        <ul>
          <li>Steps: <strong>{goals.steps.toLocaleString()}</strong></li>
          <li>Sleep: <strong>{goals.sleepHours}h</strong></li>
          <li>Water: <strong>{goals.waterGlasses} glasses</strong></li>
          {goals.meditationMin && <li>Meditation: <strong>{goals.meditationMin} min</strong></li>}
        </ul>
      </div>

      <CheckInForm todayEntry={todayEntry} />

      {logs.length > 0 && (
        <div className="checkin-recent">
          <h2>Recent logs</h2>
          <div className="checkin-recent-list">
            {logs.map((log) => (
              <div className="checkin-recent-row" key={log.log_date}>
                <div className="checkin-recent-date">
                  {new Date(log.log_date).toLocaleDateString("en-AU", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                <div className="checkin-recent-detail">
                  Mood {log.mood ?? "—"}/10 · Energy {log.energy_level ?? "—"}/10 ·{" "}
                  {log.sleep_hours ?? "—"}h sleep
                  {log.workout_duration_min
                    ? ` · ${log.workout_duration_min}min exercise`
                    : ""}
                  {log.steps ? ` · ${log.steps} steps` : ""}
                  {log.water_ml
                    ? ` · ${Math.round(log.water_ml / 250)} glasses water`
                    : ""}
                  {log.notes && (
                    <div className="checkin-recent-notes">{log.notes}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

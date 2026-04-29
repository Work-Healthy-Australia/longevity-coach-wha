import { createClient } from "@/lib/supabase/server";
import { CheckInForm, type LogEntry } from "./_components/check-in-form";
import { deriveGoals } from "@/lib/goals/derive";
import "./check-in.css";

export const metadata = { title: "Daily check-in · Longevity Coach" };

export default async function CheckInPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [{ data: riskData }, { data: profileData }] = await Promise.all([
    supabase
      .from('risk_scores')
      .select('cv_risk, metabolic_risk, neuro_risk, msk_risk')
      .eq('user_uuid', user!.id)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('daily_goals')
      .eq('id', user!.id)
      .single(),
  ]);

  const goals = deriveGoals({
    cvRisk: riskData?.cv_risk ?? null,
    metabolicRisk: riskData?.metabolic_risk ?? null,
    neuroRisk: riskData?.neuro_risk ?? null,
    mskRisk: riskData?.msk_risk ?? null,
    weightKg: null, // not in profiles yet
    stressAnxietyIndicator: false, // questionnaire parsing deferred
  });

  const { data: recentLogs } = await supabase
    .schema("biomarkers" as never)
    .from("daily_logs")
    .select("log_date, mood, energy_level, sleep_hours, workout_duration_min, steps, water_ml, notes")
    .eq("user_uuid", user!.id)
    .gte("log_date", sevenDaysAgo.toISOString().slice(0, 10))
    .order("log_date", { ascending: false });

  const logs = (recentLogs ?? []) as unknown as LogEntry[];
  const today = new Date().toISOString().slice(0, 10);
  const todayEntry = logs.find((l) => l.log_date === today) ?? null;

  return (
    <div className="lc-checkin">
      <h1>Daily check-in</h1>
      <p className="checkin-lede">
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

import { createClient } from '@/lib/supabase/server';
import { generateWeeklyInsights } from '@/lib/insights/weekly';
import { deriveGoals } from '@/lib/goals/derive';

export const metadata = { title: 'Weekly insights · Longevity Coach' };

export default async function InsightsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [{ data: logsData }, { data: riskData }] = await Promise.all([
    supabase
      .schema('biomarkers' as never)
      .from('daily_logs')
      .select('log_date, energy_level, sleep_hours, steps, mood')
      .eq('user_uuid', user!.id)
      .gte('log_date', sevenDaysAgo.toISOString().slice(0, 10))
      .order('log_date', { ascending: true }),
    supabase
      .from('risk_scores')
      .select('cv_risk, metabolic_risk, neuro_risk, msk_risk')
      .eq('user_uuid', user!.id)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const goals = deriveGoals({
    cvRisk: riskData?.cv_risk ?? null,
    metabolicRisk: riskData?.metabolic_risk ?? null,
    neuroRisk: riskData?.neuro_risk ?? null,
    mskRisk: riskData?.msk_risk ?? null,
    weightKg: null,
    stressAnxietyIndicator: false,
  });

  const logs = (logsData ?? []) as import('@/lib/insights/weekly').DailyLogRow[];
  const insights = generateWeeklyInsights(logs, goals.steps, goals.sleepHours);

  return (
    <div className="lc-insights">
      <h1>Weekly insights</h1>
      {insights.length === 0 ? (
        <p>Keep logging daily check-ins — your weekly patterns will appear here after 3+ days of data.</p>
      ) : (
        <ul className="insights-list">
          {insights.map(insight => (
            <li key={insight.id} className={`insight-item insight-${insight.type}`}>
              {insight.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

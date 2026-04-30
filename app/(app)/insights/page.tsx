import { createClient } from '@/lib/supabase/server';
import { generateWeeklyInsights } from '@/lib/insights/weekly';
import { deriveGoals, extractGoalInputs } from '@/lib/goals/derive';
import DigestsClient from './_components/digests-client';
import './insights.css';

export const metadata = { title: 'Insights · Longevity Coach' };

type HealthUpdate = {
  id: string;
  title: string;
  content: string;
  category: string;
  source: string;
  evidence_level: string;
  posted_date: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  longevity: 'Longevity',
  biohacking: 'Biohacking',
  supplements: 'Supplements',
  exercise: 'Exercise',
  nutrition: 'Nutrition',
  sleep: 'Sleep',
};

export default async function InsightsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [{ data: logsData }, { data: riskData }, { data: updatesData }, { data: assessmentData }] = await Promise.all([
    supabase
      .schema('biomarkers' as never)
      .from('daily_logs')
      .select('log_date, energy_level, sleep_hours, steps, mood')
      .eq('user_uuid', user!.id)
      .gte('log_date', sevenDaysAgo.toISOString().slice(0, 10))
      .order('log_date', { ascending: true }),
    supabase
      .from('risk_scores')
      .select('cv_risk, metabolic_risk, neuro_risk, onco_risk, msk_risk')
      .eq('user_uuid', user!.id)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('health_updates')
      .select('id, title, content, category, source, evidence_level, posted_date')
      .order('posted_date', { ascending: false })
      .limit(12),
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

  const logs = (logsData ?? []) as import('@/lib/insights/weekly').DailyLogRow[];
  const insights = generateWeeklyInsights(logs, goals.steps, goals.sleepHours);
  const updates = (updatesData ?? []) as HealthUpdate[];

  return (
    <div className="lc-insights">
      {/* Weekly check-in trends */}
      <section className="insights-section">
        <h1>Weekly insights</h1>
        {insights.length === 0 ? (
          <p className="insights-empty">
            Keep logging daily check-ins — your weekly patterns will appear here after 3+ days of data.
          </p>
        ) : (
          <ul className="insights-list">
            {insights.map(insight => (
              <li key={insight.id} className={`insight-item insight-${insight.type}`}>
                {insight.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Research digests */}
      <section className="insights-section">
        <h2 className="digests-heading">Research updates</h2>
        <p className="digests-subheading">
          Curated research from longevity and health literature, updated weekly.
        </p>
        <DigestsClient updates={updates} categoryLabels={CATEGORY_LABELS} />
      </section>
    </div>
  );
}

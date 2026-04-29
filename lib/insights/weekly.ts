export interface DailyLogRow {
  log_date: string; // YYYY-MM-DD
  energy_level: number | null;
  sleep_hours: number | null;
  steps: number | null;
  mood: number | null;
}

export interface WeeklyInsight {
  id: string;
  message: string;
  type: 'warning' | 'positive' | 'neutral';
}

export function generateWeeklyInsights(
  logs: DailyLogRow[],
  stepGoal: number = 8000,
  sleepTarget: number = 7.5,
): WeeklyInsight[] {
  const insights: WeeklyInsight[] = [];
  if (logs.length === 0) return insights;

  // Pattern 1: low energy on Mondays
  const mondays = logs.filter(l => new Date(l.log_date).getDay() === 1);
  const lowEnergyMondays = mondays.filter(l => (l.energy_level ?? 10) <= 2);
  if (lowEnergyMondays.length >= 2) {
    insights.push({
      id: 'low-energy-mondays',
      message: `Your energy is consistently low on Mondays (${lowEnergyMondays.length} of the last few weeks). Consider lighter activity on Sunday evenings.`,
      type: 'warning',
    });
  }

  // Pattern 2: sleep average below target
  const sleepValues = logs.map(l => l.sleep_hours).filter((v): v is number => v != null);
  if (sleepValues.length > 0) {
    const avgSleep = sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length;
    if (avgSleep < sleepTarget) {
      insights.push({
        id: 'low-sleep-avg',
        message: `Your sleep average this week was ${avgSleep.toFixed(1)}h — below your target of ${sleepTarget}h.`,
        type: 'warning',
      });
    } else {
      insights.push({
        id: 'good-sleep-avg',
        message: `Your average sleep this week was ${avgSleep.toFixed(1)}h — on target.`,
        type: 'positive',
      });
    }
  }

  // Pattern 3: step goal streak
  const stepGoalDays = logs.filter(l => (l.steps ?? 0) >= stepGoal).length;
  if (stepGoalDays > 0) {
    insights.push({
      id: 'step-goal-hits',
      message: `You hit your step goal (${stepGoal.toLocaleString()} steps) ${stepGoalDays} out of ${logs.length} days this week.`,
      type: stepGoalDays >= 5 ? 'positive' : 'neutral',
    });
  }

  return insights;
}

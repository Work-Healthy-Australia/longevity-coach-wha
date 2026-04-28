/*
 * Trend window timezone convention.
 *
 * The trend window aligns to UTC dates so it matches the dashboard
 * `streakDots()` and `computeStreak()` convention. `daily_logs.log_date`
 * is captured in the user's local day at write time, but bucketed here
 * by UTC date string. Users in non-UTC zones may therefore see edge-of-day
 * check-ins land in the adjacent UTC bucket. This is a known caveat shared
 * with the streak surface, not a regression introduced by trends.
 */

import type { DailyLogRow } from "./types";

export const ML_PER_GLASS = 250;

export type Metric =
  | "sleep_hours"
  | "energy_level"
  | "mood"
  | "steps"
  | "water_glasses";

export type SeriesPoint = {
  date: string; // ISO YYYY-MM-DD (UTC)
  label: string; // 'd MMM' for axis labels
  value: number | null; // null = no log that day → Recharts breaks the line
};

// Duplicated from app/(app)/dashboard/page.tsx by design — see PLAN addendum #4.
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const labelFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function formatLabel(dateStr: string): string {
  return labelFormatter.format(new Date(dateStr + "T00:00:00Z"));
}

function metricValue(row: DailyLogRow, metric: Metric): number | null {
  switch (metric) {
    case "sleep_hours":
      return row.sleep_hours;
    case "energy_level":
      return row.energy_level;
    case "mood":
      return row.mood;
    case "steps":
      return row.steps;
    case "water_glasses":
      return row.water_ml != null
        ? Math.round(row.water_ml / ML_PER_GLASS)
        : null;
  }
}

export function buildTrendSeries(
  rows: DailyLogRow[],
  metric: Metric,
  now: Date = new Date(),
  windowDays: number = 30,
): SeriesPoint[] {
  const todayStr = now.toISOString().slice(0, 10);
  const byDate = new Map<string, DailyLogRow>();
  for (const row of rows) {
    byDate.set(row.log_date, row);
  }

  const points: SeriesPoint[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const dateStr = shiftDate(todayStr, -i);
    const row = byDate.get(dateStr);
    const value = row ? metricValue(row, metric) : null;
    points.push({
      date: dateStr,
      label: formatLabel(dateStr),
      value,
    });
  }
  return points;
}

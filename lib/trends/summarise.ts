import type { Metric, SeriesPoint } from "./build-series";

export type TrendSummary = {
  metric: Metric;
  daysLogged: number;
  windowDays: number;
  latest: number | null;
  average: number | null;
};

const INTEGER_METRICS: ReadonlySet<Metric> = new Set([
  "steps",
  "water_glasses",
]);

export function summariseTrend(
  series: SeriesPoint[],
  metric: Metric,
  windowDays: number = 30,
): TrendSummary {
  const values: number[] = [];
  let latest: number | null = null;
  for (const point of series) {
    if (point.value != null) {
      values.push(point.value);
      latest = point.value;
    }
  }

  if (values.length === 0) {
    return {
      metric,
      daysLogged: 0,
      windowDays,
      latest: null,
      average: null,
    };
  }

  const sum = values.reduce((acc, v) => acc + v, 0);
  const rawAvg = sum / values.length;
  const average = INTEGER_METRICS.has(metric)
    ? Math.round(rawAvg)
    : Math.round(rawAvg * 10) / 10;

  return {
    metric,
    daysLogged: values.length,
    windowDays,
    latest,
    average,
  };
}

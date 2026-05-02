import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  buildTrendSeries,
  summariseTrend,
  type DailyLogRow,
  type Metric,
} from "@/lib/trends";
import { TrendChart } from "./_components/trend-chart";
import "./trends.css";

export const metadata = { title: "Trends" };

type CardConfig = {
  metric: Metric;
  label: string;
  unit?: string;
  format: (n: number) => string;
};

const CARDS: CardConfig[] = [
  {
    metric: "sleep_hours",
    label: "Sleep",
    unit: "hrs",
    format: (n) => n.toFixed(1).replace(/\.0$/, ""),
  },
  {
    metric: "energy_level",
    label: "Energy",
    unit: "/10",
    format: (n) => String(Math.round(n)),
  },
  {
    metric: "mood",
    label: "Mood",
    unit: "/10",
    format: (n) => String(Math.round(n)),
  },
  {
    metric: "steps",
    label: "Steps",
    format: (n) => Math.round(n).toLocaleString(),
  },
  {
    metric: "water_glasses",
    label: "Water",
    unit: "glasses",
    format: (n) => String(Math.round(n)),
  },
];

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function TrendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date().toISOString().slice(0, 10);
  const since = shiftDate(today, -29);

  const { data: rawRows } = await supabase
    .schema("biomarkers" as never)
    .from("daily_logs")
    .select("log_date, sleep_hours, energy_level, mood, steps, water_ml")
    .eq("user_uuid", user.id)
    .gte("log_date", since)
    .order("log_date", { ascending: true });

  const rows = (rawRows ?? []) as unknown as DailyLogRow[];

  if (rows.length === 0) {
    return (
      <div className="lc-trends">
        <header className="lc-trends-header">
          <h1>Trends</h1>
          <p className="lc-trends-subtitle">
            Last 30 days of your daily check-ins.
          </p>
        </header>
        <div className="lc-trends-empty">
          <h2>No check-ins yet</h2>
          <p>
            Log your daily sleep, energy, mood, steps, and water for a week and
            your trends will start showing up here.
          </p>
          <Link href="/check-in" className="lc-trends-empty-cta">
            Log your first day →
          </Link>
        </div>
      </div>
    );
  }

  const seriesByMetric = new Map(
    CARDS.map((c) => [c.metric, buildTrendSeries(rows, c.metric)] as const),
  );
  const summaries = new Map(
    CARDS.map(
      (c) =>
        [
          c.metric,
          summariseTrend(seriesByMetric.get(c.metric)!, c.metric),
        ] as const,
    ),
  );

  const daysLogged = summaries.get("sleep_hours")?.daysLogged ?? 0;

  return (
    <div className="lc-trends">
      <header className="lc-trends-header">
        <h1>Trends</h1>
        <p className="lc-trends-subtitle">
          Last 30 days of your daily check-ins.
        </p>
        <div className="lc-trends-meta">
          <span>
            <strong>{daysLogged}</strong> of last 30 days logged
          </span>
        </div>
      </header>

      <div className="lc-trends-grid">
        {CARDS.map((card) => {
          const series = seriesByMetric.get(card.metric)!;
          const summary = summaries.get(card.metric)!;
          const latestStr =
            summary.latest != null ? card.format(summary.latest) : "—";
          const avgStr =
            summary.average != null ? card.format(summary.average) : null;
          return (
            <div className="lc-trend-card" key={card.metric}>
              <div className="lc-trend-card-head">
                <h3 className="lc-trend-card-label">{card.label}</h3>
                <div className="lc-trend-card-latest">
                  {latestStr}
                  {card.unit && summary.latest != null && (
                    <span className="lc-trend-card-unit">{card.unit}</span>
                  )}
                </div>
              </div>
              {summary.daysLogged > 0 && avgStr && (
                <div className="lc-trend-card-sub">
                  Avg {avgStr} over {summary.daysLogged}{" "}
                  {summary.daysLogged === 1 ? "day" : "days"}
                </div>
              )}
              <TrendChart
                series={series}
                metric={card.metric}
                unit={card.unit}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ChartRow = {
  test_date: string;
  value: number;
  unit: string;
  reference_min: number | null;
  reference_max: number | null;
};

export type ChartPoint = {
  date: string; // ISO yyyy-mm-dd
  value: number;
  label: string; // 'd MMM' for axis
};

/**
 * Map raw lab rows to chart points sorted ascending by date.
 *
 * Pure helper, exported for unit testing — Recharts itself is not
 * tested in JSDOM (brittle and adds no value).
 */
export function toChartData(rows: ChartRow[]): ChartPoint[] {
  if (rows.length === 0) return [];
  const sorted = [...rows].sort((a, b) =>
    a.test_date < b.test_date ? -1 : a.test_date > b.test_date ? 1 : 0,
  );
  return sorted.map((r) => ({
    date: r.test_date,
    value: r.value,
    label: formatShortDate(r.test_date),
  }));
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function formatLongDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function BiomarkerChart({ rows }: { rows: ChartRow[] }) {
  const data = toChartData(rows);
  const unit = rows[0]?.unit ?? "";
  const latest = rows[rows.length - 1];
  const refMin = latest?.reference_min ?? null;
  const refMax = latest?.reference_max ?? null;
  const hasRefBand = refMin != null && refMax != null;

  return (
    <div className="lc-labs-chart" style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 16, right: 24, bottom: 12, left: 12 }}
        >
          <CartesianGrid stroke="#EDF1F4" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#8A9AA5"
            fontSize={12}
            tickMargin={8}
          />
          <YAxis
            stroke="#8A9AA5"
            fontSize={12}
            tickMargin={6}
            domain={["auto", "auto"]}
            label={{
              value: unit,
              angle: -90,
              position: "insideLeft",
              fontSize: 11,
              fill: "#8A9AA5",
            }}
          />
          {hasRefBand && (
            <ReferenceArea
              y1={refMin as number}
              y2={refMax as number}
              fill="#6B8E83"
              fillOpacity={0.12}
              stroke="none"
            />
          )}
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #E3E8EC",
              fontSize: 12,
            }}
            labelFormatter={(_label, payload) => {
              const point = payload?.[0]?.payload as ChartPoint | undefined;
              return point ? formatLongDate(point.date) : "";
            }}
            formatter={(value: number) => [`${value} ${unit}`, "Value"]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#245672"
            strokeWidth={2}
            dot={{ r: 4, fill: "#245672", stroke: "#fff", strokeWidth: 1.5 }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

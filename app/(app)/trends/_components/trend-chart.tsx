"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import type { Metric, SeriesPoint } from "@/lib/trends";

const METRIC_COLOUR: Record<Metric, string> = {
  sleep_hours: "#1F3A5F",
  energy_level: "#D9A441",
  mood: "#7CA982",
  steps: "#3F8E91",
  water_glasses: "#3B7BB0",
};

export function TrendChart({
  series,
  metric,
  unit,
}: {
  series: SeriesPoint[];
  metric: Metric;
  unit?: string;
}) {
  const stroke = METRIC_COLOUR[metric];
  const showDots = series.length < 7;
  const tickInterval = Math.max(0, Math.floor(series.length / 5) - 1);

  return (
    <div style={{ width: "100%", height: 120 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={series}
          margin={{ top: 8, right: 8, bottom: 4, left: 8 }}
        >
          <XAxis
            dataKey="label"
            stroke="#8A9AA5"
            fontSize={10}
            tickMargin={6}
            interval={tickInterval}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #E3E8EC",
              fontSize: 12,
              padding: "6px 10px",
            }}
            formatter={(value) => {
              if (value == null) return ["—", ""];
              const num = typeof value === "number" ? value : Number(value);
              if (Number.isNaN(num)) return ["—", ""];
              const formatted =
                metric === "steps" ? num.toLocaleString() : String(num);
              return [unit ? `${formatted} ${unit}` : formatted, ""];
            }}
            separator=""
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2}
            dot={
              showDots
                ? { r: 3, fill: stroke, stroke: "#fff", strokeWidth: 1 }
                : false
            }
            activeDot={{ r: 4 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

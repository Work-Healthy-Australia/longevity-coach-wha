import { describe, expect, it } from "vitest";
import { summariseTrend } from "@/lib/trends/summarise";
import type { SeriesPoint } from "@/lib/trends/build-series";

function pt(value: number | null, i: number): SeriesPoint {
  return { date: `2026-04-${String(i + 1).padStart(2, "0")}`, label: "x", value };
}

describe("summariseTrend", () => {
  it("returns zeros and nulls for an all-null series", () => {
    const series = Array.from({ length: 30 }, (_, i) => pt(null, i));
    const result = summariseTrend(series, "sleep_hours");
    expect(result).toEqual({
      metric: "sleep_hours",
      daysLogged: 0,
      windowDays: 30,
      latest: null,
      average: null,
    });
  });

  it("averages [6,7,8] to 7.0 and reports latest 8", () => {
    const series: SeriesPoint[] = [
      pt(6, 0),
      pt(7, 1),
      pt(null, 2),
      pt(8, 3),
      ...Array.from({ length: 26 }, (_, i) => pt(null, i + 4)),
    ];
    const result = summariseTrend(series, "energy_level");
    expect(result.daysLogged).toBe(3);
    expect(result.average).toBe(7);
    expect(result.latest).toBe(8);
  });

  it("rounds steps average to integer and tracks latest", () => {
    const series: SeriesPoint[] = [
      pt(5000, 0),
      pt(8000, 1),
      pt(null, 2),
      pt(10000, 3),
    ];
    const result = summariseTrend(series, "steps");
    expect(result.daysLogged).toBe(3);
    expect(result.average).toBe(7667);
    expect(result.latest).toBe(10000);
  });

  it("returns daysLogged 0 for empty array", () => {
    const result = summariseTrend([], "mood");
    expect(result.daysLogged).toBe(0);
    expect(result.latest).toBe(null);
    expect(result.average).toBe(null);
    expect(result.windowDays).toBe(30);
  });
});

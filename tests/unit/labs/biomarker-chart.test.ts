import { describe, expect, it } from "vitest";
import {
  toChartData,
  type ChartRow,
} from "@/app/(app)/labs/[biomarker]/_components/biomarker-chart";

function row(overrides: Partial<ChartRow> = {}): ChartRow {
  return {
    test_date: "2026-01-01",
    value: 100,
    unit: "mg/dL",
    reference_min: null,
    reference_max: null,
    ...overrides,
  };
}

describe("toChartData", () => {
  it("returns empty array for empty input", () => {
    expect(toChartData([])).toEqual([]);
  });

  it("maps a single row to one point with a formatted label", () => {
    const result = toChartData([row({ test_date: "2026-03-15", value: 92 })]);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-03-15");
    expect(result[0].value).toBe(92);
    // Label format is `d MMM` — independent of locale tweaks, must contain
    // the day number and month abbreviation.
    expect(result[0].label).toMatch(/15/);
    expect(result[0].label).toMatch(/Mar/);
  });

  it("sorts three rows in random order ascending by date", () => {
    const result = toChartData([
      row({ test_date: "2026-03-15", value: 92 }),
      row({ test_date: "2025-06-01", value: 110 }),
      row({ test_date: "2025-12-01", value: 100 }),
    ]);
    expect(result.map((p) => p.date)).toEqual([
      "2025-06-01",
      "2025-12-01",
      "2026-03-15",
    ]);
    expect(result.map((p) => p.value)).toEqual([110, 100, 92]);
  });
});

import { describe, expect, it } from "vitest";
import {
  ML_PER_GLASS,
  buildTrendSeries,
  type Metric,
} from "@/lib/trends/build-series";
import type { DailyLogRow } from "@/lib/trends/types";

function row(overrides: Partial<DailyLogRow> & { log_date: string }): DailyLogRow {
  return {
    blood_pressure_diastolic: null,
    blood_pressure_systolic: null,
    bowel_movements: null,
    bowel_quality: null,
    created_at: "2026-04-28T00:00:00Z",
    energy_level: null,
    gut_health: null,
    hrv: null,
    id: "00000000-0000-0000-0000-000000000000",
    log_date: overrides.log_date,
    meals_consumed: null,
    meditation_completed: null,
    meditation_duration_min: null,
    mobility_completed: null,
    mobility_duration_min: null,
    mood: null,
    notes: null,
    protein_grams: null,
    resting_heart_rate: null,
    sauna_completed: null,
    sauna_rounds: null,
    sleep_hours: null,
    sleep_quality: null,
    steps: null,
    strength_notes: null,
    stress_level: null,
    supplements_taken: [],
    updated_at: "2026-04-28T00:00:00Z",
    user_uuid: "00000000-0000-0000-0000-000000000001",
    water_ml: null,
    weight_kg: null,
    workout_completed: null,
    workout_duration_min: null,
    workout_intensity: null,
    workout_type: null,
    ...overrides,
  };
}

const NOW = new Date("2026-04-28T13:30:00Z");
const TODAY_STR = "2026-04-28";

describe("buildTrendSeries", () => {
  it("returns 30 null entries for empty rows, last entry is today (UTC)", () => {
    const result = buildTrendSeries([], "sleep_hours", NOW);
    expect(result).toHaveLength(30);
    expect(result.every((p) => p.value === null)).toBe(true);
    expect(result[29].date).toBe(TODAY_STR);
    expect(result[0].date).toBe("2026-03-30"); // 29 days earlier
  });

  it("places today's row value at the last index", () => {
    const rows = [row({ log_date: TODAY_STR, sleep_hours: 7.5 })];
    const result = buildTrendSeries(rows, "sleep_hours", NOW);
    expect(result[29].value).toBe(7.5);
    expect(result[29].date).toBe(TODAY_STR);
    expect(result.slice(0, 29).every((p) => p.value === null)).toBe(true);
  });

  it("places a now-5d row at index 24", () => {
    const rows = [row({ log_date: "2026-04-23", energy_level: 8 })];
    const result = buildTrendSeries(rows, "energy_level", NOW);
    expect(result[24].date).toBe("2026-04-23");
    expect(result[24].value).toBe(8);
    expect(result.filter((p) => p.value !== null)).toHaveLength(1);
  });

  it("converts water_ml to glasses using ML_PER_GLASS", () => {
    expect(ML_PER_GLASS).toBe(250);
    const rows = [row({ log_date: TODAY_STR, water_ml: 1000 })];
    const result = buildTrendSeries(rows, "water_glasses", NOW);
    expect(result[29].value).toBe(4);
  });

  it("ignores rows outside the window", () => {
    const rows = [row({ log_date: "2026-03-24", sleep_hours: 9 })]; // 35d ago
    const result = buildTrendSeries(rows, "sleep_hours", NOW);
    expect(result.every((p) => p.value === null)).toBe(true);
  });

  it("respects windowDays override", () => {
    const result = buildTrendSeries([], "mood" as Metric, NOW, 7);
    expect(result).toHaveLength(7);
    expect(result[6].date).toBe(TODAY_STR);
    expect(result[0].date).toBe("2026-04-22");
  });
});

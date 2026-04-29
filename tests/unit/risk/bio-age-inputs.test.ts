import { describe, it, expect } from "vitest";
import {
  buildWearableFromLogs,
  buildImagingFromLabResults,
  estimateVisceralFatFromWaist,
} from "@/lib/risk/assemble";

describe("buildWearableFromLogs — deep sleep %", () => {
  it("averages and rounds deep_sleep_pct across logs", () => {
    const wd = buildWearableFromLogs([
      { hrv: null, resting_heart_rate: null, steps: null, sleep_hours: null, deep_sleep_pct: 18.5 },
      { hrv: null, resting_heart_rate: null, steps: null, sleep_hours: null, deep_sleep_pct: 21 },
      { hrv: null, resting_heart_rate: null, steps: null, sleep_hours: null, deep_sleep_pct: null },
    ]);
    expect(wd.avg_deep_sleep_pct).toBeCloseTo(19.8, 1);
  });

  it("leaves avg_deep_sleep_pct undefined when no logs report it", () => {
    const wd = buildWearableFromLogs([
      { hrv: null, resting_heart_rate: null, steps: null, sleep_hours: null },
      { hrv: null, resting_heart_rate: null, steps: null, sleep_hours: null, deep_sleep_pct: null },
    ]);
    expect(wd.avg_deep_sleep_pct).toBeUndefined();
  });
});

describe("buildImagingFromLabResults", () => {
  it("routes DEXA visceral fat to imaging.visceral_fat_area_cm2", () => {
    const im = buildImagingFromLabResults([
      { biomarker: "Visceral Fat Area", value: 95, test_date: "2026-04-01" },
    ]);
    expect(im.visceral_fat_area_cm2).toBe(95);
  });

  it("routes coronary calcium under multiple aliases", () => {
    expect(
      buildImagingFromLabResults([
        { biomarker: "CAC", value: 120, test_date: "2026-04-01" },
      ]).coronary_calcium_score,
    ).toBe(120);
    expect(
      buildImagingFromLabResults([
        { biomarker: "Agatston", value: 80, test_date: "2026-04-01" },
      ]).coronary_calcium_score,
    ).toBe(80);
  });

  it("routes DEXA T-scores to spine and hip", () => {
    const im = buildImagingFromLabResults([
      { biomarker: "T-score Spine", value: -1.5, test_date: "2026-04-01" },
      { biomarker: "T-score Hip", value: -0.8, test_date: "2026-04-01" },
    ]);
    expect(im.DEXA_t_score_spine).toBe(-1.5);
    expect(im.DEXA_t_score_hip).toBe(-0.8);
  });

  it("ignores non-imaging biomarker rows", () => {
    const im = buildImagingFromLabResults([
      { biomarker: "ApoB", value: 90, test_date: "2026-04-01" },
      { biomarker: "HbA1c", value: 5.4, test_date: "2026-04-01" },
    ]);
    expect(im).toEqual({});
  });

  it("keeps the latest test_date when the same imaging biomarker is reported twice", () => {
    const im = buildImagingFromLabResults([
      { biomarker: "Visceral Fat Area", value: 80, test_date: "2026-01-01" },
      { biomarker: "Visceral Fat Area", value: 95, test_date: "2026-04-01" },
    ]);
    expect(im.visceral_fat_area_cm2).toBe(95);
  });
});

describe("estimateVisceralFatFromWaist", () => {
  it("returns undefined for non-finite or non-positive input", () => {
    expect(estimateVisceralFatFromWaist(0, "male")).toBeUndefined();
    expect(estimateVisceralFatFromWaist(-10, "male")).toBeUndefined();
    expect(estimateVisceralFatFromWaist(Number.NaN, "male")).toBeUndefined();
  });

  it("scores 0 below the male threshold (90 cm)", () => {
    expect(estimateVisceralFatFromWaist(85, "male")).toBe(0);
  });

  it("scores 0 below the female threshold (80 cm)", () => {
    expect(estimateVisceralFatFromWaist(75, "female")).toBe(0);
  });

  it("estimates ~50 cm² for a male at 100 cm waist", () => {
    expect(estimateVisceralFatFromWaist(100, "male")).toBe(50);
  });

  it("estimates ~100 cm² for a male at 110 cm waist", () => {
    expect(estimateVisceralFatFromWaist(110, "male")).toBe(100);
  });

  it("uses the female threshold when sex is female", () => {
    // 95 cm female = (95 - 80) * 5 = 75 cm²
    expect(estimateVisceralFatFromWaist(95, "female")).toBe(75);
    // 95 cm male  = (95 - 90) * 5 = 25 cm²
    expect(estimateVisceralFatFromWaist(95, "male")).toBe(25);
  });

  it("defaults to the male threshold when sex is undefined", () => {
    expect(estimateVisceralFatFromWaist(100, undefined)).toBe(50);
  });
});

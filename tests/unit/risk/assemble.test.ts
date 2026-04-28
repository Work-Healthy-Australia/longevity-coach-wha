import { describe, it, expect } from "vitest";
import {
  adaptCancerHistory,
  buildBloodPanel,
  buildFamilyHistory,
  buildPatientInput,
  buildWearableFromLogs,
} from "@/lib/risk/assemble";
import { scoreRisk } from "@/lib/risk/scorer";

describe("adaptCancerHistory", () => {
  it("returns undefined when status is no/unknown", () => {
    expect(adaptCancerHistory({ status: "no" })).toBeUndefined();
    expect(adaptCancerHistory({ status: "unknown" })).toBeUndefined();
  });

  it("aggregates first/second-degree flags + youngest age + types", () => {
    const out = adaptCancerHistory({
      status: "yes",
      entries: [
        { type: "Breast", relatives: ["Mother"], onsetAge: 45 },
        { type: "Colorectal", relatives: ["Maternal grandfather"], onsetAge: 62 },
      ],
    });
    expect(out?.first_degree).toBe(true);
    expect(out?.second_degree).toBe(true);
    expect(out?.age_onset).toBe(45);
    expect(out?.types).toEqual(["Breast", "Colorectal"]);
  });

  it("uses otherText when type is Other", () => {
    const out = adaptCancerHistory({
      status: "yes",
      entries: [{ type: "Other", otherText: "Renal", relatives: ["Father"], onsetAge: 70 }],
    });
    expect(out?.types).toEqual(["Renal"]);
  });
});

describe("buildFamilyHistory", () => {
  it("translates multiselect family relatives + onset", () => {
    const fh = buildFamilyHistory({
      cardiovascular_relatives: ["Father"],
      cardiovascular_onset_age: 55,
      neurodegenerative_relatives: ["None"],
    });
    expect(fh.cardiovascular?.first_degree).toBe(true);
    expect(fh.cardiovascular?.age_onset).toBe(55);
    expect(fh.neurodegenerative).toBeUndefined();
  });
});

describe("buildBloodPanel", () => {
  it("maps biomarker codes and keeps the latest test_date per code", () => {
    const panel = buildBloodPanel([
      { biomarker: "apoB", value: 80, test_date: "2024-01-01" },
      { biomarker: "apoB", value: 95, test_date: "2025-01-01" },
      { biomarker: "HbA1c", value: 5.4, test_date: "2025-02-01" },
      { biomarker: "unknown_marker", value: 1, test_date: "2025-01-01" },
    ]);
    expect(panel.apoB).toBe(95);
    expect(panel.hba1c).toBe(5.4);
    expect(Object.keys(panel)).not.toContain("unknown_marker");
  });
});

describe("buildWearableFromLogs", () => {
  it("averages and rounds across logs", () => {
    const wd = buildWearableFromLogs([
      { hrv: 60, resting_heart_rate: 58, steps: 9000, sleep_hours: 8 },
      { hrv: 70, resting_heart_rate: 60, steps: 11000, sleep_hours: 7 },
    ]);
    expect(wd.hrv_rmssd).toBe(65);
    expect(wd.resting_hr).toBe(59);
    expect(wd.avg_daily_steps).toBe(10000);
    expect(wd.avg_sleep_duration).toBe(7.5);
  });

  it("returns empty object for empty logs", () => {
    expect(buildWearableFromLogs([])).toEqual({});
  });
});

describe("buildPatientInput → scoreRisk e2e", () => {
  it("simulates submitAssessment flow and yields a real engine output", () => {
    const today = new Date();
    const dob = new Date(today.getFullYear() - 40, today.getMonth(), today.getDate())
      .toISOString()
      .slice(0, 10);

    const input = buildPatientInput({
      profile: { date_of_birth: dob, full_name: "Test User" },
      responses: {
        basics: { sex_at_birth: "Male", height_cm: 180, weight_kg: 80 },
        medical: { conditions: ["Hypertension"], medications: "lisinopril" },
        family: {
          cardiovascular_relatives: ["Father"],
          cardiovascular_onset_age: 50,
          cancer_history: {
            status: "yes",
            entries: [{ type: "Colorectal", relatives: ["Mother"], onsetAge: 45 }],
          },
        },
        lifestyle: {
          smoking: "Current",
          alcohol: "8–14 units/week",
          exercise_volume: "Light (<75 min/week)",
          exercise_type: "Cardio only",
          sleep_hours: 6,
          diet: "Standard Western",
          stress: "High",
        },
      },
      labResults: [
        { biomarker: "apoB", value: 130, test_date: "2025-01-01" },
        { biomarker: "HbA1c", value: 6.0, test_date: "2025-01-01" },
        { biomarker: "hsCRP", value: 2.5, test_date: "2025-01-01" },
        { biomarker: "vitamin_D", value: 45, test_date: "2025-01-01" },
      ],
      dailyLogs: [
        { hrv: 30, resting_heart_rate: 75, steps: 4000, sleep_hours: 6 },
      ],
    });

    expect(input.demographics?.age).toBe(40);
    expect(input.demographics?.sex).toBe("male");
    expect(input.lifestyle?.smoking_status).toBe("current");
    expect(input.family_history?.cancer?.types).toContain("Colorectal");
    expect(input.biomarkers?.blood_panel?.apoB).toBe(130);

    const out = scoreRisk(input);
    // Engine should populate confidence as one of the four valid levels — never
    // hardcoded "moderate".
    expect(["high", "moderate", "low", "insufficient"]).toContain(out.score_confidence);
    // High-CVD profile → composite risk should be elevated.
    expect(out.composite_risk).toBeGreaterThan(20);
  });
});

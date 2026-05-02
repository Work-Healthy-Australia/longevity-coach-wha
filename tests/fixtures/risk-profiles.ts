// Risk-engine test fixtures. Each is a complete `PatientInput` exercising
// a different combination of inputs:
//
//   - pristine               — optimal across all five domains, with full
//                              biomarker coverage. Should produce very_low
//                              composite risk.
//   - highCv                 — CVD-heavy profile (high apoB, smoking, BP,
//                              hypertension dx) with otherwise mediocre data.
//   - metabolicSyndrome      — high HbA1c, HOMA-IR, visceral fat, BMI; T2D
//                              family history. Pushes metabolic to high.
//   - lowData                — sparse: just demographics + smoking. Engine
//                              should still return an output but with
//                              `score_confidence.level === "insufficient"`.
//   - pristineWithWearable   — pristine but adds wearable signals to also
//                              exercise HRV / VO2max / deep_sleep paths.
//
// Snapshot tests run scoreRisk() on each fixture; those snapshots are the
// canary if anyone changes scoring weights.
//
// Schema-boundary note: `lifestyle.exercise_type` here is the engine-layer
// representation — a single joined string (e.g. "Cardio, Weights"), as
// produced by `assemble.ts:472–476` from the questionnaire's multiselect
// array. `Lifestyle.exercise_type` in `lib/risk/types.ts` is typed `string`;
// do not pass an array here. The questionnaire/form layer (where the
// multiselect array lives) is upstream of this fixture.

import type { PatientInput } from "@/lib/risk/types";

export const pristine: PatientInput = {
  patient_id: "pristine",
  demographics: { age: 35, sex: "male", height_cm: 180, weight_kg: 75 },
  family_history: {},
  medical_history: { conditions: [], medications: [] },
  lifestyle: {
    smoking_status: "never",
    exercise_minutes_weekly: 320,
    exercise_type: "Mixed cardio + weights",
    sleep_hours: 8,
    diet_type: "mediterranean",
    stress_level: "low",
    alcohol_units_weekly: 4,
  },
  biomarkers: {
    blood_panel: {
      apoB: 70,
      lp_a: 20,
      ldl: 90,
      hdl: 65,
      triglycerides: 80,
      hsCRP: 0.5,
      homocysteine: 8,
      hba1c: 5.0,
      fasting_insulin: 4,
      HOMA_IR: 1.0,
      fasting_glucose: 85,
      uric_acid: 5.0,
      ALT: 20,
      GGT: 18,
      vitamin_B12: 700,
      vitamin_D: 55,
      omega3_index: 9,
      testosterone_total: 600,
      magnesium_rbc: 6.0,
      neutrophil_lymphocyte_ratio: 1.5,
    },
    imaging: {
      coronary_calcium_score: 0,
      carotid_IMT: 0.5,
      liver_fat_fraction: 2,
      visceral_fat_area_cm2: 60,
      DEXA_t_score_spine: 0.5,
      DEXA_t_score_hip: 0.3,
    },
    genetic: { APOE_status: "e3/e3" },
    hormonal: { IGF1: 180 },
    microbiome: { diversity_index: 4.5 },
  },
  wearable_data: {},
};

export const highCv: PatientInput = {
  patient_id: "highCv",
  demographics: { age: 58, sex: "male", height_cm: 178, weight_kg: 90 },
  family_history: {
    cardiovascular: { first_degree: true, age_onset: 52 },
  },
  medical_history: {
    conditions: ["Hypertension", "High cholesterol"],
    medications: ["lisinopril"],
  },
  lifestyle: {
    smoking_status: "current",
    exercise_minutes_weekly: 60,
    exercise_type: "Cardio only",
    sleep_hours: 6,
    diet_type: "standard_western",
    stress_level: "high",
    alcohol_units_weekly: 16,
  },
  biomarkers: {
    blood_panel: {
      apoB: 145,
      lp_a: 110,
      ldl: 165,
      hdl: 35,
      triglycerides: 220,
      hsCRP: 3.5,
      homocysteine: 16,
    },
    imaging: { coronary_calcium_score: 250, carotid_IMT: 0.95 },
    genetic: { polygenic_risk_scores: { cardiovascular: 88 } },
  },
};

export const metabolicSyndrome: PatientInput = {
  patient_id: "metabolicSyndrome",
  demographics: { age: 48, sex: "female", height_cm: 165, weight_kg: 92 },
  family_history: {
    diabetes: { first_degree: true, multiple: true, age_onset: 45 },
  },
  medical_history: { conditions: ["Pre-diabetes"], medications: [] },
  lifestyle: {
    smoking_status: "former",
    exercise_minutes_weekly: 40,
    diet_type: "standard_western",
    stress_level: "moderate",
    alcohol_units_weekly: 8,
    sleep_hours: 6,
  },
  biomarkers: {
    blood_panel: {
      hba1c: 6.2,
      fasting_insulin: 14,
      HOMA_IR: 3.5,
      fasting_glucose: 115,
      triglycerides: 240,
      hdl: 38,
      uric_acid: 6.2,
      ALT: 55,
      GGT: 60,
    },
    imaging: { liver_fat_fraction: 18, visceral_fat_area_cm2: 175 },
    microbiome: { diversity_index: 2.5 },
  },
};

export const lowData: PatientInput = {
  patient_id: "lowData",
  demographics: { age: 42, sex: "female", height_cm: 170, weight_kg: 70 },
  lifestyle: { smoking_status: "never" },
};

export const pristineWithWearable: PatientInput = {
  ...pristine,
  patient_id: "pristineWithWearable",
  wearable_data: {
    resting_hr: 52,
    hrv_rmssd: 75,
    vo2max_estimated: 55,
    avg_sleep_duration: 8,
    avg_deep_sleep_pct: 22,
  },
};

export const allFixtures = {
  pristine,
  highCv,
  metabolicSyndrome,
  lowData,
  pristineWithWearable,
};

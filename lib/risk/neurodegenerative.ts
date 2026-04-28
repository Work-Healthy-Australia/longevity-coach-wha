import type { DomainResult, Factor, PatientInput } from "./types";
import { computeDomainResult } from "./scorer-utils";

export function scoreNeurodegenerative(patient: PatientInput): DomainResult {
  const factors: Factor[] = [];
  const bp = patient.biomarkers?.blood_panel || {};
  const gen = patient.biomarkers?.genetic || {};
  const wd = patient.wearable_data || {};
  const fh = patient.family_history || {};
  const ls = patient.lifestyle || {};
  const age = patient.demographics?.age || 40;
  const sex = patient.demographics?.sex || "male";

  if (gen.APOE_status) {
    const apoeScores: Record<string, number> = { "e2/e2": 0, "e2/e3": 0, "e3/e3": 10, "e3/e4": 50, "e4/e4": 90 };
    factors.push({
      name: "APOE_genotype",
      raw_value: gen.APOE_status,
      score: apoeScores[gen.APOE_status] ?? 10,
      weight: 0.15,
      modifiable: false,
      note: gen.APOE_status.includes("e4")
        ? "APOE e4 carrier — prioritise all modifiable neuro factors"
        : null,
    });
  }

  if (gen.polygenic_risk_scores?.alzheimers != null) {
    const prs = gen.polygenic_risk_scores.alzheimers;
    let s: number;
    if (prs < 25) s = 0;
    else if (prs < 50) s = 20 + ((prs - 25) / 25) * 25;
    else if (prs < 75) s = 45 + ((prs - 50) / 25) * 30;
    else s = 75;
    factors.push({ name: "genetic_prs_alzheimers", raw_value: prs, unit: "percentile", score: Math.round(s), weight: 0.08, modifiable: false });
  }

  if (fh.neurodegenerative != null) {
    const fhn = fh.neurodegenerative;
    let s: number;
    if (!fhn.first_degree) s = 0;
    else if ((fhn.age_onset || 80) > 75) s = 25;
    else if ((fhn.age_onset || 80) > 65) s = 45;
    else s = 70;
    factors.push({ name: "family_history_neuro", raw_value: fhn, score: s, weight: 0.08, modifiable: false });
  }

  if (wd.avg_deep_sleep_pct != null) {
    let s: number;
    if (wd.avg_deep_sleep_pct > 20) s = 0;
    else if (wd.avg_deep_sleep_pct > 15) s = 15 + ((20 - wd.avg_deep_sleep_pct) / 5) * 25;
    else if (wd.avg_deep_sleep_pct > 10) s = 40 + ((15 - wd.avg_deep_sleep_pct) / 5) * 30;
    else s = 70;
    factors.push({ name: "deep_sleep_pct", raw_value: wd.avg_deep_sleep_pct, unit: "%", score: Math.round(s), weight: 0.10, modifiable: true, optimal_range: "> 20% deep sleep" });
  }

  const sleepDur = wd.avg_sleep_duration ?? ls.sleep_hours;
  if (sleepDur != null) {
    let s: number;
    if (sleepDur >= 7 && sleepDur <= 9) s = 0;
    else if (sleepDur >= 6 && sleepDur < 7) s = 30;
    else if (sleepDur > 9) s = 25;
    else s = 60;
    factors.push({ name: "sleep_duration", raw_value: sleepDur, unit: "hours", score: s, weight: 0.06, modifiable: true, optimal_range: "7–9 hours" });
  }

  if (bp.hsCRP != null) {
    let s: number;
    if (bp.hsCRP < 1.0) s = 0;
    else if (bp.hsCRP < 2.0) s = 25;
    else if (bp.hsCRP < 3.0) s = 50;
    else s = 80;
    factors.push({ name: "hsCRP_neuro", raw_value: bp.hsCRP, unit: "mg/L", score: s, weight: 0.06, modifiable: true, optimal_range: "< 1.0 mg/L" });
  }

  if (bp.homocysteine != null) {
    let s: number;
    if (bp.homocysteine < 10) s = 0;
    else if (bp.homocysteine < 12) s = 20;
    else if (bp.homocysteine < 15) s = 50;
    else s = 80;
    factors.push({ name: "homocysteine_neuro", raw_value: bp.homocysteine, unit: "μmol/L", score: s, weight: 0.08, modifiable: true, optimal_range: "< 10 μmol/L" });
  }

  if (bp.vitamin_B12 != null) {
    let s: number;
    if (bp.vitamin_B12 > 600) s = 0;
    else if (bp.vitamin_B12 > 400) s = 15 + ((600 - bp.vitamin_B12) / 200) * 25;
    else if (bp.vitamin_B12 > 300) s = 40 + ((400 - bp.vitamin_B12) / 100) * 30;
    else s = 70;
    factors.push({ name: "vitamin_B12", raw_value: bp.vitamin_B12, unit: "pg/mL", score: Math.round(s), weight: 0.05, modifiable: true, optimal_range: "> 600 pg/mL" });
  }

  if (bp.vitamin_D != null) {
    let s: number;
    if (bp.vitamin_D > 50) s = 0;
    else if (bp.vitamin_D > 40) s = 10 + ((50 - bp.vitamin_D) / 10) * 20;
    else if (bp.vitamin_D > 30) s = 30 + ((40 - bp.vitamin_D) / 10) * 25;
    else if (bp.vitamin_D > 20) s = 55 + ((30 - bp.vitamin_D) / 10) * 25;
    else s = 80;
    factors.push({ name: "vitamin_D_neuro", raw_value: bp.vitamin_D, unit: "ng/mL", score: Math.round(s), weight: 0.05, modifiable: true, optimal_range: "> 50 ng/mL" });
  }

  if (bp.omega3_index != null) {
    let s: number;
    if (bp.omega3_index > 8) s = 0;
    else if (bp.omega3_index > 6) s = 15 + ((8 - bp.omega3_index) / 2) * 25;
    else if (bp.omega3_index > 4) s = 40 + ((6 - bp.omega3_index) / 2) * 30;
    else s = 70;
    factors.push({ name: "omega3_index", raw_value: bp.omega3_index, unit: "%", score: Math.round(s), weight: 0.06, modifiable: true, optimal_range: "> 8%" });
  }

  if (ls.exercise_minutes_weekly != null) {
    let s: number;
    if (ls.exercise_minutes_weekly >= 150) s = 0;
    else if (ls.exercise_minutes_weekly >= 75) s = 25 + ((150 - ls.exercise_minutes_weekly) / 75) * 30;
    else s = 55;
    factors.push({ name: "aerobic_exercise", raw_value: ls.exercise_minutes_weekly, unit: "min/wk", score: Math.round(s), weight: 0.06, modifiable: true, optimal_range: "≥ 150 min/wk" });
  }

  if (wd.hrv_rmssd != null) {
    const expectedHRV = Math.max(20, (sex === "female" ? 65 : 60) - (age - 20) * 0.7);
    const ratio = wd.hrv_rmssd / expectedHRV;
    let s: number;
    if (ratio >= 1.0) s = 0;
    else if (ratio >= 0.6) s = 25 + ((1.0 - ratio) / 0.4) * 30;
    else s = 55 + ((0.6 - ratio) / 0.6) * 25;
    factors.push({ name: "hrv_autonomic", raw_value: wd.hrv_rmssd, unit: "ms", score: Math.min(80, Math.round(s)), weight: 0.04, modifiable: true, optimal_range: `> ${Math.round(expectedHRV)} ms (age-adjusted)` });
  }

  if (ls.alcohol_units_weekly != null) {
    let s: number;
    if (ls.alcohol_units_weekly === 0) s = 5;
    else if (ls.alcohol_units_weekly <= 7) s = 0;
    else if (ls.alcohol_units_weekly <= 14) s = 25;
    else if (ls.alcohol_units_weekly <= 21) s = 50;
    else s = 80;
    factors.push({ name: "alcohol", raw_value: ls.alcohol_units_weekly, unit: "units/wk", score: s, weight: 0.04, modifiable: true, optimal_range: "0–7 units/wk" });
  }

  if (ls.stress_level) {
    const stressScores: Record<string, number> = { low: 0, moderate: 20, high: 45, chronic: 70 };
    factors.push({ name: "stress_level", raw_value: ls.stress_level, score: stressScores[ls.stress_level] ?? 30, weight: 0.04, modifiable: true, optimal_range: "Low" });
  }

  return computeDomainResult("neurodegenerative", factors, 16);
}

import type { DomainResult, Factor, PatientInput } from "./types";
import { computeDomainResult } from "./scorer-utils";

export function scoreMetabolic(patient: PatientInput): DomainResult {
  const factors: Factor[] = [];
  const bp = patient.biomarkers?.blood_panel || {};
  const img = patient.biomarkers?.imaging || {};
  const gen = patient.biomarkers?.genetic || {};
  const fh = patient.family_history || {};
  const ls = patient.lifestyle || {};
  const dem = patient.demographics || {};
  const mb = patient.biomarkers?.microbiome || {};
  const sex = dem.sex || "male";

  if (bp.hba1c != null) {
    let s: number;
    if (bp.hba1c < 5.4) s = 0;
    else if (bp.hba1c < 5.7) s = 15 + ((bp.hba1c - 5.4) / 0.3) * 25;
    else if (bp.hba1c < 6.0) s = 40 + ((bp.hba1c - 5.7) / 0.3) * 30;
    else if (bp.hba1c < 6.5) s = 70 + ((bp.hba1c - 6.0) / 0.5) * 25;
    else s = 95;
    factors.push({ name: "hba1c", raw_value: bp.hba1c, unit: "%", score: Math.round(s), weight: 0.12, modifiable: true, optimal_range: "< 5.4%" });
  }

  if (bp.fasting_insulin != null) {
    let s: number;
    if (bp.fasting_insulin < 5) s = 0;
    else if (bp.fasting_insulin < 8) s = 15 + ((bp.fasting_insulin - 5) / 3) * 25;
    else if (bp.fasting_insulin < 12) s = 40 + ((bp.fasting_insulin - 8) / 4) * 30;
    else s = 70;
    factors.push({ name: "fasting_insulin", raw_value: bp.fasting_insulin, unit: "μIU/mL", score: Math.round(s), weight: 0.10, modifiable: true, optimal_range: "< 5 μIU/mL" });
  }

  if (bp.HOMA_IR != null) {
    let s: number;
    if (bp.HOMA_IR < 1.5) s = 0;
    else if (bp.HOMA_IR < 2.0) s = 20 + ((bp.HOMA_IR - 1.5) / 0.5) * 25;
    else if (bp.HOMA_IR < 3.0) s = 45 + ((bp.HOMA_IR - 2.0) / 1.0) * 30;
    else s = 75;
    factors.push({ name: "HOMA_IR", raw_value: bp.HOMA_IR, score: Math.round(s), weight: 0.10, modifiable: true, optimal_range: "< 1.5" });
  }

  if (bp.fasting_glucose != null) {
    let s: number;
    if (bp.fasting_glucose < 90) s = 0;
    else if (bp.fasting_glucose < 100) s = 15 + ((bp.fasting_glucose - 90) / 10) * 25;
    else if (bp.fasting_glucose < 110) s = 40 + ((bp.fasting_glucose - 100) / 10) * 25;
    else if (bp.fasting_glucose < 126) s = 65 + ((bp.fasting_glucose - 110) / 16) * 30;
    else s = 95;
    factors.push({ name: "fasting_glucose", raw_value: bp.fasting_glucose, unit: "mg/dL", score: Math.round(s), weight: 0.06, modifiable: true, optimal_range: "< 90 mg/dL" });
  }

  if (bp.triglycerides != null && bp.hdl != null && bp.hdl > 0) {
    const ratio = bp.triglycerides / bp.hdl;
    let s: number;
    if (ratio < 1.5) s = 0;
    else if (ratio < 2.5) s = 25 + ((ratio - 1.5) / 1.0) * 25;
    else if (ratio < 3.5) s = 50 + ((ratio - 2.5) / 1.0) * 30;
    else s = 80;
    factors.push({ name: "tg_hdl_ratio", raw_value: Math.round(ratio * 10) / 10, score: Math.round(s), weight: 0.06, modifiable: true, optimal_range: "< 1.5" });
  }

  if (bp.uric_acid != null) {
    const low = sex === "female" ? 5.0 : 6.0;
    const mid = sex === "female" ? 6.0 : 7.0;
    const high = sex === "female" ? 7.0 : 8.0;
    let s: number;
    if (bp.uric_acid < low) s = 0;
    else if (bp.uric_acid < mid) s = 25 + ((bp.uric_acid - low) / (mid - low)) * 25;
    else if (bp.uric_acid < high) s = 50 + ((bp.uric_acid - mid) / (high - mid)) * 30;
    else s = 80;
    factors.push({ name: "uric_acid", raw_value: bp.uric_acid, unit: "mg/dL", score: Math.round(s), weight: 0.05, modifiable: true, optimal_range: sex === "female" ? "< 5.0 mg/dL" : "< 6.0 mg/dL" });
  }

  if (bp.ALT != null) {
    let s: number;
    if (bp.ALT < 25) s = 0;
    else if (bp.ALT < 40) s = 20 + ((bp.ALT - 25) / 15) * 30;
    else if (bp.ALT < 60) s = 50 + ((bp.ALT - 40) / 20) * 30;
    else s = 80;
    factors.push({ name: "ALT", raw_value: bp.ALT, unit: "U/L", score: Math.round(s), weight: 0.04, modifiable: true, optimal_range: "< 25 U/L" });
  }

  if (bp.GGT != null) {
    let s: number;
    if (bp.GGT < 25) s = 0;
    else if (bp.GGT < 40) s = 20 + ((bp.GGT - 25) / 15) * 30;
    else if (bp.GGT < 60) s = 50 + ((bp.GGT - 40) / 20) * 30;
    else s = 80;
    factors.push({ name: "GGT", raw_value: bp.GGT, unit: "U/L", score: Math.round(s), weight: 0.04, modifiable: true, optimal_range: "< 25 U/L" });
  }

  if (img.liver_fat_fraction != null) {
    let s: number;
    if (img.liver_fat_fraction < 5) s = 0;
    else if (img.liver_fat_fraction < 10) s = 30 + ((img.liver_fat_fraction - 5) / 5) * 30;
    else if (img.liver_fat_fraction < 20) s = 60 + ((img.liver_fat_fraction - 10) / 10) * 30;
    else s = 90;
    factors.push({ name: "liver_fat_fraction", raw_value: img.liver_fat_fraction, unit: "%", score: Math.round(s), weight: 0.06, modifiable: true, optimal_range: "< 5%" });
  }

  if (img.visceral_fat_area_cm2 != null) {
    let s: number;
    if (img.visceral_fat_area_cm2 < 100) s = 0;
    else if (img.visceral_fat_area_cm2 < 130) s = 30 + ((img.visceral_fat_area_cm2 - 100) / 30) * 25;
    else if (img.visceral_fat_area_cm2 < 160) s = 55 + ((img.visceral_fat_area_cm2 - 130) / 30) * 25;
    else s = 80;
    factors.push({ name: "visceral_fat", raw_value: img.visceral_fat_area_cm2, unit: "cm²", score: Math.round(s), weight: 0.06, modifiable: true, optimal_range: "< 100 cm²" });
  }

  if (dem.height_cm && dem.weight_kg) {
    const bmi = dem.weight_kg / Math.pow(dem.height_cm / 100, 2);
    let s: number;
    if (bmi >= 18.5 && bmi < 25) s = 0;
    else if (bmi < 27) s = 15 + ((bmi - 25) / 2) * 20;
    else if (bmi < 30) s = 35 + ((bmi - 27) / 3) * 25;
    else if (bmi < 35) s = 60 + ((bmi - 30) / 5) * 25;
    else s = 85;
    factors.push({
      name: "BMI (metabolic)",
      raw_value: Math.round(bmi * 10) / 10,
      score: Math.round(s),
      weight: 0.05,
      modifiable: true,
      optimal_range: "18.5–24.9",
      note: "Scored on a smooth gradient — insulin resistance and metabolic risk rise continuously with adipose excess.",
    });
  }

  if (mb.diversity_index != null) {
    let s: number;
    if (mb.diversity_index > 4.0) s = 0;
    else if (mb.diversity_index > 3.0) s = 25 + ((4.0 - mb.diversity_index) / 1.0) * 30;
    else if (mb.diversity_index > 2.0) s = 55 + ((3.0 - mb.diversity_index) / 1.0) * 30;
    else s = 85;
    factors.push({ name: "microbiome_diversity", raw_value: mb.diversity_index, score: Math.round(s), weight: 0.04, modifiable: true, optimal_range: "> 4.0 (Shannon index)" });
  }

  if (fh.diabetes != null) {
    const s = !fh.diabetes.first_degree ? 0 : fh.diabetes.multiple ? 65 : 40;
    factors.push({ name: "family_history_t2d", raw_value: fh.diabetes, score: s, weight: 0.04, modifiable: false });
  }

  if (gen.polygenic_risk_scores?.type2_diabetes != null) {
    const prs = gen.polygenic_risk_scores.type2_diabetes;
    let s: number;
    if (prs < 25) s = 0;
    else if (prs < 50) s = 15 + ((prs - 25) / 25) * 20;
    else if (prs < 75) s = 35 + ((prs - 50) / 25) * 25;
    else s = 60;
    factors.push({ name: "genetic_prs_t2d", raw_value: prs, unit: "percentile", score: Math.round(s), weight: 0.04, modifiable: false });
  }

  if (ls.diet_type) {
    const dietScores: Record<string, number> = { mediterranean: 0, paleo: 5, keto: 10, vegan: 5, vegetarian: 5, pescatarian: 5, omnivore: 20, standard_western: 55, other: 25 };
    factors.push({ name: "diet_quality", raw_value: ls.diet_type, score: dietScores[ls.diet_type] ?? 30, weight: 0.04, modifiable: true, optimal_range: "Mediterranean / whole food" });
  }

  if (ls.exercise_minutes_weekly != null) {
    let s: number;
    if (ls.exercise_minutes_weekly >= 300) s = 0;
    else if (ls.exercise_minutes_weekly >= 150) s = 15 + ((300 - ls.exercise_minutes_weekly) / 150) * 25;
    else if (ls.exercise_minutes_weekly >= 75) s = 40 + ((150 - ls.exercise_minutes_weekly) / 75) * 30;
    else s = 70;
    factors.push({ name: "exercise_volume", raw_value: ls.exercise_minutes_weekly, unit: "min/wk", score: Math.round(s), weight: 0.05, modifiable: true, optimal_range: "≥ 300 min/wk" });
  }

  return computeDomainResult("metabolic", factors, 17);
}

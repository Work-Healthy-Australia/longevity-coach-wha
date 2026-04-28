import type { DomainResult, Factor, PatientInput } from "./types";
import { computeDomainResult } from "./scorer-utils";

export function scoreOncological(patient: PatientInput): DomainResult {
  const factors: Factor[] = [];
  const bp = patient.biomarkers?.blood_panel || {};
  const gen = patient.biomarkers?.genetic || {};
  const img = patient.biomarkers?.imaging || {};
  const fh = patient.family_history || {};
  const ls = patient.lifestyle || {};
  const dem = patient.demographics || {};
  const horm = patient.biomarkers?.hormonal || {};

  if (fh.cancer != null) {
    const fhc = fh.cancer;
    let s: number;
    if (!fhc.first_degree) s = 0;
    else {
      const highRiskTypes = ["brca", "ovarian", "colorectal", "pancreatic", "melanoma"];
      const hasHigh = fhc.types?.some((t) => highRiskTypes.some((h) => t.toLowerCase().includes(h)));
      if (hasHigh && (fhc.age_onset || 70) < 50) s = 80;
      else if (hasHigh) s = 60;
      else if ((fhc.age_onset || 70) < 50) s = 55;
      else s = 35;
    }
    factors.push({ name: "family_history_cancer", raw_value: fhc, score: s, weight: 0.15, modifiable: false });
  }

  if (gen.BRCA1 != null || gen.BRCA2 != null) {
    let s = 0;
    if (gen.BRCA1 === "positive" || gen.BRCA2 === "positive") s = 85;
    else if (gen.BRCA1 === "VUS" || gen.BRCA2 === "VUS") s = 30;
    factors.push({ name: "BRCA_status", raw_value: { BRCA1: gen.BRCA1, BRCA2: gen.BRCA2 }, score: s, weight: 0.10, modifiable: false });
  }

  if (gen.Lynch_syndrome != null) {
    factors.push({ name: "Lynch_syndrome", raw_value: gen.Lynch_syndrome, score: gen.Lynch_syndrome === "positive" ? 80 : 0, weight: 0.08, modifiable: false });
  }

  if (gen.polygenic_risk_scores?.colorectal_cancer != null) {
    const prs = gen.polygenic_risk_scores.colorectal_cancer;
    let s: number;
    if (prs < 25) s = 0;
    else if (prs < 50) s = 15;
    else if (prs < 75) s = 35;
    else s = 60;
    factors.push({ name: "genetic_prs_cancer", raw_value: prs, unit: "percentile", score: s, weight: 0.06, modifiable: false });
  }

  if (bp.hsCRP != null) {
    let s: number;
    if (bp.hsCRP < 1.0) s = 0;
    else if (bp.hsCRP < 2.0) s = 25;
    else if (bp.hsCRP < 3.0) s = 50;
    else s = 80;
    factors.push({ name: "hsCRP_onco", raw_value: bp.hsCRP, unit: "mg/L", score: s, weight: 0.08, modifiable: true, optimal_range: "< 1.0 mg/L" });
  }

  if (bp.neutrophil_lymphocyte_ratio != null) {
    const nlr = bp.neutrophil_lymphocyte_ratio;
    let s: number;
    if (nlr < 2.0) s = 0;
    else if (nlr < 3.0) s = 20 + ((nlr - 2.0) / 1.0) * 25;
    else if (nlr < 4.0) s = 45 + ((nlr - 3.0) / 1.0) * 25;
    else s = 70;
    factors.push({ name: "NLR", raw_value: nlr, score: Math.round(s), weight: 0.06, modifiable: true, optimal_range: "< 2.0" });
  }

  if (horm.IGF1 != null) {
    const age = dem.age || 40;
    const ageExpected = Math.max(100, 250 - (age - 20) * 2);
    const ratio = horm.IGF1 / ageExpected;
    let s: number;
    if (ratio <= 1.1) s = 0;
    else if (ratio <= 1.3) s = 25;
    else if (ratio <= 1.5) s = 50;
    else s = 75;
    factors.push({ name: "IGF1", raw_value: horm.IGF1, unit: "ng/mL", score: s, weight: 0.05, modifiable: true, optimal_range: "Age-appropriate range" });
  }

  if (bp.fasting_insulin != null) {
    let s: number;
    if (bp.fasting_insulin < 5) s = 0;
    else if (bp.fasting_insulin < 8) s = 15;
    else if (bp.fasting_insulin < 12) s = 40;
    else s = 65;
    factors.push({ name: "fasting_insulin_onco", raw_value: bp.fasting_insulin, unit: "μIU/mL", score: s, weight: 0.05, modifiable: true, optimal_range: "< 5 μIU/mL" });
  }

  if (dem.height_cm && dem.weight_kg) {
    const bmi = dem.weight_kg / Math.pow(dem.height_cm / 100, 2);
    let s: number;
    if (bmi < 25) s = 0;
    else if (bmi < 30) s = 20;
    else if (bmi < 35) s = 45;
    else s = 70;
    factors.push({ name: "BMI_onco", raw_value: Math.round(bmi * 10) / 10, score: s, weight: 0.05, modifiable: true, optimal_range: "< 25" });
  }

  if (img.visceral_fat_area_cm2 != null) {
    let s: number;
    if (img.visceral_fat_area_cm2 < 100) s = 0;
    else if (img.visceral_fat_area_cm2 < 130) s = 25;
    else s = 50;
    factors.push({ name: "visceral_fat_onco", raw_value: img.visceral_fat_area_cm2, unit: "cm²", score: s, weight: 0.04, modifiable: true, optimal_range: "< 100 cm²" });
  }

  if (ls.alcohol_units_weekly != null) {
    let s: number;
    if (ls.alcohol_units_weekly <= 7) s = 0;
    else if (ls.alcohol_units_weekly <= 14) s = 35;
    else s = 75;
    factors.push({ name: "alcohol_onco", raw_value: ls.alcohol_units_weekly, unit: "units/wk", score: s, weight: 0.05, modifiable: true, optimal_range: "≤ 7 units/wk" });
  }

  if (ls.smoking_status) {
    const smokeScores: Record<string, number> = { never: 0, former_over_10y: 15, former: 30, former_under_10y: 45, current: 90 };
    factors.push({ name: "smoking_onco", raw_value: ls.smoking_status, score: smokeScores[ls.smoking_status] ?? 30, weight: 0.08, modifiable: true, optimal_range: "Never" });
  }

  if (ls.diet_type) {
    const dietScores: Record<string, number> = { mediterranean: 0, paleo: 5, keto: 10, vegan: 0, vegetarian: 5, pescatarian: 5, omnivore: 25, standard_western: 60, other: 20 };
    factors.push({ name: "diet_onco", raw_value: ls.diet_type, score: dietScores[ls.diet_type] ?? 25, weight: 0.04, modifiable: true, optimal_range: "Plant-rich, low ultra-processed" });
  }

  if (ls.exercise_minutes_weekly != null) {
    let s: number;
    if (ls.exercise_minutes_weekly >= 150) s = 0;
    else if (ls.exercise_minutes_weekly >= 75) s = 25;
    else s = 55;
    factors.push({ name: "exercise_onco", raw_value: ls.exercise_minutes_weekly, unit: "min/wk", score: s, weight: 0.04, modifiable: true, optimal_range: "≥ 150 min/wk" });
  }

  return computeDomainResult("oncological", factors, 16);
}

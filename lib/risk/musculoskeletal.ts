import type { DomainResult, Factor, PatientInput } from "./types";
import { computeDomainResult } from "./scorer-utils";

export function scoreMusculoskeletal(patient: PatientInput): DomainResult {
  const factors: Factor[] = [];
  const bp = patient.biomarkers?.blood_panel || {};
  const img = patient.biomarkers?.imaging || {};
  const fh = patient.family_history || {};
  const ls = patient.lifestyle || {};
  const dem = patient.demographics || {};
  const horm = patient.biomarkers?.hormonal || {};
  const sex = dem.sex || "male";
  const age = dem.age || 40;

  if (img.DEXA_t_score_spine != null) {
    const t = img.DEXA_t_score_spine;
    let s: number;
    if (t > -1.0) s = 0;
    else if (t > -1.5) s = 20 + ((-1.0 - t) / 0.5) * 25;
    else if (t > -2.0) s = 45 + ((-1.5 - t) / 0.5) * 25;
    else if (t > -2.5) s = 70 + ((-2.0 - t) / 0.5) * 25;
    else s = 95;
    factors.push({ name: "DEXA_spine", raw_value: t, score: Math.round(s), weight: 0.15, modifiable: true, optimal_range: "> -1.0" });
  }

  if (img.DEXA_t_score_hip != null) {
    const t = img.DEXA_t_score_hip;
    let s: number;
    if (t > -1.0) s = 0;
    else if (t > -1.5) s = 20 + ((-1.0 - t) / 0.5) * 25;
    else if (t > -2.0) s = 45 + ((-1.5 - t) / 0.5) * 25;
    else if (t > -2.5) s = 70 + ((-2.0 - t) / 0.5) * 25;
    else s = 95;
    factors.push({ name: "DEXA_hip", raw_value: t, score: Math.round(s), weight: 0.12, modifiable: true, optimal_range: "> -1.0" });
  }

  if (bp.vitamin_D != null) {
    let s: number;
    if (bp.vitamin_D > 50) s = 0;
    else if (bp.vitamin_D > 40) s = 10;
    else if (bp.vitamin_D > 30) s = 25;
    else if (bp.vitamin_D > 20) s = 50;
    else s = 80;
    factors.push({ name: "vitamin_D_msk", raw_value: bp.vitamin_D, unit: "ng/mL", score: s, weight: 0.10, modifiable: true, optimal_range: "> 50 ng/mL" });
  }

  if (sex === "male" && bp.testosterone_total != null) {
    let s: number;
    if (bp.testosterone_total > 500) s = 0;
    else if (bp.testosterone_total > 400) s = 20 + ((500 - bp.testosterone_total) / 100) * 25;
    else if (bp.testosterone_total > 300) s = 45 + ((400 - bp.testosterone_total) / 100) * 30;
    else s = 75;
    factors.push({ name: "testosterone_msk", raw_value: bp.testosterone_total, unit: "ng/dL", score: Math.round(s), weight: 0.08, modifiable: true, optimal_range: "> 500 ng/dL" });
  } else if (sex === "female" && horm.estradiol != null) {
    const isPostmeno = age >= 50;
    let s: number;
    if (!isPostmeno && horm.estradiol > 50) s = 0;
    else if (!isPostmeno && horm.estradiol > 30) s = 20;
    else if (isPostmeno && horm.estradiol < 20) s = 60;
    else s = 30;
    factors.push({ name: "estradiol_msk", raw_value: horm.estradiol, unit: "pg/mL", score: s, weight: 0.08, modifiable: true, optimal_range: "Adequate for age/menopausal status" });
  }

  if (ls.exercise_type != null || ls.exercise_minutes_weekly != null) {
    const hasResistance = !!(ls.exercise_type && /strength|resistance|mixed|powerlifting|weights/i.test(ls.exercise_type));
    let s: number;
    if (hasResistance && (ls.exercise_minutes_weekly ?? 0) >= 120) s = 0;
    else if (hasResistance) s = 25;
    else if ((ls.exercise_minutes_weekly ?? 0) >= 150) s = 40;
    else s = 60;
    factors.push({ name: "resistance_training", raw_value: { type: ls.exercise_type, minutes: ls.exercise_minutes_weekly }, score: s, weight: 0.10, modifiable: true, optimal_range: "≥ 2x resistance training/week" });
  }

  if (bp.magnesium_rbc != null) {
    let s: number;
    if (bp.magnesium_rbc > 5.5) s = 0;
    else if (bp.magnesium_rbc > 4.5) s = 20 + ((5.5 - bp.magnesium_rbc) / 1.0) * 30;
    else s = 50;
    factors.push({ name: "magnesium_rbc", raw_value: bp.magnesium_rbc, unit: "mg/dL", score: Math.round(s), weight: 0.04, modifiable: true, optimal_range: "> 5.5 mg/dL" });
  }

  if (fh.osteoporosis != null) {
    factors.push({ name: "family_history_osteoporosis", raw_value: fh.osteoporosis, score: fh.osteoporosis.first_degree ? 40 : 0, weight: 0.05, modifiable: false });
  }

  const highRisk = (sex === "female" && age >= 50) || (sex === "male" && age >= 65);
  let ageSexScore = 0;
  if (age >= 40 && !highRisk) ageSexScore = 15;
  else if (highRisk && age < 65) ageSexScore = 35;
  else if (highRisk) ageSexScore = 55;
  factors.push({ name: "age_sex_msk", raw_value: { age, sex }, score: ageSexScore, weight: 0.08, modifiable: false });

  if (bp.hsCRP != null) {
    let s: number;
    if (bp.hsCRP < 1.0) s = 0;
    else if (bp.hsCRP < 2.0) s = 20;
    else if (bp.hsCRP < 3.0) s = 40;
    else s = 65;
    factors.push({ name: "inflammation_msk", raw_value: bp.hsCRP, unit: "mg/L", score: s, weight: 0.02, modifiable: true, optimal_range: "< 1.0 mg/L" });
  }

  return computeDomainResult("musculoskeletal", factors, 14);
}

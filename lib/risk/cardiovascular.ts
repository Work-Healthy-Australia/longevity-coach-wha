import type { DomainResult, Factor, PatientInput } from "./types";
import { computeDomainResult } from "./scorer-utils";

/**
 * Compute the blood-pressure factor score (0–100, higher = worse).
 *
 * Priority chain:
 *  1. If `systolic_bp_mmHg` is a finite number AND > 0 → graded AHA-aligned bands.
 *  2. Else if `hasHTN` → existing binary score (70, or 50 with antihypertensive).
 *  3. Else → 0 (normal).
 *
 * Antihypertensive medication: when `hasAntihyp` is true AND the score is
 * driven by a numeric value, subtract 15 (clamped to ≥ 0). Reflects that
 * the medicated reading understates underlying pressure. Mirrors the
 * binary-path behaviour where antihyp drops 70 → 50.
 *
 * Returns `{ score, rawValue }`. `rawValue` is `"${sbp} mmHg"` on the numeric
 * path, `"hypertension"` on the binary path, otherwise `"normal"`.
 */
export function computeBpScore(args: {
  systolic_bp_mmHg?: number;
  hasHTN: boolean;
  hasAntihyp: boolean;
}): { score: number; rawValue: string } {
  const { systolic_bp_mmHg, hasHTN, hasAntihyp } = args;

  // LIMITATION: SBP < 90 mmHg (clinical hypotension) scores 0 — same as 110.
  // Real hypotension carries syncope/perfusion risk; the simulator UI clamps
  // to min 90 so this is unreachable today, but a future data writer (Janet,
  // questionnaire, wearable) could feed sub-90 values. Adding a hypotension
  // band is a separate clinical-review decision; documented in the change's
  // EXECUTIVE_SUMMARY.
  if (
    typeof systolic_bp_mmHg === "number" &&
    Number.isFinite(systolic_bp_mmHg) &&
    systolic_bp_mmHg > 0
  ) {
    let score: number;
    if (systolic_bp_mmHg < 120) score = 0;
    else if (systolic_bp_mmHg < 130) score = 15;
    else if (systolic_bp_mmHg < 140) score = 35;
    else if (systolic_bp_mmHg < 160) score = 60;
    else if (systolic_bp_mmHg < 180) score = 85;
    else score = 100;

    if (hasAntihyp) score = Math.max(0, score - 15);

    return { score, rawValue: `${Math.round(systolic_bp_mmHg)} mmHg` };
  }

  if (hasHTN) {
    return { score: hasAntihyp ? 50 : 70, rawValue: "hypertension" };
  }

  return { score: 0, rawValue: "normal" };
}

export function scoreCardiovascular(patient: PatientInput): DomainResult {
  const factors: Factor[] = [];
  const bp = patient.biomarkers?.blood_panel || {};
  const img = patient.biomarkers?.imaging || {};
  const gen = patient.biomarkers?.genetic || {};
  const wd = patient.wearable_data || {};
  const fh = patient.family_history || {};
  const ls = patient.lifestyle || {};
  const med = patient.medical_history || {};
  const age = patient.demographics?.age || 40;
  const sex = patient.demographics?.sex || "male";

  if (bp.apoB != null) {
    let s: number;
    if (bp.apoB < 80) s = 0;
    else if (bp.apoB < 100) s = 15 + ((bp.apoB - 80) / 20) * 25;
    else if (bp.apoB < 130) s = 40 + ((bp.apoB - 100) / 30) * 30;
    else if (bp.apoB < 160) s = 70 + ((bp.apoB - 130) / 30) * 30;
    else s = 100;
    factors.push({ name: "apoB", raw_value: bp.apoB, unit: "mg/dL", score: Math.round(s), weight: 0.12, modifiable: true, optimal_range: "< 80 mg/dL", standard_range: "< 130 mg/dL" });
  }

  if (bp.lp_a != null) {
    let s: number;
    if (bp.lp_a < 30) s = 0;
    else if (bp.lp_a < 75) s = 30 + ((bp.lp_a - 30) / 45) * 30;
    else if (bp.lp_a < 125) s = 60 + ((bp.lp_a - 75) / 50) * 30;
    else s = 90;
    factors.push({ name: "lp_a", raw_value: bp.lp_a, unit: "nmol/L", score: Math.round(s), weight: 0.08, modifiable: false, optimal_range: "< 30 nmol/L" });
  }

  if (bp.ldl != null) {
    let s: number;
    if (bp.ldl < 100) s = 0;
    else if (bp.ldl < 130) s = 20 + ((bp.ldl - 100) / 30) * 30;
    else if (bp.ldl < 160) s = 50 + ((bp.ldl - 130) / 30) * 30;
    else s = 80;
    factors.push({ name: "ldl", raw_value: bp.ldl, unit: "mg/dL", score: Math.round(s), weight: 0.06, modifiable: true, optimal_range: "< 100 mg/dL" });
  }

  if (bp.hdl != null) {
    let s: number;
    if (bp.hdl > 60) s = 0;
    else if (bp.hdl >= 50) s = 15 + ((60 - bp.hdl) / 10) * 25;
    else if (bp.hdl >= 40) s = 40 + ((50 - bp.hdl) / 10) * 30;
    else s = 70;
    factors.push({ name: "hdl", raw_value: bp.hdl, unit: "mg/dL", score: Math.round(s), weight: 0.05, modifiable: true, optimal_range: "> 60 mg/dL" });
  }

  if (bp.triglycerides != null) {
    let s: number;
    if (bp.triglycerides < 100) s = 0;
    else if (bp.triglycerides < 150) s = 20 + ((bp.triglycerides - 100) / 50) * 25;
    else if (bp.triglycerides < 200) s = 45 + ((bp.triglycerides - 150) / 50) * 30;
    else s = 75;
    factors.push({ name: "triglycerides", raw_value: bp.triglycerides, unit: "mg/dL", score: Math.round(s), weight: 0.05, modifiable: true, optimal_range: "< 100 mg/dL" });
  }

  if (bp.hsCRP != null) {
    let s: number;
    if (bp.hsCRP < 1.0) s = 0;
    else if (bp.hsCRP < 2.0) s = 25 + ((bp.hsCRP - 1.0) / 1.0) * 25;
    else if (bp.hsCRP < 3.0) s = 50 + ((bp.hsCRP - 2.0) / 1.0) * 30;
    else s = 80;
    factors.push({ name: "hsCRP", raw_value: bp.hsCRP, unit: "mg/L", score: Math.round(s), weight: 0.08, modifiable: true, optimal_range: "< 1.0 mg/L" });
  }

  if (bp.homocysteine != null) {
    let s: number;
    if (bp.homocysteine < 10) s = 0;
    else if (bp.homocysteine < 12) s = 20 + ((bp.homocysteine - 10) / 2) * 25;
    else if (bp.homocysteine < 15) s = 45 + ((bp.homocysteine - 12) / 3) * 30;
    else s = 75;
    factors.push({ name: "homocysteine", raw_value: bp.homocysteine, unit: "μmol/L", score: Math.round(s), weight: 0.05, modifiable: true, optimal_range: "< 10 μmol/L" });
  }

  const conditions = med.conditions || [];
  const meds = med.medications || [];
  const hasHTN = conditions.some((c) => /hypertension|high blood pressure/i.test(c));
  const hasAntihyp = meds.some((m) => /lisinopril|amlodipine|losartan|metoprolol|atenolol|ramipril|valsartan|perindopril/i.test(m));
  const dem = patient.demographics ?? {};
  const { score: bpScore, rawValue: bpRaw } = computeBpScore({
    systolic_bp_mmHg: dem.systolic_bp_mmHg,
    hasHTN,
    hasAntihyp,
  });
  factors.push({
    name: "blood_pressure",
    raw_value: bpRaw,
    score: bpScore,
    weight: 0.08,
    modifiable: true,
    optimal_range: "< 120/80 mmHg",
  });

  if (img.coronary_calcium_score != null) {
    let s: number;
    const cac = img.coronary_calcium_score;
    if (cac === 0) s = 0;
    else if (cac <= 10) s = 15;
    else if (cac <= 100) s = 40 + ((cac - 10) / 90) * 30;
    else if (cac <= 400) s = 70 + ((cac - 100) / 300) * 25;
    else s = 95;
    factors.push({ name: "coronary_calcium_score", raw_value: cac, unit: "Agatston", score: Math.round(s), weight: 0.10, modifiable: false, optimal_range: "0" });
  }

  if (img.carotid_IMT != null) {
    let s: number;
    const imt = img.carotid_IMT;
    if (imt < 0.6) s = 0;
    else if (imt < 0.8) s = 25 + ((imt - 0.6) / 0.2) * 25;
    else if (imt < 1.0) s = 50 + ((imt - 0.8) / 0.2) * 25;
    else s = 80;
    factors.push({ name: "carotid_IMT", raw_value: imt, unit: "mm", score: Math.round(s), weight: 0.05, modifiable: false, optimal_range: "< 0.6 mm" });
  }

  if (fh.cardiovascular != null) {
    const fhc = fh.cardiovascular;
    let s: number;
    if (!fhc.first_degree && !fhc.second_degree) s = 0;
    else if (fhc.second_degree && !fhc.first_degree) s = 20;
    else if (fhc.first_degree && (fhc.age_onset || 70) > 60) s = 40;
    else s = 75;
    factors.push({ name: "family_history_cvd", raw_value: fhc, score: s, weight: 0.08, modifiable: false });
  }

  if (wd.resting_hr != null) {
    let s: number;
    if (wd.resting_hr < 60) s = 0;
    else if (wd.resting_hr < 70) s = 15 + ((wd.resting_hr - 60) / 10) * 20;
    else if (wd.resting_hr < 80) s = 35 + ((wd.resting_hr - 70) / 10) * 25;
    else s = 60;
    factors.push({ name: "resting_hr", raw_value: wd.resting_hr, unit: "bpm", score: Math.round(s), weight: 0.04, modifiable: true, optimal_range: "< 60 bpm" });
  }

  if (wd.hrv_rmssd != null) {
    const expectedHRV = Math.max(20, (sex === "female" ? 65 : 60) - (age - 20) * 0.7);
    const ratio = wd.hrv_rmssd / expectedHRV;
    let s: number;
    if (ratio >= 1.0) s = 0;
    else if (ratio >= 0.7) s = 25 + ((1.0 - ratio) / 0.3) * 25;
    else if (ratio >= 0.5) s = 50 + ((0.7 - ratio) / 0.2) * 30;
    else s = 80;
    factors.push({ name: "hrv_rmssd", raw_value: wd.hrv_rmssd, unit: "ms", score: Math.round(s), weight: 0.04, modifiable: true, optimal_range: `> ${Math.round(expectedHRV)} ms (age-adjusted)` });
  }

  if (wd.vo2max_estimated != null) {
    const excellent = sex === "male" ? Math.max(35, 55 - (age - 30) * 0.5) : Math.max(30, 50 - (age - 30) * 0.5);
    const good = excellent * 0.85;
    const fair = excellent * 0.70;
    let s: number;
    if (wd.vo2max_estimated >= excellent) s = 0;
    else if (wd.vo2max_estimated >= good) s = 20 + ((excellent - wd.vo2max_estimated) / (excellent - good)) * 25;
    else if (wd.vo2max_estimated >= fair) s = 45 + ((good - wd.vo2max_estimated) / (good - fair)) * 30;
    else s = 75;
    factors.push({ name: "vo2max", raw_value: wd.vo2max_estimated, unit: "mL/kg/min", score: Math.round(s), weight: 0.04, modifiable: true, optimal_range: `> ${Math.round(excellent)} mL/kg/min (age-adjusted)` });
  }

  if (ls.smoking_status) {
    const smokeScores: Record<string, number> = { never: 0, former_over_10y: 10, former: 25, former_under_10y: 35, current: 90 };
    factors.push({ name: "smoking", raw_value: ls.smoking_status, score: smokeScores[ls.smoking_status] ?? 20, weight: 0.04, modifiable: true, optimal_range: "Never" });
  }

  if (gen.polygenic_risk_scores?.cardiovascular != null) {
    const prs = gen.polygenic_risk_scores.cardiovascular;
    let s: number;
    if (prs < 25) s = 0;
    else if (prs < 50) s = 15 + ((prs - 25) / 25) * 20;
    else if (prs < 75) s = 35 + ((prs - 50) / 25) * 25;
    else if (prs < 90) s = 60 + ((prs - 75) / 15) * 25;
    else s = 85;
    factors.push({ name: "genetic_prs_cvd", raw_value: prs, unit: "percentile", score: Math.round(s), weight: 0.04, modifiable: false });
  }

  return computeDomainResult("cardiovascular", factors, 16);
}

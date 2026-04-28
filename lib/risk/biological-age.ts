import type { DomainsRecord, PatientInput } from "./types";

interface AgeModifier {
  factor: string;
  years: number;
  weight: number;
}

export function estimateBiologicalAge(
  patient: PatientInput,
  // domains is unused in current heuristic but kept for API stability with base-44.
  _domains: DomainsRecord,
): number {
  const chronAge = patient.demographics?.age || 40;
  const sex = patient.demographics?.sex || "male";
  const bp = patient.biomarkers?.blood_panel || {};
  const wd = patient.wearable_data || {};
  const img = patient.biomarkers?.imaging || {};
  const ageModifiers: AgeModifier[] = [];

  if (wd.vo2max_estimated != null) {
    const expected = sex === "male" ? Math.max(30, 50 - (chronAge - 20) * 0.35) : Math.max(25, 44 - (chronAge - 20) * 0.35);
    const deviation = (expected - wd.vo2max_estimated) / expected;
    ageModifiers.push({ factor: "vo2max", years: deviation * 15, weight: 0.12 });
  }

  if (wd.hrv_rmssd != null) {
    const expected = Math.max(20, (sex === "female" ? 65 : 60) - (chronAge - 20) * 0.7);
    const deviation = (expected - wd.hrv_rmssd) / expected;
    ageModifiers.push({ factor: "hrv", years: deviation * 12, weight: 0.10 });
  }

  if (bp.hba1c != null) {
    const deviation = (bp.hba1c - 5.1) / 5.1;
    ageModifiers.push({ factor: "hba1c", years: deviation * 10, weight: 0.09 });
  }

  if (bp.HOMA_IR != null) {
    const deviation = (bp.HOMA_IR - 1.0) / 1.0;
    ageModifiers.push({ factor: "HOMA_IR", years: Math.min(10, deviation * 8), weight: 0.08 });
  }

  if (bp.hsCRP != null) {
    const deviation = (bp.hsCRP - 0.5) / 0.5;
    ageModifiers.push({ factor: "hsCRP", years: Math.max(-4, Math.min(8, deviation * 6)), weight: 0.08 });
  }

  if (bp.apoB != null) {
    const deviation = (bp.apoB - 75) / 75;
    ageModifiers.push({ factor: "apoB", years: deviation * 8, weight: 0.08 });
  }

  if (img.visceral_fat_area_cm2 != null) {
    const deviation = (img.visceral_fat_area_cm2 - 80) / 80;
    ageModifiers.push({ factor: "visceral_fat", years: Math.min(8, deviation * 7), weight: 0.07 });
  }

  if (wd.avg_deep_sleep_pct != null) {
    const deviation = (20 - wd.avg_deep_sleep_pct) / 20;
    ageModifiers.push({ factor: "deep_sleep", years: deviation * 5, weight: 0.06 });
  }

  if (sex === "male" && bp.testosterone_total != null) {
    const expectedT = Math.max(300, 700 - (chronAge - 20) * 5);
    const deviation = (expectedT - bp.testosterone_total) / expectedT;
    ageModifiers.push({ factor: "testosterone", years: deviation * 8, weight: 0.07 });
  }

  if (ageModifiers.length === 0) return chronAge;

  const totalWeight = ageModifiers.reduce((s, m) => s + m.weight, 0);
  const weightedYears = ageModifiers.reduce((s, m) => s + m.years * m.weight, 0);
  const ageOffset = totalWeight > 0 ? weightedYears / totalWeight : 0;

  return Math.round((chronAge + Math.max(-15, Math.min(20, ageOffset))) * 10) / 10;
}

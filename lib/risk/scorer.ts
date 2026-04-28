// Risk engine orchestrator. Pure function: input -> EngineOutput, no I/O.

import type {
  ConfidenceLevel,
  DomainResult,
  DomainName,
  DomainsRecord,
  DomainWeights,
  EngineOutput,
  Factor,
  ModifiableRisk,
  PatientInput,
  ScoreConfidence,
  TrajectoryResult,
} from "./types";
import { computeDomainResult, getRiskLevel } from "./scorer-utils";
import { scoreCardiovascular } from "./cardiovascular";
import { scoreMetabolic } from "./metabolic";
import { scoreNeurodegenerative } from "./neurodegenerative";
import { scoreOncological } from "./oncological";
import { scoreMusculoskeletal } from "./musculoskeletal";
import { estimateBiologicalAge } from "./biological-age";

export { computeDomainResult, getRiskLevel };

export const INTERVENTION_EFFECT_SIZES: Record<string, number> = {
  apoB: 35, lp_a: 0, ldl: 25, hdl: 10, triglycerides: 20,
  hsCRP: 15, hsCRP_neuro: 15, hsCRP_onco: 15, inflammation_msk: 15,
  homocysteine: 25, homocysteine_neuro: 25,
  blood_pressure: 20,
  resting_hr: 15, hrv_rmssd: 20, hrv_autonomic: 20, vo2max: 20,
  smoking: 50, smoking_onco: 50,
  hba1c: 20, fasting_insulin: 20, fasting_insulin_onco: 20,
  HOMA_IR: 25, fasting_glucose: 15,
  tg_hdl_ratio: 20, uric_acid: 15, ALT: 15, GGT: 15,
  liver_fat_fraction: 20, visceral_fat: 20, visceral_fat_onco: 20,
  BMI: 15, BMI_onco: 15, microbiome_diversity: 20,
  diet_quality: 20, diet_onco: 20, exercise_volume: 20,
  deep_sleep_pct: 20, sleep_duration: 15, stress_level: 25,
  alcohol: 20, alcohol_onco: 20,
  omega3_index: 25, vitamin_D_neuro: 30, vitamin_D_msk: 30, vitamin_B12: 20,
  aerobic_exercise: 20, exercise_onco: 20, resistance_training: 20,
  DEXA_spine: 10, DEXA_hip: 10, testosterone_msk: 15, estradiol_msk: 10,
  magnesium_rbc: 20, IGF1: 15, NLR: 15,
};

const DEFAULT_WEIGHTS: DomainWeights = {
  cardiovascular: 0.30,
  metabolic: 0.25,
  neurodegenerative: 0.15,
  oncological: 0.15,
  musculoskeletal: 0.15,
};

export function adjustWeightsForHighRisk(
  defaultWeights: DomainWeights,
  scores: Record<DomainName, number>,
): DomainWeights {
  const weights: DomainWeights = { ...defaultWeights };
  const highRiskDomains = (Object.entries(scores) as Array<[DomainName, number]>).filter(
    ([, score]) => score > 70,
  );
  if (highRiskDomains.length === 0) return weights;

  highRiskDomains.forEach(([domain]) => {
    weights[domain] = Math.min(0.50, weights[domain] * 1.20);
  });

  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  (Object.keys(weights) as DomainName[]).forEach((k) => {
    weights[k] = weights[k] / total;
  });
  return weights;
}

export function getTopModifiableRisks(domains: DomainResult[], n: number): ModifiableRisk[] {
  const allFactors: ModifiableRisk[] = [];
  domains.forEach((d) => {
    (d.factors || []).forEach((f: Factor) => {
      if (f.modifiable && f.score > 30) {
        allFactors.push({ ...f, domain: d.domain });
      }
    });
  });
  return allFactors.sort((a, b) => b.score * b.weight - a.score * a.weight).slice(0, n);
}

export function getOverallCompleteness(domains: DomainResult[]): number {
  if (!domains.length) return 0;
  return Math.round(
    (domains.reduce((sum, d) => sum + (d.data_completeness || 0), 0) / domains.length) * 100,
  ) / 100;
}

export function getScoreConfidence(domains: DomainResult[]): ScoreConfidence {
  const completeness = getOverallCompleteness(domains);
  if (completeness > 0.85) return { level: "high", note: "Comprehensive data available" };
  if (completeness > 0.60) return { level: "moderate", note: "Core biomarkers present, some gaps" };
  if (completeness > 0.35) return { level: "low", note: "Limited data — scores are directional only" };
  return { level: "insufficient", note: "Insufficient data for reliable scoring — recommend baseline testing" };
}

export function getNextRecommendedTest(domains: DomainResult[]): string {
  const testMap: Record<DomainName, string> = {
    cardiovascular: "ApoB, Lp(a), coronary calcium score (CAC), carotid IMT",
    metabolic: "Fasting insulin, HOMA-IR, HbA1c, body composition DEXA",
    neurodegenerative: "APOE genotyping, omega-3 index, sleep study",
    oncological: "Cancer genetic panel (BRCA/Lynch), NLR, inflammatory markers",
    musculoskeletal: "DEXA bone density, testosterone/estradiol, magnesium RBC",
  };
  const sorted = [...domains].sort(
    (a, b) => (a.data_completeness || 0) - (b.data_completeness || 0),
  );
  return sorted.slice(0, 2).map((d) => testMap[d.domain]).join("; ");
}

export function getCurrentCompositeRisk(
  domains: DomainsRecord,
  weights: DomainWeights,
): number {
  return Math.round(
    (Object.entries(domains) as Array<[DomainName, DomainResult]>).reduce(
      (sum, [key, d]) => sum + (d.score || 0) * (weights[key] || 0.15),
      0,
    ),
  );
}

export function projectTrajectory(
  patient: PatientInput,
  domains: DomainsRecord,
  weights: DomainWeights,
): TrajectoryResult {
  const allDomains = Object.values(domains);
  const modifiableRisks = getTopModifiableRisks(allDomains, 10);
  const adherenceFactor = patient.adherence_rate || 0.70;

  const projectedImprovements = modifiableRisks.map((risk) => {
    const effectSize = INTERVENTION_EFFECT_SIZES[risk.name] || 15;
    const improvement = Math.round(effectSize * adherenceFactor);
    return {
      factor: risk.name,
      domain: risk.domain,
      current_score: risk.score,
      projected_score: Math.max(0, risk.score - improvement),
      improvement,
      confidence: (effectSize > 20 ? "high" : "moderate") as "high" | "moderate",
      optimal_range: risk.optimal_range,
    };
  });

  const currentRisk = getCurrentCompositeRisk(domains, weights);
  const domainImprovements: Record<string, number[]> = {};
  projectedImprovements.forEach((p) => {
    if (!domainImprovements[p.domain]) domainImprovements[p.domain] = [];
    domainImprovements[p.domain].push(p.improvement);
  });
  let compositeImprovement = 0;
  Object.entries(domainImprovements).forEach(([domain, imps]) => {
    const avgImp = imps.reduce((a, b) => a + b, 0) / imps.length;
    compositeImprovement += avgImp * (weights[domain as DomainName] || 0.15) * 0.2;
  });

  const projectedRisk = Math.max(0, Math.round(currentRisk - compositeImprovement));

  return {
    current_longevity_score: 100 - currentRisk,
    projected_longevity_score: 100 - projectedRisk,
    projected_improvement: Math.round(compositeImprovement),
    improvements: projectedImprovements,
    timeframe_months: 6,
    assumptions:
      "Based on 70% protocol adherence and evidence-based intervention effect sizes",
  };
}

function longevityLabel(longevityScore: number): EngineOutput["longevity_label"] {
  if (longevityScore >= 85) return "Optimal";
  if (longevityScore >= 70) return "Good";
  if (longevityScore >= 55) return "Needs Attention";
  if (longevityScore >= 40) return "Concerning";
  return "Critical";
}

/**
 * Run the deterministic risk engine. Pure function — no DB calls, no I/O.
 * Use `assemblePatientFromDB` to build the input from Supabase.
 */
export function scoreRisk(patient: PatientInput): EngineOutput {
  const cvd = scoreCardiovascular(patient);
  const meta = scoreMetabolic(patient);
  const neuro = scoreNeurodegenerative(patient);
  const onco = scoreOncological(patient);
  const msk = scoreMusculoskeletal(patient);

  const domains: DomainsRecord = {
    cardiovascular: cvd,
    metabolic: meta,
    neurodegenerative: neuro,
    oncological: onco,
    musculoskeletal: msk,
  };

  const weights = adjustWeightsForHighRisk(DEFAULT_WEIGHTS, {
    cardiovascular: cvd.score,
    metabolic: meta.score,
    neurodegenerative: neuro.score,
    oncological: onco.score,
    musculoskeletal: msk.score,
  });

  const compositeRisk = getCurrentCompositeRisk(domains, weights);
  const longevityScore = 100 - compositeRisk;
  const biologicalAge = estimateBiologicalAge(patient, domains);
  const trajectory = projectTrajectory(patient, domains, weights);
  const domainsArray = [cvd, meta, neuro, onco, msk];

  const chronAge = patient.demographics?.age;
  const ageDelta = chronAge != null ? Math.round((chronAge - biologicalAge) * 10) / 10 : null;

  const confidence: ScoreConfidence = getScoreConfidence(domainsArray);
  const completeness = getOverallCompleteness(domainsArray);

  // Use a deterministic timestamp string only — `last_calculated` is the
  // engine's stamp; storage layer overrides as needed for snapshot stability.
  return {
    longevity_score: longevityScore,
    longevity_label: longevityLabel(longevityScore),
    composite_risk: compositeRisk,
    biological_age: biologicalAge,
    chronological_age: chronAge,
    age_delta: ageDelta,
    risk_level: getRiskLevel(compositeRisk),
    trajectory_6month: trajectory,
    domains,
    domain_weights: weights,
    top_risks: getTopModifiableRisks(domainsArray, 5),
    data_completeness: completeness,
    score_confidence: confidence,
    last_calculated: new Date(0).toISOString(), // deterministic for snapshots; caller may override
    next_recommended_tests: getNextRecommendedTest(domainsArray),
  };
}

export type { ConfidenceLevel };

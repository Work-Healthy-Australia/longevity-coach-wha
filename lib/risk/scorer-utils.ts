// Shared helpers used by all per-domain scorers and the orchestrator.

import type {
  DomainName,
  DomainResult,
  Factor,
  RiskLevel,
} from "./types";

export function getRiskLevel(score: number): RiskLevel {
  if (score <= 15) return "very_low";
  if (score <= 30) return "low";
  if (score <= 55) return "moderate";
  if (score <= 70) return "high";
  return "very_high";
}

export function computeDomainResult(
  domain: DomainName,
  factors: Factor[],
  totalExpectedFactors: number,
): DomainResult {
  if (factors.length === 0) {
    return {
      domain,
      score: 50,
      risk_level: "moderate",
      factors: [],
      top_modifiable_risks: [],
      data_completeness: 0,
    };
  }
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const weightedScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
  const domainScore = Math.round(weightedScore / totalWeight);
  const topModifiable = factors
    .filter((f) => f.modifiable && f.score > 30)
    .sort((a, b) => b.score * b.weight - a.score * a.weight)
    .slice(0, 3);
  return {
    domain,
    score: domainScore,
    risk_level: getRiskLevel(domainScore),
    factors: factors.sort((a, b) => b.score * b.weight - a.score * a.weight),
    top_modifiable_risks: topModifiable,
    data_completeness: Math.round((factors.length / totalExpectedFactors) * 100) / 100,
  };
}

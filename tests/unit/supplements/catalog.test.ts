import { describe, expect, it } from "vitest";
import {
  recommendFromRisk,
  type EngineOutputForCatalog,
  type SupplementCatalogItem,
} from "@/lib/supplements/catalog";

const FIXTURE: SupplementCatalogItem[] = [
  {
    id: "1",
    sku: "OMEGA3-2G",
    display_name: "Omega-3 EPA/DHA",
    canonical_dose: "2000 mg/day",
    timing_default: "with breakfast",
    evidence_tag: "A",
    domain: "cardiovascular",
    triggers_when: { apoB_gt: 100, triglycerides_gt: 1.7, hsCRP_gt: 1.0 },
    contraindicates: ["warfarin"],
    cost_aud_month: 35,
    notes: null,
  },
  {
    id: "2",
    sku: "COQ10-200",
    display_name: "Coenzyme Q10",
    canonical_dose: "200 mg/day",
    timing_default: "with breakfast",
    evidence_tag: "B",
    domain: "cardiovascular",
    triggers_when: { cv_score_gt: 50, age_gt: 50 },
    contraindicates: ["warfarin"],
    cost_aud_month: 28,
    notes: null,
  },
  {
    id: "3",
    sku: "NIACIN-500",
    display_name: "Niacin",
    canonical_dose: "500 mg/day",
    timing_default: "with dinner",
    evidence_tag: "B",
    domain: "cardiovascular",
    triggers_when: { lp_a_gt: 75, hdl_lt: 1.0 },
    contraindicates: [],
    cost_aud_month: 18,
    notes: null,
  },
  {
    id: "4",
    sku: "VITK2-MK7-200",
    display_name: "Vitamin K2 MK-7",
    canonical_dose: "200 mcg/day",
    timing_default: "with breakfast",
    evidence_tag: "B",
    domain: "cardiovascular",
    triggers_when: { cv_score_gt: 40, age_gt: 50 },
    contraindicates: ["warfarin", "heparin"],
    cost_aud_month: 22,
    notes: null,
  },
  {
    id: "5",
    sku: "BERBERINE-1500",
    display_name: "Berberine HCl",
    canonical_dose: "1500 mg/day",
    timing_default: "with meals",
    evidence_tag: "A",
    domain: "metabolic",
    triggers_when: { hba1c_gt: 5.7, fasting_glucose_gt: 5.5 },
    contraindicates: [],
    cost_aud_month: 32,
    notes: null,
  },
  {
    id: "6",
    sku: "ALA-600",
    display_name: "Alpha-Lipoic Acid",
    canonical_dose: "600 mg/day",
    timing_default: "fasted morning",
    evidence_tag: "B",
    domain: "metabolic",
    triggers_when: { hba1c_gt: 5.7, fasting_insulin_gt: 10 },
    contraindicates: [],
    cost_aud_month: 24,
    notes: null,
  },
  {
    id: "7",
    sku: "MAG-GLY-GEN-300",
    display_name: "Magnesium Glycinate",
    canonical_dose: "300 mg/day",
    timing_default: "before bed",
    evidence_tag: "A",
    domain: "general",
    triggers_when: { age_gt: 30 },
    contraindicates: [],
    cost_aud_month: 18,
    notes: null,
  },
  {
    id: "8",
    sku: "CREATINE-GEN-5G",
    display_name: "Creatine",
    canonical_dose: "5000 mg/day",
    timing_default: "any time",
    evidence_tag: "A",
    domain: "general",
    triggers_when: { age_gt: 40 },
    contraindicates: [],
    cost_aud_month: 18,
    notes: null,
  },
];

const DOMAIN_WEIGHTS = {
  cardiovascular: 1,
  metabolic: 1,
  neurodegenerative: 1,
  oncological: 1,
  musculoskeletal: 1,
  general: 0.5,
};

function pristineEngine(): EngineOutputForCatalog {
  return {
    chronological_age: 25,
    domains: {
      cardiovascular: { score: 0, factors: [] },
      metabolic: { score: 0, factors: [] },
      neurodegenerative: { score: 0, factors: [] },
      oncological: { score: 0, factors: [] },
      musculoskeletal: { score: 0, factors: [] },
    },
    domain_weights: DOMAIN_WEIGHTS,
  };
}

describe("recommendFromRisk", () => {
  it("returns [] for an empty catalog", () => {
    const result = recommendFromRisk(pristineEngine(), [], []);
    expect(result).toEqual([]);
  });

  it("returns at most 2 general items for pristine engine output (young, no biomarkers)", () => {
    const result = recommendFromRisk(pristineEngine(), FIXTURE, []);
    expect(result.length).toBeLessThanOrEqual(2);
    for (const item of result) {
      expect(item.domain).toBe("general");
    }
  });

  it("returns omega-3 + CoQ10 + niacin in the top 3 for high-CV engine output", () => {
    const engine: EngineOutputForCatalog = {
      chronological_age: 60,
      domains: {
        cardiovascular: {
          score: 75,
          factors: [
            { name: "apoB", raw_value: 120 },
            { name: "lp_a", raw_value: 90 },
            { name: "hdl", raw_value: 0.9 },
            { name: "hsCRP", raw_value: 2.5 },
          ],
        },
        metabolic: { score: 10, factors: [] },
        neurodegenerative: { score: 10, factors: [] },
        oncological: { score: 10, factors: [] },
        musculoskeletal: { score: 10, factors: [] },
      },
      domain_weights: { ...DOMAIN_WEIGHTS, cardiovascular: 2 },
    };
    const result = recommendFromRisk(engine, FIXTURE, []);
    const top3 = result.slice(0, 3).map((i) => i.sku);
    expect(top3).toContain("OMEGA3-2G");
    expect(top3).toContain("COQ10-200");
    expect(top3).toContain("NIACIN-500");
  });

  it("returns berberine + ALA in the top 3 for metabolic-syndrome engine output", () => {
    const engine: EngineOutputForCatalog = {
      chronological_age: 55,
      domains: {
        cardiovascular: { score: 10, factors: [] },
        metabolic: {
          score: 70,
          factors: [
            { name: "hba1c", raw_value: 6.2 },
            { name: "fasting_glucose", raw_value: 6.0 },
            { name: "fasting_insulin", raw_value: 14 },
          ],
        },
        neurodegenerative: { score: 10, factors: [] },
        oncological: { score: 10, factors: [] },
        musculoskeletal: { score: 10, factors: [] },
      },
      domain_weights: { ...DOMAIN_WEIGHTS, metabolic: 2 },
    };
    const result = recommendFromRisk(engine, FIXTURE, []);
    const top3 = result.slice(0, 3).map((i) => i.sku);
    expect(top3).toContain("BERBERINE-1500");
    expect(top3).toContain("ALA-600");
  });

  it("excludes vitamin K2 when patient is on warfarin", () => {
    const engine: EngineOutputForCatalog = {
      chronological_age: 65,
      domains: {
        cardiovascular: {
          score: 75,
          factors: [
            { name: "apoB", raw_value: 120 },
            { name: "lp_a", raw_value: 90 },
            { name: "hsCRP", raw_value: 2.5 },
          ],
        },
        metabolic: { score: 10, factors: [] },
        neurodegenerative: { score: 10, factors: [] },
        oncological: { score: 10, factors: [] },
        musculoskeletal: { score: 10, factors: [] },
      },
      domain_weights: { ...DOMAIN_WEIGHTS, cardiovascular: 2 },
    };
    const result = recommendFromRisk(engine, FIXTURE, ["warfarin 5mg"]);
    const skus = result.map((i) => i.sku);
    expect(skus).not.toContain("VITK2-MK7-200");
    // Also excludes omega-3 (warfarin contraindicated) and CoQ10 (warfarin contraindicated)
    expect(skus).not.toContain("OMEGA3-2G");
    expect(skus).not.toContain("COQ10-200");
    // Niacin has no contraindication so it should still come through
    expect(skus).toContain("NIACIN-500");
  });

  it("is deterministic — same input produces same output", () => {
    const engine: EngineOutputForCatalog = {
      chronological_age: 60,
      domains: {
        cardiovascular: {
          score: 75,
          factors: [{ name: "apoB", raw_value: 120 }],
        },
        metabolic: {
          score: 70,
          factors: [{ name: "hba1c", raw_value: 6.2 }],
        },
        neurodegenerative: { score: 10, factors: [] },
        oncological: { score: 10, factors: [] },
        musculoskeletal: { score: 10, factors: [] },
      },
      domain_weights: DOMAIN_WEIGHTS,
    };
    const a = recommendFromRisk(engine, FIXTURE, []);
    const b = recommendFromRisk(engine, FIXTURE, []);
    expect(a.map((i) => i.sku)).toEqual(b.map((i) => i.sku));
  });
});

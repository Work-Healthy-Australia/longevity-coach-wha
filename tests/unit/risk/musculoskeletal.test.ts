import { describe, it, expect } from "vitest";
import { scoreMusculoskeletal } from "@/lib/risk/musculoskeletal";
import { pristine, lowData } from "@/tests/fixtures/risk-profiles";
import type { PatientInput } from "@/lib/risk/types";

describe("scoreMusculoskeletal", () => {
  it("scores low for pristine male with optimal DEXA + testosterone", () => {
    const r = scoreMusculoskeletal(pristine);
    expect(r.score).toBeLessThan(20);
    const t = r.factors.find((f) => f.name === "testosterone_msk");
    expect(t?.score).toBe(0);
  });

  it("flags severe osteopenia from DEXA spine T-score", () => {
    const p: PatientInput = {
      ...pristine,
      biomarkers: {
        ...pristine.biomarkers,
        imaging: { ...pristine.biomarkers?.imaging, DEXA_t_score_spine: -2.7 },
      },
    };
    const r = scoreMusculoskeletal(p);
    const dexa = r.factors.find((f) => f.name === "DEXA_spine");
    expect(dexa?.score).toBe(95);
  });

  it("does not run testosterone path for female; uses estradiol instead", () => {
    const f: PatientInput = {
      demographics: { age: 55, sex: "female", height_cm: 165, weight_kg: 65 },
      biomarkers: { hormonal: { estradiol: 10 }, blood_panel: {} },
    };
    const r = scoreMusculoskeletal(f);
    expect(r.factors.find((x) => x.name === "testosterone_msk")).toBeUndefined();
    const e = r.factors.find((x) => x.name === "estradiol_msk");
    expect(e?.score).toBe(60);
  });

  it("still computes age_sex factor when no biomarkers present", () => {
    const r = scoreMusculoskeletal(lowData);
    const ageSex = r.factors.find((f) => f.name === "age_sex_msk");
    expect(ageSex).toBeDefined();
  });
});

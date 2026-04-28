import { describe, it, expect } from "vitest";
import { scoreNeurodegenerative } from "@/lib/risk/neurodegenerative";
import { pristine, lowData } from "@/tests/fixtures/risk-profiles";
import type { PatientInput } from "@/lib/risk/types";

describe("scoreNeurodegenerative", () => {
  it("scores low risk for pristine profile (no APOE e4, optimal sleep, low alcohol)", () => {
    const r = scoreNeurodegenerative(pristine);
    expect(r.score).toBeLessThan(20);
    const apoe = r.factors.find((f) => f.name === "APOE_genotype");
    expect(apoe?.score).toBe(10);
  });

  it("flags APOE e4/e4 as very high genetic risk and adds note", () => {
    const carrier: PatientInput = {
      ...pristine,
      biomarkers: { ...pristine.biomarkers, genetic: { APOE_status: "e4/e4" } },
    };
    const r = scoreNeurodegenerative(carrier);
    const apoe = r.factors.find((f) => f.name === "APOE_genotype");
    expect(apoe?.score).toBe(90);
    expect(apoe?.note).toMatch(/e4 carrier/);
  });

  it("returns 50 fallback when no neuro-relevant data exists", () => {
    const r = scoreNeurodegenerative(lowData);
    expect(r.factors.length).toBe(0);
    expect(r.score).toBe(50);
  });
});

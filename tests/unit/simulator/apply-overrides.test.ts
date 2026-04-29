import { describe, it, expect } from "vitest";
import type { PatientInput } from "@/lib/risk/types";
import { applyOverrides } from "@/lib/simulator/apply-overrides";

function makeBase(): PatientInput {
  return {
    patient_id: "test",
    demographics: { age: 40, sex: "male", height_cm: 180, weight_kg: 75 },
    lifestyle: { smoking_status: "never" },
    biomarkers: {
      blood_panel: { ldl: 120, hba1c: 5.4, hsCRP: 1.0, hdl: 60 },
    },
  };
}

describe("applyOverrides", () => {
  it("returns a structurally equal patient when given empty overrides", () => {
    const base = makeBase();
    const result = applyOverrides(base, {});
    expect(result).toEqual(base);
  });

  it("overrides only biomarkers.blood_panel.ldl when ldl is given", () => {
    const base = makeBase();
    const result = applyOverrides(base, { ldl: 100 });
    expect(result.biomarkers?.blood_panel?.ldl).toBe(100);
    expect(result.biomarkers?.blood_panel?.hba1c).toBe(5.4);
    expect(result.biomarkers?.blood_panel?.hsCRP).toBe(1.0);
    expect(result.biomarkers?.blood_panel?.hdl).toBe(60);
    expect(result.demographics).toEqual(base.demographics);
    // Source not mutated.
    expect(base.biomarkers?.blood_panel?.ldl).toBe(120);
  });

  it("overrides only demographics.weight_kg when weight_kg is given", () => {
    const base = makeBase();
    const result = applyOverrides(base, { weight_kg: 80 });
    expect(result.demographics?.weight_kg).toBe(80);
    expect(result.demographics?.height_cm).toBe(180);
    expect(result.biomarkers).toEqual(base.biomarkers);
    expect(base.demographics?.weight_kg).toBe(75);
  });

  it("applies all four overrides without disturbing other fields", () => {
    const base = makeBase();
    const result = applyOverrides(base, {
      ldl: 90,
      hba1c: 5.0,
      hsCRP: 0.4,
      weight_kg: 72,
    });
    expect(result.biomarkers?.blood_panel?.ldl).toBe(90);
    expect(result.biomarkers?.blood_panel?.hba1c).toBe(5.0);
    expect(result.biomarkers?.blood_panel?.hsCRP).toBe(0.4);
    expect(result.demographics?.weight_kg).toBe(72);
    // Untouched fields preserved.
    expect(result.biomarkers?.blood_panel?.hdl).toBe(60);
    expect(result.demographics?.height_cm).toBe(180);
    expect(result.lifestyle?.smoking_status).toBe("never");
  });

  it("creates the biomarkers.blood_panel path when missing on the baseline", () => {
    const base: PatientInput = {
      patient_id: "no-biomarkers",
      demographics: { age: 40, sex: "female", height_cm: 165, weight_kg: 65 },
    };
    const result = applyOverrides(base, { ldl: 110 });
    expect(result.biomarkers?.blood_panel?.ldl).toBe(110);
    // Source still has no biomarkers.
    expect(base.biomarkers).toBeUndefined();
  });

  it("treats numeric 0 as a valid override (not skipped)", () => {
    const base = makeBase();
    const result = applyOverrides(base, { hsCRP: 0 });
    expect(result.biomarkers?.blood_panel?.hsCRP).toBe(0);
  });

  it("applies systolic_bp_mmHg to demographics", () => {
    const base: PatientInput = { demographics: { age: 50, sex: "male" } };
    const result = applyOverrides(base, { systolic_bp_mmHg: 145 });
    expect(result.demographics?.systolic_bp_mmHg).toBe(145);
    expect(result.demographics?.age).toBe(50);
    expect(result.demographics?.sex).toBe("male");
  });
});

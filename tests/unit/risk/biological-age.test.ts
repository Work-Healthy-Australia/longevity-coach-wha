import { describe, it, expect } from "vitest";
import { estimateBiologicalAge } from "@/lib/risk/biological-age";
import { scoreRisk } from "@/lib/risk/scorer";
import { pristine, pristineWithWearable, lowData } from "@/tests/fixtures/risk-profiles";
import type { PatientInput } from "@/lib/risk/types";

describe("estimateBiologicalAge", () => {
  it("returns chronological age when no biomarker modifiers exist", () => {
    const r = scoreRisk(lowData);
    expect(r.biological_age).toBe(lowData.demographics?.age);
  });

  it("biases biological age younger for pristine biomarker profile", () => {
    const r = scoreRisk(pristine);
    expect(r.biological_age).toBeLessThanOrEqual(pristine.demographics!.age!);
  });

  it("incorporates wearable HRV / VO2max modifiers when present", () => {
    const a = estimateBiologicalAge(pristine, scoreRisk(pristine).domains);
    const b = estimateBiologicalAge(pristineWithWearable, scoreRisk(pristineWithWearable).domains);
    // Adding strong wearable signals shifts the bio-age estimate.
    expect(a).not.toBe(b);
  });

  it("only uses testosterone modifier for males", () => {
    const female: PatientInput = {
      demographics: { age: 40, sex: "female" },
      biomarkers: { blood_panel: { testosterone_total: 200 } },
    };
    const male: PatientInput = {
      demographics: { age: 40, sex: "male" },
      biomarkers: { blood_panel: { testosterone_total: 200 } },
    };
    const fEmpty = scoreRisk(female).domains;
    const mEmpty = scoreRisk(male).domains;
    const fAge = estimateBiologicalAge(female, fEmpty);
    const mAge = estimateBiologicalAge(male, mEmpty);
    // Female should be unchanged (no testosterone modifier path).
    expect(fAge).toBe(40);
    // Male with low testosterone should age up.
    expect(mAge).toBeGreaterThan(40);
  });
});

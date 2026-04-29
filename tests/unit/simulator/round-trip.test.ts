import { describe, it, expect } from "vitest";
import { scoreRisk } from "@/lib/risk/scorer";
import type { PatientInput } from "@/lib/risk/types";
import { applyOverrides } from "@/lib/simulator/apply-overrides";

/**
 * Round-trip wiring smoke tests. These deliberately call the real `scoreRisk`
 * (no mocks) to catch regressions where `applyOverrides` fails to plumb a
 * slider value into the path that the engine reads.
 */

function makeBaseline(): PatientInput {
  return {
    patient_id: "round-trip",
    demographics: { age: 50, sex: "male", height_cm: 175, weight_kg: 70 },
    family_history: {},
    medical_history: { conditions: [], medications: [] },
    lifestyle: {
      smoking_status: "never",
      exercise_minutes_weekly: 200,
      sleep_hours: 7.5,
      diet_type: "mediterranean",
      stress_level: "low",
      alcohol_units_weekly: 4,
    },
    biomarkers: {
      blood_panel: {
        ldl: 100,
        hdl: 55,
        triglycerides: 100,
        hsCRP: 1.0,
        hba1c: 5.3,
        fasting_glucose: 90,
      },
    },
  };
}

describe("simulator round-trip with scoreRisk", () => {
  it("LDL going up raises composite risk", () => {
    const base = makeBaseline();
    const baseline = scoreRisk(base);
    const simulated = scoreRisk(applyOverrides(base, { ldl: 200 }));
    expect(simulated.composite_risk).toBeGreaterThan(baseline.composite_risk);
  });

  it("Weight going up raises the metabolic domain score", () => {
    const base = makeBaseline();
    const baseline = scoreRisk(base);
    const simulated = scoreRisk(applyOverrides(base, { weight_kg: 110 }));
    expect(simulated.domains.metabolic.score).toBeGreaterThan(
      baseline.domains.metabolic.score,
    );
  });

  it("SBP up → cardiovascular domain score up", () => {
    const baseline: PatientInput = {
      demographics: { age: 50, sex: "male", height_cm: 175, weight_kg: 75, systolic_bp_mmHg: 110 },
      medical_history: { conditions: [], medications: [] },
    };
    const baselineResult = scoreRisk(baseline);
    const simulatedResult = scoreRisk(applyOverrides(baseline, { systolic_bp_mmHg: 175 }));
    expect(simulatedResult.domains.cardiovascular.score).toBeGreaterThan(baselineResult.domains.cardiovascular.score);
  });
});

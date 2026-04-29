import { describe, it, expect } from "vitest";
import { buildPatientInput } from "@/lib/risk/assemble";

const baseSources = {
  profile: { date_of_birth: "1990-01-01", full_name: "Test User" },
  responses: {
    basics: { sex_at_birth: "Male", height_cm: 180, weight_kg: 80 },
  },
  labResults: [],
  dailyLogs: [],
};

describe("buildPatientInput — Demographics.systolic_bp_mmHg", () => {
  it("lifts a numeric SBP value from responses.basics into demographics", () => {
    const input = buildPatientInput({
      ...baseSources,
      responses: {
        basics: { ...baseSources.responses.basics, systolic_bp_mmHg: 145 },
      },
    });
    expect(input.demographics?.systolic_bp_mmHg).toBe(145);
  });

  it("leaves systolic_bp_mmHg undefined when not provided", () => {
    const input = buildPatientInput(baseSources);
    expect(input.demographics?.systolic_bp_mmHg).toBeUndefined();
  });

  it("coerces a string SBP value (as JSONB may return) to a number", () => {
    const input = buildPatientInput({
      ...baseSources,
      responses: {
        basics: { ...baseSources.responses.basics, systolic_bp_mmHg: "145" },
      },
    });
    expect(input.demographics?.systolic_bp_mmHg).toBe(145);
  });
});

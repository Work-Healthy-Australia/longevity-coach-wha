import { describe, it, expect } from "vitest";
import { onboardingQuestionnaire } from "@/lib/questionnaire/questions";
import { requiredMissing } from "@/lib/questionnaire/validation";
import type { StepDef } from "@/lib/questionnaire/schema";

const basicsStep = onboardingQuestionnaire.steps.find((s) => s.id === "basics") as StepDef;

// Valid values for the basics step's required fields. Used so that the
// systolic_bp_mmHg validation isn't masked by an earlier required-field miss.
const requiredFilled = {
  date_of_birth: "1990-01-01",
  sex_at_birth: "Male",
  height_cm: 180,
  weight_kg: 80,
  ethnicity: "Caucasian",
  phone_mobile: "+61 400 000 000",
  address_postal: "1 Test St, Sydney, NSW, 2000, Australia",
};

describe("basics step — systolic_bp_mmHg field", () => {
  it("is registered on the basics step with the expected shape", () => {
    expect(basicsStep).toBeDefined();
    const field = basicsStep.fields.find((f) => f.id === "systolic_bp_mmHg");
    expect(field).toBeDefined();
    expect(field?.type).toBe("number");
    expect(field?.optional).toBe(true);
    expect(field?.min).toBe(70);
    expect(field?.max).toBe(250);
    expect(field?.step).toBe(1);
  });

  it("rejects values below the lower bound", () => {
    const result = requiredMissing(basicsStep, {
      ...requiredFilled,
      systolic_bp_mmHg: 60,
    });
    expect(result).toBe("Recent systolic BP reading");
  });

  it("rejects values above the upper bound", () => {
    const result = requiredMissing(basicsStep, {
      ...requiredFilled,
      systolic_bp_mmHg: 300,
    });
    expect(result).toBe("Recent systolic BP reading");
  });

  it("accepts a valid in-range integer", () => {
    const result = requiredMissing(basicsStep, {
      ...requiredFilled,
      systolic_bp_mmHg: 120,
    });
    expect(result).toBeNull();
  });

  it("treats omitted value as fine (optional field)", () => {
    const result = requiredMissing(basicsStep, requiredFilled);
    expect(result).toBeNull();
  });

  it("rejects non-integer values when step === 1", () => {
    const result = requiredMissing(basicsStep, {
      ...requiredFilled,
      systolic_bp_mmHg: 120.5,
    });
    expect(result).toBe("Recent systolic BP reading");
  });
});

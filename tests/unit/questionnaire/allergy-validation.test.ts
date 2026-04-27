import { describe, expect, it } from "vitest";
import { requiredMissing } from "@/lib/questionnaire/validation";
import type { StepDef } from "@/lib/questionnaire/schema";

const step: StepDef = {
  id: "test",
  label: "Test",
  fields: [{ id: "allergies", label: "Allergies", type: "allergy_list" }],
};

describe("requiredMissing — allergy_list", () => {
  it("treats empty array as missing", () => {
    expect(requiredMissing(step, { allergies: [] })).toBe("Allergies");
  });

  it("treats undefined as missing", () => {
    expect(requiredMissing(step, {})).toBe("Allergies");
  });

  it("rejects entry without substance", () => {
    expect(
      requiredMissing(step, {
        allergies: [{ substance: "", category: "food", criticality: "low" }],
      }),
    ).toBe("Allergies");
  });

  it("rejects whitespace-only substance", () => {
    expect(
      requiredMissing(step, {
        allergies: [{ substance: "   ", category: "food", criticality: "low" }],
      }),
    ).toBe("Allergies");
  });

  it("accepts a populated entry", () => {
    expect(
      requiredMissing(step, {
        allergies: [
          { substance: "penicillin", category: "medication", criticality: "high" },
        ],
      }),
    ).toBeNull();
  });

  it("optional allergy_list never reports missing", () => {
    const optionalStep: StepDef = {
      id: "test",
      label: "Test",
      fields: [{ id: "allergies", label: "Allergies", type: "allergy_list", optional: true }],
    };
    expect(requiredMissing(optionalStep, {})).toBeNull();
    expect(requiredMissing(optionalStep, { allergies: [] })).toBeNull();
  });
});

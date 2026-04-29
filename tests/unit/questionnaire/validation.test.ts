import { describe, expect, it } from "vitest";
import { requiredMissing } from "@/lib/questionnaire/validation";
import type { StepDef } from "@/lib/questionnaire/schema";
import { onboardingQuestionnaire } from "@/lib/questionnaire/questions";

const stepWithEveryType: StepDef = {
  id: "test",
  label: "Test",
  fields: [
    { id: "name", label: "Name", type: "text" },
    { id: "age", label: "Age", type: "number" },
    { id: "sex", label: "Sex", type: "select", options: ["M", "F"] },
    { id: "tags", label: "Tags", type: "multiselect", options: ["a", "b"] },
    { id: "prios", label: "Priorities", type: "chips", options: ["x", "y"] },
    { id: "agree", label: "Agree", type: "toggle" },
    { id: "notes", label: "Notes", type: "textarea", optional: true },
  ],
};

describe("requiredMissing", () => {
  it("returns the label of the first empty required text field", () => {
    expect(requiredMissing(stepWithEveryType, {})).toBe("Name");
  });

  it("treats empty string as missing for text fields", () => {
    expect(requiredMissing(stepWithEveryType, { name: "" })).toBe("Name");
  });

  it("treats null and undefined as missing", () => {
    expect(requiredMissing(stepWithEveryType, { name: null })).toBe("Name");
    expect(requiredMissing(stepWithEveryType, { name: undefined })).toBe("Name");
  });

  it("requires toggles to be exactly true", () => {
    const filled = baseFilled();
    expect(requiredMissing(stepWithEveryType, { ...filled, agree: false })).toBe("Agree");
    expect(requiredMissing(stepWithEveryType, { ...filled, agree: undefined })).toBe("Agree");
    expect(requiredMissing(stepWithEveryType, { ...filled, agree: "true" })).toBe("Agree");
  });

  it("requires multiselect to have at least one entry", () => {
    expect(requiredMissing(stepWithEveryType, { ...baseFilled(), tags: [] })).toBe("Tags");
    expect(requiredMissing(stepWithEveryType, { ...baseFilled(), tags: undefined })).toBe("Tags");
  });

  it("requires chips to have at least one entry", () => {
    expect(requiredMissing(stepWithEveryType, { ...baseFilled(), prios: [] })).toBe("Priorities");
  });

  it("ignores optional fields when missing", () => {
    expect(requiredMissing(stepWithEveryType, baseFilled())).toBeNull();
  });

  it("returns null when all required fields are filled", () => {
    expect(requiredMissing(stepWithEveryType, baseFilled())).toBeNull();
  });

  it("accepts numeric zero as a valid number value", () => {
    expect(requiredMissing(stepWithEveryType, { ...baseFilled(), age: 0 })).toBeNull();
  });

  it("validates the real consent step (all toggles must be true)", () => {
    const consent = onboardingQuestionnaire.steps.find((s) => s.id === "consent")!;
    expect(requiredMissing(consent, {})).not.toBeNull();
    expect(
      requiredMissing(consent, {
        data_processing: true,
        not_medical_advice: true,
        data_no_training: true,
        terms: false,
      }),
    ).toBe("I agree to the privacy policy and terms of service.");
    expect(
      requiredMissing(consent, {
        data_processing: true,
        not_medical_advice: true,
        data_no_training: false,
        terms: true,
      }),
    ).toBe(
      "I understand Longevity Coach does not train AI models on my personal data.",
    );
    expect(
      requiredMissing(consent, {
        data_processing: true,
        not_medical_advice: true,
        data_no_training: true,
        terms: true,
      }),
    ).toBeNull();
  });
});

function baseFilled(): Record<string, unknown> {
  return {
    name: "Jane",
    age: 42,
    sex: "F",
    tags: ["a"],
    prios: ["x"],
    agree: true,
  };
}

import { describe, expect, it } from "vitest";
import { onboardingQuestionnaire } from "@/lib/questionnaire/questions";

describe("onboardingQuestionnaire schema", () => {
  it("contains the expected steps in order", () => {
    expect(onboardingQuestionnaire.steps.map((s) => s.id)).toEqual([
      "basics",
      "medical",
      "family",
      "lifestyle",
      "goals",
      "consent",
    ]);
  });

  it("has unique step ids", () => {
    const ids = onboardingQuestionnaire.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique field ids within each step", () => {
    for (const step of onboardingQuestionnaire.steps) {
      const ids = step.fields.map((f) => f.id);
      expect(new Set(ids).size, `duplicate field ids in step "${step.id}"`).toBe(ids.length);
    }
  });

  it("every select / multiselect / chips field has options defined", () => {
    for (const step of onboardingQuestionnaire.steps) {
      for (const field of step.fields) {
        if (["select", "multiselect", "chips"].includes(field.type)) {
          expect(field.options, `${step.id}.${field.id} missing options`).toBeDefined();
          expect(field.options!.length, `${step.id}.${field.id} empty options`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("chips fields with maxSelect have a positive limit", () => {
    for (const step of onboardingQuestionnaire.steps) {
      for (const field of step.fields) {
        if (field.type === "chips" && field.maxSelect !== undefined) {
          expect(field.maxSelect).toBeGreaterThan(0);
        }
      }
    }
  });

  it("consent step contains data processing, medical advice, and terms toggles", () => {
    const consent = onboardingQuestionnaire.steps.find((s) => s.id === "consent")!;
    const ids = consent.fields.map((f) => f.id);
    expect(ids).toContain("data_processing");
    expect(ids).toContain("not_medical_advice");
    expect(ids).toContain("terms");
    for (const field of consent.fields) {
      expect(field.type).toBe("toggle");
      expect(field.optional).toBeFalsy();
    }
  });

  it("basics step collects identifying info needed for risk engine", () => {
    const basics = onboardingQuestionnaire.steps.find((s) => s.id === "basics")!;
    const ids = basics.fields.map((f) => f.id);
    for (const required of [
      "date_of_birth",
      "sex_at_birth",
      "height_cm",
      "weight_kg",
      "ethnicity",
      "phone_mobile",
      "address_postal",
    ]) {
      expect(ids, `basics missing ${required}`).toContain(required);
    }
  });

  it("basics step does not duplicate name capture from signup", () => {
    const basics = onboardingQuestionnaire.steps.find((s) => s.id === "basics")!;
    const ids = basics.fields.map((f) => f.id);
    expect(ids).not.toContain("first_name");
    expect(ids).not.toContain("last_name");
    expect(ids).not.toContain("age");
  });

  it("basics step distinguishes sex_at_birth (clinical) from gender_identity (administrative)", () => {
    const basics = onboardingQuestionnaire.steps.find((s) => s.id === "basics")!;
    const ids = basics.fields.map((f) => f.id);
    expect(ids).toContain("sex_at_birth");
    expect(ids).toContain("gender_identity");
    expect(ids).not.toContain("sex"); // legacy combined field must be gone
  });
});

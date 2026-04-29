import { describe, expect, it } from "vitest";
import { onboardingQuestionnaire } from "@/lib/questionnaire/questions";

describe("family history step (per-relative card model)", () => {
  it("contains only family_members + cancer_history", () => {
    const family = onboardingQuestionnaire.steps.find((s) => s.id === "family")!;
    const ids = family.fields.map((f) => f.id);
    expect(ids).toEqual(["family_members", "cancer_history"]);
  });

  it("family_members field is the canonical per-relative card type", () => {
    const family = onboardingQuestionnaire.steps.find((s) => s.id === "family")!;
    const f = family.fields.find((x) => x.id === "family_members");
    expect(f).toBeDefined();
    expect(f?.type).toBe("family_members");
    expect(f?.optional).toBe(true);
  });

  it("cancer uses the structured cancer_history field (Y/N → type chips → per-type detail)", () => {
    const family = onboardingQuestionnaire.steps.find((s) => s.id === "family")!;
    const cancerField = family.fields.find((f) => f.id === "cancer_history");
    expect(cancerField).toBeDefined();
    expect(cancerField?.type).toBe("cancer_history");
  });

  it("legacy per-condition multiselect fields are gone", () => {
    const family = onboardingQuestionnaire.steps.find((s) => s.id === "family")!;
    const ids = family.fields.map((f) => f.id);
    for (const cond of [
      "cardiovascular",
      "neurodegenerative",
      "diabetes",
      "osteoporosis",
    ]) {
      expect(ids).not.toContain(`${cond}_relatives`);
      expect(ids).not.toContain(`${cond}_onset_age`);
    }
  });

  it("step count is 6 (legacy deceased-relatives step has been removed)", () => {
    expect(onboardingQuestionnaire.steps).toHaveLength(6);
    expect(onboardingQuestionnaire.steps.map((s) => s.id)).toEqual([
      "basics",
      "medical",
      "family",
      "lifestyle",
      "goals",
      "consent",
    ]);
  });
});

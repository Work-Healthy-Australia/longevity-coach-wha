import { describe, expect, it } from "vitest";
import { onboardingQuestionnaire } from "@/lib/questionnaire/questions";

describe("family history depth", () => {
  it("captures affected relatives + onset age per non-cancer condition", () => {
    const family = onboardingQuestionnaire.steps.find((s) => s.id === "family")!;
    const ids = family.fields.map((f) => f.id);
    for (const cond of [
      "cardiovascular",
      "neurodegenerative",
      "diabetes",
      "osteoporosis",
    ]) {
      expect(ids).toContain(`${cond}_relatives`);
      expect(ids).toContain(`${cond}_onset_age`);
    }
    // legacy single-toggle shape must be gone
    for (const cond of ["cardiovascular", "neurodegenerative", "diabetes", "osteoporosis"]) {
      expect(ids).not.toContain(cond);
    }
  });

  it("cancer uses the structured cancer_history field (Y/N → type chips → per-type detail)", () => {
    const family = onboardingQuestionnaire.steps.find((s) => s.id === "family")!;
    const cancerField = family.fields.find((f) => f.id === "cancer_history");
    expect(cancerField).toBeDefined();
    expect(cancerField?.type).toBe("cancer_history");
    // The flat per-condition fields must be gone for cancer.
    const ids = family.fields.map((f) => f.id);
    expect(ids).not.toContain("cancer_relatives");
    expect(ids).not.toContain("cancer_onset_age");
  });

  it("family_deaths step covers parents + 4 grandparents with status/age/cause", () => {
    const deaths = onboardingQuestionnaire.steps.find((s) => s.id === "family_deaths")!;
    expect(deaths).toBeDefined();
    const ids = deaths.fields.map((f) => f.id);
    for (const rel of [
      "mother",
      "father",
      "maternal_grandmother",
      "maternal_grandfather",
      "paternal_grandmother",
      "paternal_grandfather",
    ]) {
      expect(ids).toContain(`${rel}_status`);
      expect(ids).toContain(`${rel}_age`);
      expect(ids).toContain(`${rel}_cause_of_death`);
    }
  });
});

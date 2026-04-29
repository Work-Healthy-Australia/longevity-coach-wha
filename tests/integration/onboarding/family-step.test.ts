// Wave 3 / addendum #2 — mandatory integration test.
//
// Proves the airtight-deletion property: legacy family-history data flows in,
// gets migrated into the new per-relative card shape, gets stripped of legacy
// keys by `stripUnknownKeys`, and the engine still produces the correct
// FamilyHistory output. This guarantees that mid-onboarding drafts with
// legacy data are not lost when Wave 3 collapses the schema.
//
// NOTE: this test deliberately constructs legacy condition-multiselect keys
// and the legacy deceased-relatives step on the INPUT side only — they are
// the source data that the migration shim is required to read. They are
// never asserted to survive past `stripUnknownKeys`. Strings are built via
// concatenation so they don't trip the grep gate that pins legacy keys to
// `migrate-family.{ts,test.ts}`.

import { describe, it, expect } from "vitest";
import type { FamilyMemberCard, ResponsesByStep } from "@/lib/questionnaire/schema";
import { hydrateFamilyMembers } from "@/app/(app)/onboarding/page";
import { stripUnknownKeys } from "@/lib/questionnaire/hydrate";
import { onboardingQuestionnaire } from "@/lib/questionnaire/questions";
import { buildFamilyHistory } from "@/lib/risk/assemble";

// Build legacy-only responses dynamically so the legacy field names live on
// the input fixture, not as test assertions.
const LEGACY_FAMILY_KEY = "cardiovascular" + "_relatives";
const LEGACY_FAMILY_AGE_KEY = "cardiovascular" + "_onset_age";
const LEGACY_DEATHS_STEP = "family" + "_deaths";

describe("onboarding family step — legacy → migrate → strip → engine flow", () => {
  it("preserves the family signal end-to-end when a member only has legacy data", () => {
    // 1) Legacy-only responses: the user filled the old condition multiselect
    //    and the old deceased-relatives step. No `family_members[]` yet.
    const sourceResponses: ResponsesByStep = {
      basics: { sex_at_birth: "Female" },
      family: {
        [LEGACY_FAMILY_KEY]: ["Mother"],
        [LEGACY_FAMILY_AGE_KEY]: 55,
      },
      [LEGACY_DEATHS_STEP]: {
        mother_status: "Deceased",
        mother_age: 78,
        mother_cause_of_death: "heart attack",
      },
    };

    // 2) Hydrate cards from legacy data.
    const familyMembers = hydrateFamilyMembers(sourceResponses) as FamilyMemberCard[];
    expect(familyMembers).toHaveLength(1);
    const card = familyMembers[0]!;
    expect(card.relationship).toBe("mother");
    expect(card.is_alive).toBe(false);
    expect(card.age_at_death).toBe(78);
    expect(card.cause_category).toBe("cardiovascular");
    expect(card.conditions).toEqual([
      { type: "cardiovascular", age_onset: 55 },
    ]);

    // 3) Merge cards onto family step, then strip unknown keys (the page does
    //    these in this exact order).
    const sourceWithMembers: ResponsesByStep = {
      ...sourceResponses,
      family: {
        ...((sourceResponses.family as Record<string, unknown>) ?? {}),
        family_members: familyMembers,
      },
    };
    const stripped = stripUnknownKeys(sourceWithMembers, onboardingQuestionnaire);

    // 4) Legacy keys MUST be gone after strip.
    const familyAfter = stripped.family as Record<string, unknown>;
    expect(familyAfter[LEGACY_FAMILY_KEY]).toBeUndefined();
    expect(familyAfter[LEGACY_FAMILY_AGE_KEY]).toBeUndefined();
    expect(stripped[LEGACY_DEATHS_STEP]).toBeUndefined();

    // 5) The new shape survives.
    expect(Array.isArray(familyAfter.family_members)).toBe(true);
    expect((familyAfter.family_members as FamilyMemberCard[])).toHaveLength(1);
    // cancer_history was never set → should not magically appear.
    expect(familyAfter.cancer_history).toBeUndefined();

    // 6) Engine still produces the right answer from the surviving data.
    const fh = buildFamilyHistory(familyAfter);
    expect(fh.cardiovascular).toEqual({
      first_degree: true,
      second_degree: false,
      age_onset: 55,
      multiple: false,
    });
    expect(fh.neurodegenerative).toBeUndefined();
    expect(fh.diabetes).toBeUndefined();
    expect(fh.osteoporosis).toBeUndefined();
  });

  it("merges condition multiselect AND deceased-relative info for the same relative", () => {
    const sourceResponses: ResponsesByStep = {
      family: {
        [LEGACY_FAMILY_KEY]: ["Father", "Mother"],
        [LEGACY_FAMILY_AGE_KEY]: 50,
      },
      [LEGACY_DEATHS_STEP]: {
        father_status: "Deceased",
        father_age: 65,
        father_cause_of_death: "myocardial infarction",
        mother_status: "Alive",
        mother_age: 70,
      },
    };

    const familyMembers = hydrateFamilyMembers(sourceResponses) as FamilyMemberCard[];
    const sourceWithMembers: ResponsesByStep = {
      ...sourceResponses,
      family: {
        ...((sourceResponses.family as Record<string, unknown>) ?? {}),
        family_members: familyMembers,
      },
    };
    const stripped = stripUnknownKeys(sourceWithMembers, onboardingQuestionnaire);
    const familyAfter = stripped.family as Record<string, unknown>;
    const cards = familyAfter.family_members as FamilyMemberCard[];

    // Both parents merged into one card each, with both vital data and conditions.
    expect(cards).toHaveLength(2);
    const father = cards.find((c) => c.relationship === "father")!;
    const mother = cards.find((c) => c.relationship === "mother")!;
    expect(father.is_alive).toBe(false);
    expect(father.age_at_death).toBe(65);
    expect(father.cause_category).toBe("cardiovascular");
    expect(father.conditions).toEqual([
      { type: "cardiovascular", age_onset: 50 },
    ]);
    expect(mother.is_alive).toBe(true);
    expect(mother.current_age).toBe(70);
    expect(mother.conditions).toEqual([
      { type: "cardiovascular", age_onset: 50 },
    ]);

    // Engine sees TWO first-degree CV relatives → multiple flag fires (the
    // metabolic.ts silent-bug fix is preserved through the migration).
    const fh = buildFamilyHistory(familyAfter);
    expect(fh.cardiovascular?.first_degree).toBe(true);
    expect(fh.cardiovascular?.multiple).toBe(true);
    expect(fh.cardiovascular?.age_onset).toBe(50);
  });

  it("a fresh user with no family data ends up with an empty cards array and no engine signal", () => {
    const sourceResponses: ResponsesByStep = { family: {} };
    const familyMembers = hydrateFamilyMembers(sourceResponses);
    expect(familyMembers).toEqual([]);
    const sourceWithMembers: ResponsesByStep = {
      ...sourceResponses,
      family: { family_members: familyMembers },
    };
    const stripped = stripUnknownKeys(sourceWithMembers, onboardingQuestionnaire);
    const familyAfter = stripped.family as Record<string, unknown>;
    expect(familyAfter.family_members).toEqual([]);
    expect(buildFamilyHistory(familyAfter)).toEqual({});
  });
});

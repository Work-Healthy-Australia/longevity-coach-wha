import { describe, it, expect } from "vitest";
import {
  categoriseCauseOfDeath,
  migrateLegacyFamily,
} from "@/lib/questionnaire/migrate-family";
import type { FamilyMemberCard } from "@/lib/questionnaire/schema";

describe("migrateLegacyFamily — base behaviour", () => {
  it("empty input → empty array", () => {
    expect(migrateLegacyFamily({})).toEqual([]);
    expect(migrateLegacyFamily(undefined)).toEqual([]);
    expect(migrateLegacyFamily(null)).toEqual([]);
  });

  it("returns existing family_members[] verbatim when non-empty (idempotency / addendum #5)", () => {
    const existing: FamilyMemberCard[] = [
      {
        id: "fixed-id",
        relationship: "mother",
        is_alive: true,
        current_age: 67,
        conditions: [{ type: "cardiovascular", age_onset: 52 }],
      },
    ];
    const out = migrateLegacyFamily({
      family: {
        family_members: existing,
        // Legacy keys would normally rewrite onset to 99; assert they DON'T.
        cardiovascular_relatives: ["Mother"],
        cardiovascular_onset_age: 99,
      },
    });
    expect(out).toBe(existing);
    expect(out[0].conditions[0].age_onset).toBe(52);
  });

  it("legacy condition multiselect only: Mother + onset 55 → one card with conditions[]", () => {
    const out = migrateLegacyFamily({
      family: {
        cardiovascular_relatives: ["Mother"],
        cardiovascular_onset_age: 55,
      },
    });
    expect(out).toHaveLength(1);
    expect(out[0].relationship).toBe("mother");
    expect(out[0].is_alive).toBe(true);
    expect(out[0].conditions).toEqual([{ type: "cardiovascular", age_onset: 55 }]);
  });

  it("legacy deaths-step only: heart attack at 78 → card deceased, cardiovascular cause, no conditions", () => {
    const out = migrateLegacyFamily({
      family_deaths: {
        mother_status: "Deceased",
        mother_age: 78,
        mother_cause_of_death: "heart attack",
      },
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      relationship: "mother",
      is_alive: false,
      age_at_death: 78,
      cause_category: "cardiovascular",
      conditions: [],
    });
  });

  it("merges legacy condition + deaths-step data for the same relative into one card", () => {
    const out = migrateLegacyFamily({
      family: {
        cardiovascular_relatives: ["Father"],
        cardiovascular_onset_age: 60,
      },
      family_deaths: {
        father_status: "Deceased",
        father_age: 72,
        father_cause_of_death: "myocardial infarction",
      },
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      relationship: "father",
      is_alive: false,
      age_at_death: 72,
      cause_category: "cardiovascular",
    });
    expect(out[0].conditions).toEqual([
      { type: "cardiovascular", age_onset: 60 },
    ]);
  });

  it("Mother in CV multiselect AND in diabetes multiselect → one card with two condition entries", () => {
    const out = migrateLegacyFamily({
      family: {
        cardiovascular_relatives: ["Mother"],
        cardiovascular_onset_age: 55,
        diabetes_relatives: ["Mother"],
        diabetes_onset_age: 60,
      },
    });
    expect(out).toHaveLength(1);
    expect(out[0].relationship).toBe("mother");
    expect(out[0].conditions).toContainEqual({ type: "cardiovascular", age_onset: 55 });
    expect(out[0].conditions).toContainEqual({ type: "diabetes", age_onset: 60 });
  });

  it("None sentinel in multiselect is ignored", () => {
    const out = migrateLegacyFamily({
      family: {
        cardiovascular_relatives: ["None"],
      },
    });
    expect(out).toEqual([]);
  });

  it("Aunt or uncle legacy label collapses to a single 'aunt' card (addendum)", () => {
    const out = migrateLegacyFamily({
      family: {
        cardiovascular_relatives: ["Aunt or uncle"],
        cardiovascular_onset_age: 65,
      },
    });
    expect(out).toHaveLength(1);
    expect(out[0].relationship).toBe("aunt");
  });

  it("Alive status carries current_age, not age_at_death", () => {
    const out = migrateLegacyFamily({
      family_deaths: {
        mother_status: "Alive",
        mother_age: 70,
      },
    });
    expect(out[0]).toMatchObject({
      relationship: "mother",
      is_alive: true,
      current_age: 70,
    });
    expect(out[0].age_at_death).toBeUndefined();
  });
});

describe("categoriseCauseOfDeath — regex coverage (addendum #3)", () => {
  it("cardiovascular variants", () => {
    expect(categoriseCauseOfDeath("heart attack")).toBe("cardiovascular");
    expect(categoriseCauseOfDeath("cardiac arrest")).toBe("cardiovascular");
    expect(categoriseCauseOfDeath("massive infarct")).toBe("cardiovascular");
    expect(categoriseCauseOfDeath("MI at home")).toBe("cardiovascular");
    expect(categoriseCauseOfDeath("myocardial infarction")).toBe("cardiovascular");
  });

  it("cancer variants", () => {
    expect(categoriseCauseOfDeath("lung cancer")).toBe("cancer");
    expect(categoriseCauseOfDeath("brain tumour")).toBe("cancer");
    expect(categoriseCauseOfDeath("melanoma")).toBe("cancer");
    expect(categoriseCauseOfDeath("non-Hodgkin lymphoma")).toBe("cancer");
  });

  it("neurovascular: stroke", () => {
    expect(categoriseCauseOfDeath("stroke")).toBe("neurovascular");
  });

  it("neurodegenerative variants including ALS / motor neurone", () => {
    expect(categoriseCauseOfDeath("Alzheimer's disease")).toBe("neurodegenerative");
    expect(categoriseCauseOfDeath("vascular dementia")).toBe("neurodegenerative");
    expect(categoriseCauseOfDeath("Parkinson's")).toBe("neurodegenerative");
    expect(categoriseCauseOfDeath("ALS")).toBe("neurodegenerative");
    expect(categoriseCauseOfDeath("motor neurone disease")).toBe("neurodegenerative");
  });

  it("trauma / accident", () => {
    expect(categoriseCauseOfDeath("car accident")).toBe("trauma_accident");
    expect(categoriseCauseOfDeath("trauma")).toBe("trauma_accident");
    expect(categoriseCauseOfDeath("fall down stairs")).toBe("trauma_accident");
  });

  it("suicide / mental health", () => {
    expect(categoriseCauseOfDeath("suicide")).toBe("suicide_mental_health");
  });

  it("gibberish → unknown", () => {
    expect(categoriseCauseOfDeath("passed in his sleep")).toBe("unknown");
  });

  it("empty / null → undefined (caller leaves field unset)", () => {
    expect(categoriseCauseOfDeath("")).toBeUndefined();
    expect(categoriseCauseOfDeath("   ")).toBeUndefined();
    expect(categoriseCauseOfDeath(null)).toBeUndefined();
    expect(categoriseCauseOfDeath(undefined)).toBeUndefined();
  });
});

describe("migrateLegacyFamily — edit safety (addendum #5)", () => {
  it("does not re-derive ages on cards that were already edited", () => {
    // Member previously edited a card to age_at_death=80 + age_onset=60. The
    // legacy keys still loiter in the JSONB but the shim must NOT touch the
    // already-edited array.
    const edited: FamilyMemberCard[] = [
      {
        id: "edited-1",
        relationship: "mother",
        is_alive: false,
        age_at_death: 80,
        cause_category: "cardiovascular",
        conditions: [{ type: "cardiovascular", age_onset: 60 }],
      },
    ];
    const out = migrateLegacyFamily({
      family: {
        family_members: edited,
        cardiovascular_relatives: ["Mother"],
        cardiovascular_onset_age: 45,
      },
      family_deaths: {
        mother_status: "Deceased",
        mother_age: 90,
        mother_cause_of_death: "stroke",
      },
    });
    expect(out).toBe(edited);
    expect(out[0].age_at_death).toBe(80);
    expect(out[0].cause_category).toBe("cardiovascular");
    expect(out[0].conditions[0].age_onset).toBe(60);
  });
});

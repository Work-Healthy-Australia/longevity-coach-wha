import { describe, it, expect } from "vitest";
import { aggregateConditionFromMembers, buildFamilyHistory } from "@/lib/risk/assemble";
import type { FamilyMemberCard } from "@/lib/questionnaire/schema";

function card(partial: Partial<FamilyMemberCard> & { id?: string }): FamilyMemberCard {
  return {
    id: partial.id ?? "id-" + Math.random().toString(36).slice(2),
    relationship: partial.relationship ?? "",
    is_alive: partial.is_alive ?? true,
    current_age: partial.current_age,
    age_at_death: partial.age_at_death,
    cause_category: partial.cause_category,
    smoking_status: partial.smoking_status,
    alcohol_use: partial.alcohol_use,
    conditions: partial.conditions ?? [],
  };
}

describe("aggregateConditionFromMembers", () => {
  it("returns undefined when members list is empty", () => {
    expect(aggregateConditionFromMembers([], "cardiovascular")).toBeUndefined();
  });

  it("returns undefined when no card has the requested condition", () => {
    const members = [
      card({ relationship: "mother", conditions: [{ type: "diabetes", age_onset: 50 }] }),
    ];
    expect(aggregateConditionFromMembers(members, "cardiovascular")).toBeUndefined();
  });

  it("one first-degree match: first_degree=true, second_degree=false, multiple=false", () => {
    const members = [
      card({ relationship: "mother", conditions: [{ type: "cardiovascular", age_onset: 55 }] }),
    ];
    const out = aggregateConditionFromMembers(members, "cardiovascular");
    expect(out).toEqual({
      first_degree: true,
      second_degree: false,
      age_onset: 55,
      multiple: false,
    });
  });

  it("two first-degree matches: multiple=true (fixes metabolic.ts silent bug)", () => {
    const members = [
      card({ relationship: "mother", conditions: [{ type: "cardiovascular", age_onset: 55 }] }),
      card({ relationship: "father", conditions: [{ type: "cardiovascular", age_onset: 60 }] }),
    ];
    const out = aggregateConditionFromMembers(members, "cardiovascular");
    expect(out?.multiple).toBe(true);
    expect(out?.first_degree).toBe(true);
    expect(out?.age_onset).toBe(55);
  });

  it("only second-degree: first_degree=false, second_degree=true", () => {
    const members = [
      card({
        relationship: "maternal_grandmother",
        conditions: [{ type: "cardiovascular", age_onset: 70 }],
      }),
    ];
    const out = aggregateConditionFromMembers(members, "cardiovascular");
    expect(out).toEqual({
      first_degree: false,
      second_degree: true,
      age_onset: 70,
      multiple: false,
    });
  });

  it("mixed first + second degree: both flags true, multiple=false", () => {
    const members = [
      card({ relationship: "mother", conditions: [{ type: "cardiovascular", age_onset: 65 }] }),
      card({
        relationship: "paternal_grandfather",
        conditions: [{ type: "cardiovascular", age_onset: 72 }],
      }),
    ];
    const out = aggregateConditionFromMembers(members, "cardiovascular");
    expect(out?.first_degree).toBe(true);
    expect(out?.second_degree).toBe(true);
    expect(out?.multiple).toBe(false);
    expect(out?.age_onset).toBe(65);
  });

  it("missing age_onset on entry: result has no age_onset field", () => {
    const members = [
      card({ relationship: "mother", conditions: [{ type: "cardiovascular" }] }),
    ];
    const out = aggregateConditionFromMembers(members, "cardiovascular");
    expect(out).toBeDefined();
    expect("age_onset" in (out ?? {})).toBe(false);
  });

  it("multiple ages: minimum wins", () => {
    const members = [
      card({ relationship: "mother", conditions: [{ type: "cardiovascular", age_onset: 60 }] }),
      card({ relationship: "father", conditions: [{ type: "cardiovascular", age_onset: 48 }] }),
      card({ relationship: "sister", conditions: [{ type: "cardiovascular", age_onset: 55 }] }),
    ];
    const out = aggregateConditionFromMembers(members, "cardiovascular");
    expect(out?.age_onset).toBe(48);
  });

  it("repeated relationship type counts each card separately (two aunts)", () => {
    const members = [
      card({ relationship: "aunt", conditions: [{ type: "neurodegenerative", age_onset: 70 }] }),
      card({ relationship: "aunt", conditions: [{ type: "neurodegenerative", age_onset: 75 }] }),
    ];
    const out = aggregateConditionFromMembers(members, "neurodegenerative");
    expect(out?.first_degree).toBe(false);
    expect(out?.second_degree).toBe(true);
    // Two aunts but neither is first-degree, so multiple stays false
    expect(out?.multiple).toBe(false);
    expect(out?.age_onset).toBe(70);
  });

  // -- Plan addenda -----------------------------------------------------

  it("multiple=false when only one first-degree but a second-degree also matches", () => {
    const members = [
      card({ relationship: "mother", conditions: [{ type: "cardiovascular", age_onset: 55 }] }),
      card({
        relationship: "maternal_grandmother",
        conditions: [{ type: "cardiovascular", age_onset: 60 }],
      }),
    ];
    const out = aggregateConditionFromMembers(members, "cardiovascular");
    expect(out?.multiple).toBe(false);
  });

  it("multiple=true when two parents both diabetic (metabolic.ts fix)", () => {
    const members = [
      card({ relationship: "mother", conditions: [{ type: "diabetes", age_onset: 52 }] }),
      card({ relationship: "father", conditions: [{ type: "diabetes", age_onset: 58 }] }),
    ];
    const out = aggregateConditionFromMembers(members, "diabetes");
    expect(out?.multiple).toBe(true);
    expect(out?.first_degree).toBe(true);
  });
});

describe("buildFamilyHistory — new shape preferred over legacy", () => {
  it("uses family_members[] when present (new path wins)", () => {
    const fh = buildFamilyHistory({
      family_members: [
        {
          id: "a",
          relationship: "mother",
          is_alive: true,
          conditions: [{ type: "cardiovascular", age_onset: 50 }],
        },
      ],
      // legacy keys present too — should be ignored when family_members non-empty
      cardiovascular_relatives: ["Father"],
      cardiovascular_onset_age: 99,
    });
    expect(fh.cardiovascular?.first_degree).toBe(true);
    expect(fh.cardiovascular?.age_onset).toBe(50);
    expect(fh.cardiovascular?.multiple).toBe(false);
  });

  it("falls back to legacy multiselect when family_members is empty/absent", () => {
    const fh = buildFamilyHistory({
      cardiovascular_relatives: ["Father"],
      cardiovascular_onset_age: 55,
    });
    expect(fh.cardiovascular?.first_degree).toBe(true);
    expect(fh.cardiovascular?.age_onset).toBe(55);
  });

  it("aggregates all four card conditions independently", () => {
    const fh = buildFamilyHistory({
      family_members: [
        {
          id: "a",
          relationship: "mother",
          is_alive: true,
          conditions: [
            { type: "cardiovascular", age_onset: 55 },
            { type: "diabetes", age_onset: 60 },
          ],
        },
        {
          id: "b",
          relationship: "paternal_grandmother",
          is_alive: false,
          conditions: [
            { type: "neurodegenerative", age_onset: 78 },
            { type: "osteoporosis", age_onset: 70 },
          ],
        },
      ],
    });
    expect(fh.cardiovascular?.first_degree).toBe(true);
    expect(fh.diabetes?.first_degree).toBe(true);
    expect(fh.neurodegenerative?.second_degree).toBe(true);
    expect(fh.osteoporosis?.second_degree).toBe(true);
  });
});

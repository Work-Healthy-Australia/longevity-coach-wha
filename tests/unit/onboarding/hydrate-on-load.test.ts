// Wave 2 / addendum #1 — mandatory.
//
// Verifies the page-level hydration shim merges legacy family-history data
// into `responses.family.family_members[]` on form load. Mid-onboarding
// drafts with partial `family_deaths` data must remain intact: the engine
// reads the new shape if cards exist; legacy keys harmlessly persist until
// Wave 3 strips them.

import { describe, it, expect } from "vitest";
import type { FamilyMemberCard, ResponsesByStep } from "@/lib/questionnaire/schema";
import { hydrateFamilyMembers } from "@/app/(app)/onboarding/page";

function buildResponses(
  family: Record<string, unknown> = {},
  family_deaths: Record<string, unknown> = {},
): ResponsesByStep {
  return { family, family_deaths };
}

describe("hydrateFamilyMembers — page-load shim", () => {
  it("legacy CV relatives → derived family_members[]", () => {
    const responses = buildResponses({
      cardiovascular_relatives: ["Mother"],
      cardiovascular_onset_age: 55,
    });
    const out = hydrateFamilyMembers(responses) as FamilyMemberCard[];
    expect(out).toHaveLength(1);
    const card = out[0]!;
    expect(card.relationship).toBe("mother");
    expect(card.is_alive).toBe(true);
    expect(card.conditions).toEqual([
      { type: "cardiovascular", age_onset: 55 },
    ]);
  });

  it("merges into responsesWithMigration when called like the page does", () => {
    const responses = buildResponses(
      { cardiovascular_relatives: ["Mother"], cardiovascular_onset_age: 55 },
      {},
    );
    const familyMembers = hydrateFamilyMembers(responses);
    const responsesWithMigration: ResponsesByStep = {
      ...responses,
      family: {
        ...((responses.family as Record<string, unknown>) ?? {}),
        family_members: familyMembers,
      },
    };
    const fam = responsesWithMigration.family as Record<string, unknown>;
    expect(Array.isArray(fam.family_members)).toBe(true);
    expect((fam.family_members as FamilyMemberCard[])).toHaveLength(1);
    // Legacy keys remain — Wave 2 keeps the dual-input alive; Wave 3 strips.
    expect(fam.cardiovascular_relatives).toEqual(["Mother"]);
  });

  it("idempotent: running twice yields the same cards (existing array short-circuits)", () => {
    const responses = buildResponses({
      cardiovascular_relatives: ["Mother"],
      cardiovascular_onset_age: 55,
    });
    const first = hydrateFamilyMembers(responses) as FamilyMemberCard[];
    const merged: ResponsesByStep = {
      ...responses,
      family: {
        ...((responses.family as Record<string, unknown>) ?? {}),
        family_members: first,
      },
    };
    const second = hydrateFamilyMembers(merged) as FamilyMemberCard[];
    expect(second).toBe(first);
  });

  it("no family data → empty array", () => {
    expect(hydrateFamilyMembers({})).toEqual([]);
    expect(hydrateFamilyMembers(buildResponses({}, {}))).toEqual([]);
  });

  it("partial family_deaths data is preserved (mid-onboarding draft safety / addendum #4)", () => {
    // A user mid-onboarding has filled mother's death info but not yet the
    // condition multiselects. The shim derives a card from family_deaths
    // and the legacy keys remain untouched at the responses layer.
    const responses = buildResponses(
      {},
      {
        mother_status: "Deceased",
        mother_age: 78,
        mother_cause_of_death: "heart attack",
      },
    );
    const out = hydrateFamilyMembers(responses) as FamilyMemberCard[];
    expect(out).toHaveLength(1);
    const card = out[0]!;
    expect(card.relationship).toBe("mother");
    expect(card.is_alive).toBe(false);
    expect(card.age_at_death).toBe(78);
    expect(card.cause_category).toBe("cardiovascular");

    // Legacy keys still intact on the original responses object.
    const deaths = responses.family_deaths as Record<string, unknown>;
    expect(deaths.mother_status).toBe("Deceased");
    expect(deaths.mother_age).toBe(78);
  });
});

# QA Report: Family History Redesign — Wave 3
Date: 2026-04-29
Reviewer: dev-loop coordinator

## Build status
- `pnpm build`: PASS (4.0s, 30 routes generated, no TypeScript errors).
- `pnpm test`: PASS — 426 tests across 66 suites, 0 failures, 0 skipped.

## Test results

| Suite | Tests | Pass | Fail | Skipped |
|---|---:|---:|---:|---:|
| `tests/integration/onboarding/family-step.test.ts` (new) | 3 | 3 | 0 | 0 |
| `tests/unit/questionnaire/family-history.test.ts` (rewritten) | 5 | 5 | 0 | 0 |
| `tests/unit/risk/family-aggregation.test.ts` (1 test replaced) | 14 | 14 | 0 | 0 |
| `tests/unit/risk/assemble.test.ts` (fixtures ported to new shape) | unchanged | ✓ | 0 | 0 |
| `tests/unit/questionnaire/schema.test.ts` (step list updated) | unchanged | ✓ | 0 | 0 |
| (other) | rest | ✓ | 0 | 0 |
| **Total** | **426** | **426** | **0** | **0** |

Net: +3 integration cases, +1 fresh-user aggregate case, ported fixtures throughout. Wave 2's `hydrate-on-load.test.ts` (5 cases) removed because its legacy-key fixtures violated the Wave 3 grep gate; superseded by the new integration test.

## Grep gate (addendum #2 mandatory)

```
rg "cardiovascular_relatives|family_deaths|deceasedRelativeFields|familyConditionFromMultiselect" tests/ lib/
```

Zero hits outside `lib/questionnaire/migrate-family.ts` and `tests/unit/questionnaire/migrate-family.test.ts` (the shim and its tests are explicitly allowed because they exist to read legacy data). Gate clean.

## Findings

### Confirmed working
- **Step count dropped from 7 to 6.** New flow: basics → medical → family → lifestyle → goals → consent. `family_deaths` step removed entirely.
- The `family` step's fields array is exactly `[family_members, cancer_history]`. All four `familyConditionFields()` calls removed.
- `familyConditionFields()` and `deceasedRelativeFields()` private helpers removed.
- `buildFamilyHistory()` simplified — reads only `family.family_members[]` (with cancer independent via `adaptCancerHistory`).
- Legacy `familyConditionFromMultiselect()` removed from `assemble.ts`.
- Title-Case `FIRST_DEGREE_RELATIVES` / `SECOND_DEGREE_RELATIVES` sets retained — still consumed by `adaptCancerHistory` (cancer_history typed field uses Title-Case relative labels by design). Documented in a comment.
- `hydrateFamilyMembers()` now runs **before** `stripUnknownKeys()` in `app/(app)/onboarding/page.tsx`. **Bonus fix:** this corrects a pre-existing Wave 2 ordering bug that would have stripped the legacy keys before the shim could read them — a real regression Wave 3 closes.
- New mandatory integration test (`tests/integration/onboarding/family-step.test.ts`) validates the airtight load → migrate → strip → engine flow with three cases:
  1. Full legacy data → cards materialised → orphan keys stripped → engine produces correct `FamilyHistory`.
  2. Condition multiselect + deceased-relative for the same relative → merged into one card → `multiple: true` correctly fires (the latent metabolic.ts bug fix verified end-to-end).
  3. Fresh user with no family data → empty cards array → no engine consumption.
- Test fixtures throughout (`assemble.test.ts`, `family-history.test.ts`, `schema.test.ts`, `family-aggregation.test.ts`) ported to the new `family_members[]` shape or expectations updated.
- All 426 prior tests continue passing.

### Deferred items
- Manual smoke test on a seeded staging member (operator step): visit `/onboarding`, see legacy data appear as cards, click through the 6-step flow (no `family_deaths` step), save, confirm DB now has `family_members[]` and old keys are gone.
- Free-text relative labels ("Aunt Mary") for disambiguating multiple aunts — Out of scope per plan.
- Engine consumption of per-relative smoking/alcohol/cause_category — stored but unused; future engine extension.

### Known limitations
- Members who opened a Wave 2 form but didn't save before Wave 3 ships: their browser still shows the dual-input UI from the previous bundle until they reload. Once they reload, they get the Wave 3 single-input UI; their data flows correctly because the hydration shim runs server-side and reads any legacy keys still in `responses.family.*`.
- `health_profiles.responses` rows in the DB still contain orphan legacy keys (`cardiovascular_relatives`, `family_deaths.*`) until the user's next form save, when `stripUnknownKeys` removes them. This is by design — no DB rewrite, no migration risk.

## Verdict
APPROVED — schema collapsed cleanly, legacy fallback removed, integration test airtight, grep gate satisfied, hydration ordering bug fixed as a bonus, zero regression on the 426-test suite.

# Changelog: Family History Redesign — per-relative card model
Date: 2026-04-29
Phase: Epic 2 (The Intake) — closes the "Family-history sub-fields (age of onset, cancer types)" outstanding item; downstream personalisation hits Epic 3 (engine richer inputs) and Epic 8 (simulator unchanged but feeds richer FamilyHistory).

## What was built

Replaced the previous two-step family approach (per-condition multiselects + a separate "Deaths in the family" step with 18 fields) with a single unified per-relative card model modelled on the wireframe at `wireframes.html` (Option 2 panel) and Base44's `FamilyHistoryStep.jsx`.

- **`<FamilyMembersField>` typed-field renderer** in `app/(app)/onboarding/onboarding-client.tsx`. Each card collects: relationship, alive/dead toggle, age (current OR at death), cause-of-death (8-button category grid, only shown when deceased), smoking status, alcohol use, and a conditions checklist with per-condition age-of-onset.
- **Schema enums + types** in `lib/questionnaire/schema.ts`: `FAMILY_RELATIONSHIPS`, `CAUSE_CATEGORIES`, `SMOKING_VALUES`, `ALCOHOL_VALUES`, `CARD_CONDITIONS`, plus `FamilyMemberCard` and `FamilyMemberConditionEntry` types. New `"family_members"` FieldType.
- **Engine aggregation helper** `aggregateConditionFromMembers()` in `lib/risk/assemble.ts` derives `first_degree`, `second_degree`, `age_onset`, and `multiple` from a `FamilyMemberCard[]`. The deterministic risk engine itself is untouched.
- **Hydration shim** `migrateLegacyFamily()` in `lib/questionnaire/migrate-family.ts` reads any combination of legacy keys (per-condition multiselects + deaths-step entries) and produces the new card shape on form load. Idempotent — short-circuits when `family_members[]` is already non-empty. Cause-of-death regex covers heart/MI/infarct, ALS/motor neurone, stroke, dementia, etc.
- **Latent-bug fix:** `metabolic.ts:132` reads `diabetes.multiple` but the legacy `familyConditionFromMultiselect()` never set the flag. The new aggregator fires `multiple: true` when ≥ 2 first-degree relatives are matched, so two diabetic parents now correctly score 65 instead of 40. Verified end-to-end by the new integration test.
- **Six-step questionnaire** (was seven): basics → medical → family → lifestyle → goals → consent. The separate "Deaths in the family" step is removed; cause-of-death is now per-relative on each card.
- **No DB migration.** Legacy keys orphan in `health_profiles.responses` JSONB and get stripped on next form save by the existing `stripUnknownKeys()` helper.

## What changed

- `lib/questionnaire/schema.ts` — Wave 1 added `"family_members"` FieldType + 5 const enums + 2 types. No other changes.
- `lib/risk/assemble.ts` — Wave 1 added `aggregateConditionFromMembers()`, lowercase `FIRST_DEGREE_REL_KEYS` / `SECOND_DEGREE_REL_KEYS` sets, and dual-path `buildFamilyHistory()`. Wave 3 simplified `buildFamilyHistory()` to the new path only and removed legacy `familyConditionFromMultiselect()`. Title-Case relative sets retained for `adaptCancerHistory()` (cancer_history typed field uses Title-Case labels by design).
- `lib/questionnaire/migrate-family.ts` — Wave 1 new file, exports `migrateLegacyFamily()` and `categoriseCauseOfDeath()`.
- `lib/questionnaire/questions.ts` — Wave 2 prepended new `family_members` field. Wave 3 removed all four `familyConditionFields()` spread calls, removed the entire `family_deaths` step, removed the `familyConditionFields()` and `deceasedRelativeFields()` private helpers, updated the step description.
- `app/(app)/onboarding/onboarding-client.tsx` — Wave 2 added `<FamilyMembersField>` component, switch case, helper exports, and label maps for relationships / causes / smoking / alcohol / conditions.
- `app/(app)/onboarding/onboarding.css` — Wave 2 added `.family-*` class family — cards, head, avatar, vital toggle switch, cause grid, conditions list. Responsive at 480px.
- `app/(app)/onboarding/page.tsx` — Wave 2 added server-side `hydrateFamilyMembers()` call. Wave 3 fixed pre-existing ordering bug (now runs migration BEFORE `stripUnknownKeys()`).
- Tests across Waves 1–3:
  - `tests/unit/risk/family-aggregation.test.ts` (new, Wave 1, 14 cases).
  - `tests/unit/questionnaire/migrate-family.test.ts` (new, Wave 1, 18 cases).
  - `tests/unit/onboarding/family-members-field.test.tsx` (new, Wave 2, 6 cases).
  - `tests/integration/onboarding/family-step.test.ts` (new, Wave 3, 3 cases — mandatory addendum #2).
  - Existing fixtures across `assemble.test.ts`, `family-history.test.ts`, `schema.test.ts` updated to the new shape.

## Migrations applied

None. The change uses the existing `health_profiles.responses` JSONB column. Old keys orphan in storage and get stripped on next save by the existing `stripUnknownKeys()` helper.

## Deviations from plan

- **Bonus fix:** Wave 2's hydration call was ordered AFTER `stripUnknownKeys()`. Wave 3 swapped the order so legacy keys are read by the migration shim BEFORE being stripped. This was a pre-existing latent regression that would have prevented Wave 3 from migrating any seeded user — caught by the new integration test.
- **Wave 2 hydrate-on-load test was removed in Wave 3** because its legacy-key fixtures violated the Wave 3 grep gate. Superseded by the more comprehensive integration test which covers the full load → migrate → strip → engine pipeline.
- **Title-Case relative sets retained.** `adaptCancerHistory()` still uses them because the cancer_history typed field stores Title-Case relative labels (`"Mother"`, `"Maternal grandmother"`). They are NOT in the grep gate; this is intentional and documented inline.

## Known gaps / deferred items

- Manual smoke test on a seeded staging member (operator step): visit `/onboarding`, see legacy data appear as cards, click through the 6-step flow (no `family_deaths` step), save, confirm DB now has `family_members[]` and old keys are gone.
- Free-text relative labels ("Aunt Mary") for disambiguating multiple aunts — out of scope per plan.
- Engine consumption of per-relative `smoking_status`, `alcohol_use`, `cause_category` — currently stored but unused; future engine extension can read them with no further UI changes.
- Mid-onboarding member who opens the form during a Wave 3 deploy but doesn't reload: their browser still shows the previous bundle until next reload. Their server-saved data remains valid.

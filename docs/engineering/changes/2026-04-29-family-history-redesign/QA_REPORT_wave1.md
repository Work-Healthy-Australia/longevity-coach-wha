# QA Report: Family History Redesign — Wave 1
Date: 2026-04-29
Reviewer: dev-loop coordinator

## Build status
- `pnpm build`: PASS (5.0s, 30/30 static pages, no TypeScript errors).
- `pnpm test`: PASS — 415 tests across 64 suites, 0 failures, 0 skipped.

## Test results

| Suite | Tests | Pass | Fail | Skipped |
|---|---:|---:|---:|---:|
| `tests/unit/risk/family-aggregation.test.ts` | 13 | 13 | 0 | 0 |
| `tests/unit/questionnaire/migrate-family.test.ts` | 18 | 18 | 0 | 0 |
| (existing) | 384 | 384 | 0 | 0 |
| **Total** | **415** | **415** | **0** | **0** |

Total new tests: **31** (target was ≥ 15).

## Findings

### Confirmed working
- `FieldType` union extended with `"family_members"`; new const enums (`FAMILY_RELATIONSHIPS`, `CAUSE_CATEGORIES`, `SMOKING_VALUES`, `ALCOHOL_VALUES`, `CARD_CONDITIONS`) exported alongside their derived types.
- `FamilyMemberCard` and `FamilyMemberConditionEntry` types defined with full optional/required field annotations matching the PLAN spec.
- `aggregateConditionFromMembers()` exported pure helper produces the engine's `FamilyHistoryCondition` shape (`first_degree`, `second_degree`, `age_onset`, `multiple`).
- **`multiple` flag latent bug fixed.** The aggregator sets `multiple: true` when ≥ 2 first-degree relatives are matched. `metabolic.ts:132` will now correctly score family diabetes at 65 instead of 40 when both parents are diabetic.
- `buildFamilyHistory()` prefers `family.family_members[]` when non-empty; falls back to legacy `cardiovascular_relatives` etc. Cancer read independently via `adaptCancerHistory` in both paths.
- `migrateLegacyFamily()` is pure, idempotent (short-circuits on existing non-empty `family_members[]`), merges legacy condition multiselects + deaths-step keys into a single per-relative shape.
- Cause-of-death regex covers all addendum #3 patterns: infarct, MI, ALS, motor neurone, plus the originals (heart, stroke, dementia, etc.). Verified by tests.
- Categoriser exposes `categoriseCauseOfDeath()` for re-use elsewhere.
- Title-Case legacy relative sets (`FIRST_DEGREE_RELATIVES`/`SECOND_DEGREE_RELATIVES`) untouched. New lowercase keys (`FIRST_DEGREE_REL_KEYS`/`SECOND_DEGREE_REL_KEYS`) live alongside.
- All pre-existing risk-engine tests (`assemble.test.ts`, `cardiovascular.test.ts`, `_gp-panel-pack.test.ts`, biological-age, etc.) continue to pass unchanged.
- 31 new tests; aggregate suite 415/415.

### Deferred items (per plan, Wave 2/3 scope)
- The new field is NOT yet in `lib/questionnaire/questions.ts` — Wave 2 Task 2.2.
- `migrateLegacyFamily()` is NOT yet called from `app/(app)/onboarding/page.tsx` — Wave 2 Task 2.3.
- `<FamilyMembersField>` client component does not exist — Wave 2 Task 2.1.
- Validation logic for the new field (e.g. card with empty relationship) — to be decided in Wave 2.
- Removal of legacy fields and `family_deaths` step — Wave 3.

### Known limitations
- Wave 1 is intentionally invisible to users. The new path activates only when `family.family_members[]` is non-empty, which won't happen until Wave 2 ships UI to write into it.
- Title-Case "Aunt or uncle" multiselect entries map to `relationship: "aunt"` (member can edit later) — documented in the shim.

## Verdict
APPROVED — schema, assemble plumbing, and hydration shim land cleanly with zero regression. Ready to push.

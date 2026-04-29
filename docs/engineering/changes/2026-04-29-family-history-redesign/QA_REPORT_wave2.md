# QA Report: Family History Redesign — Wave 2
Date: 2026-04-29
Reviewer: dev-loop coordinator

## Build status
- `pnpm build`: PASS. Only the pre-existing Turbopack workspace-root warning.
- `pnpm test`: PASS — 426 tests across 66 suites, 0 failures, 0 skipped.

## Test results

| Suite | Tests | Pass | Fail | Skipped |
|---|---:|---:|---:|---:|
| `tests/unit/onboarding/hydrate-on-load.test.ts` | 5 | 5 | 0 | 0 |
| `tests/unit/onboarding/family-members-field.test.tsx` | 6 | 6 | 0 | 0 |
| (Wave 1 + existing) | 415 | 415 | 0 | 0 |
| **Total** | **426** | **426** | **0** | **0** |

Total new tests in Wave 2: **11** (target was ≥ 2 mandatory; both addendum #1 surfaces covered).

## Findings

### Confirmed working
- `<FamilyMembersField>` client component renders inside the schema-driven form via the new `case "family_members"` switch arm in `onboarding-client.tsx`.
- New CSS class family (`.family-*`) styles the per-relative cards, expand/collapse, vital toggle, cause grid, conditions list. Responsive — cause grid collapses to 1-col under 480px.
- `family_members` field added at index 0 of the `family` step in `questions.ts`. Existing per-condition fields and `cancer_history` remain below. `family_deaths` step still present.
- Step `description` updated to acknowledge the dual-input interim state ("Add family members below for the richest picture, or fill the per-condition fields further down if you prefer").
- `hydrateFamilyMembers` helper exported from `app/(app)/onboarding/page.tsx` and called server-side. Idempotent: existing non-empty `family_members[]` returned as-is.
- Legacy `family_deaths.*` keys persist intact through the shim (addendum #4 explicitly tested by `partial family_deaths data is preserved`).
- Add card → fill relationship → toggle alive → tick condition → all emit `onChange` correctly via the controlled-component contract.
- Five exported pure helpers (`addCard`, `setCardField`, `toggleCondition`, `setConditionAge`, `removeCard`) keep the component logic testable.
- @testing-library/react was already in devDeps; jsdom environment already configured in `vitest.config.ts`. No new dependencies installed.
- All Wave 1 + pre-existing tests (415) continue passing unchanged.

### Deferred items (Wave 3 scope)
- Remove `familyConditionFields()` per-condition fields from the `family` step.
- Remove the entire `family_deaths` step.
- Drop the legacy `familyConditionFromMultiselect` fallback path in `assemble.ts` (or retain with a comment if hydration shim still uses it).
- Migrate test fixtures that construct legacy family responses; explicit `rg "cardiovascular_relatives|family_deaths"` grep gate before declaring Wave 3 done.

### Known limitations
- During Wave 2, both the new cards AND the legacy per-condition fields render in the same step. This is intentional per the wave plan — preserves mid-onboarding drafts and gives members a parallel path during the transition.
- Cause-of-death option labels in the UI use sentence case; the underlying enum is snake_case. Display map lives inline in the component.
- Engine consumes only first_degree / second_degree / age_onset / multiple — smoking, alcohol, and cause_category per relative are stored but currently unused by the scoring engine. Future engine extensions can read them without further UI changes.

### Mid-onboarding draft safety
A member who, before Wave 2 ships, had completed only the legacy "Deaths in the family" step (e.g. mother age 78, father living) will now see those people materialised as cards on next form load. Their `family_deaths.*` keys remain in `health_profiles.responses.family_deaths` until Wave 3's schema cleanup, but the engine reads the new path first and ignores them harmlessly.

## Verdict
APPROVED — UI lands cleanly, hydration shim wired into the page server component, addenda #1 and #4 satisfied, zero regression on the 415 Wave 1 + pre-existing tests.

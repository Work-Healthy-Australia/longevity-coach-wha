# Changelog: SBP questionnaire field
Date: 2026-04-29
Phase: Epic 2 (The Intake) + Epic 8 (Living Record — simulator data source)

## What was built

- **New optional field on the `basics` onboarding step:** "Recent systolic BP reading" (mmHg, 70–250, integer). Skip-friendly via `optional: true` and a helpText that nudges members toward a recent clinic / home / pharmacy reading.
- **Engine-input wiring:** `assemble.ts::buildPatientInput()` now lifts `basics.systolic_bp_mmHg` into `Demographics.systolic_bp_mmHg`. The risk engine's `computeBpScore` (shipped 2026-04-29) takes it from there with AHA-aligned bands.
- **Server-side validation gate:** values outside 70–250 or non-integers are rejected by `validation.ts:13–19`. Empty values are accepted (field is optional).

## What changed

- `lib/questionnaire/questions.ts` — added the `systolic_bp_mmHg` field to the `basics` step between `weight_kg` and `ethnicity`. Schema-driven form renders the field automatically; no UI component change.
- `lib/risk/assemble.ts` — added `systolic_bp_mmHg: num(basics.systolic_bp_mmHg)` to the `demographics` block. Existing `num()` helper handles string-coercion + non-finite guard.
- `tests/unit/questionnaire/basics-sbp.test.ts` (new) — 6 cases (presence, low/high bounds, valid, optional empty, integer-step).
- `tests/unit/risk/assemble-sbp.test.ts` (new) — 3 cases (number lift, undefined → undefined, string-coercion via `num()`).

## Migrations applied

None. Field lives at `health_profiles.responses.basics.systolic_bp_mmHg` (JSONB), matching the existing `height_cm` and `weight_kg` pattern. Single source of truth remains the responses JSONB column.

## Deviations from plan

None. Plan was followed exactly. Two non-blocking observations from the addenda:
- **Bound mismatch flagged for follow-up:** questionnaire allows 70–250 mmHg; simulator slider min is 90. A member entering 80 mmHg (legitimate hypotension) saturates the slider. Tracked as a known limitation; the right fix is to lift the simulator slider min to 70 in a separate change.
- **`PatientDemographics` alias** at `lib/risk/types.ts:248` excludes the new field. Grep confirmed zero consumers — alias is effectively dead code. Out of scope for this change.

## Known gaps / deferred items

- Manual smoke test owed (operator step): complete onboarding with `systolic_bp_mmHg: 145`; visit `/simulator`; confirm slider opens at 145 with no `(population default)` caption; observe Atlas's next narrative referencing `"145 mmHg"`.
- Simulator slider min should be aligned to 70 in a follow-up to handle hypotension entries correctly.
- Temporal validation ("within last 6 months") not enforced — out of scope.
- DBP slider + DBP questionnaire field — out of scope.
- Janet extraction of BP from uploaded blood-test reports — out of scope.

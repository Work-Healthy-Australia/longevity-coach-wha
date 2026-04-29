# Changelog: Numeric SBP slider for the simulator
Date: 2026-04-29
Phase: Epic 3 (The Number — risk engine refinement) + Epic 8 (The Living Record — simulator)

## What was built

- **Numeric systolic blood pressure scoring in the deterministic risk engine.** Added `Demographics.systolic_bp_mmHg?: number` and a new pure helper `computeBpScore({ systolic_bp_mmHg, hasHTN, hasAntihyp })` in `lib/risk/cardiovascular.ts`. AHA-aligned bands: <120 → 0 (optimal), 120–129 → 15 (elevated), 130–139 → 35 (Stage 1), 140–159 → 60 (Stage 2), 160–179 → 85 (severe), ≥180 → 100 (crisis). Antihypertensive medication subtracts 15 from the numeric path score, clamped to ≥ 0.
- **Fallback chain preserves zero regression.** When `systolic_bp_mmHg` is missing or non-finite or ≤ 0, the helper falls through to the existing binary `hypertension` flag from `MedicalHistory.conditions[]`. All 4 pre-existing cardiovascular tests pass unchanged.
- **Fifth slider on `/simulator`.** Range 90–200 mmHg, step 1, default 125, optimal "< 120 mmHg". Slider order on the page is now: LDL → HbA1c → hsCRP → Systolic BP → Weight.
- **Round-trip smoke test.** `tests/unit/simulator/round-trip.test.ts` now asserts SBP up (110 → 175) → cardiovascular domain score up via a genuine `scoreRisk` call (no mocks). Catches a future regression where the slider stops plumbing through the engine.

## What changed

- `lib/risk/types.ts` — added `systolic_bp_mmHg?: number` to `Demographics` (after `weight_kg`).
- `lib/risk/cardiovascular.ts` — added exported pure helper `computeBpScore` with AHA-aligned scoring bands, defensive `Number.isFinite() && > 0` guard, `// LIMITATION:` hypotension comment. Replaced the inline binary calc in `scoreCardiovascular` with a call to the helper.
- `lib/simulator/types.ts` — extended `SimulatorMetric` union with `"systolic_bp_mmHg"`.
- `lib/simulator/apply-overrides.ts` — added SBP override mapping; defensive refinement on the existing `weight_kg` block (`next.demographics ?? base.demographics ?? {}` instead of just `base.demographics`) prevents a latent clobber if a future caller applies both demographic overrides in one call.
- `app/(app)/simulator/page.tsx` — added `systolic_bp_mmHg: 125` to `POPULATION_DEFAULTS`; added the Systolic BP slider config; wired `dem?.systolic_bp_mmHg` into `initialValues` and `isPopulationDefault`.
- `tests/unit/risk/cardiovascular.test.ts` — added 17 new cases (16 in a `describe("computeBpScore")` block + 1 smoke test on `scoreCardiovascular`).
- `tests/unit/simulator/apply-overrides.test.ts` — added 1 case (SBP override applied to demographics).
- `tests/unit/simulator/round-trip.test.ts` — added 1 case (SBP up → cardiovascular up).

## Migrations applied

None. `Demographics.systolic_bp_mmHg` is an engine-internal type field, not a database column. When a future change wires production data, the column lives on `profiles` (vital sign on the patient).

## Deviations from plan

- **`apply-overrides.ts` defensive refinement.** Subagent tightened the existing `weight_kg` spread base from `base.demographics` to `next.demographics ?? base.demographics ?? {}` to prevent a potential clobber when both demographic overrides are applied in one call. Behaviour-equivalent for all existing tests; latent-bug prevention. Flagged in the handoff and accepted.
- **Test count is 19, target was ≥ 14.** Bonus coverage on numeric-overrides-binary, NaN/zero/negative fallthroughs, and a smoke test on `scoreCardiovascular`.

## Known gaps / deferred items

- Manual visual smoke test owed.
- Production data source for `systolic_bp_mmHg` (questionnaire / Janet extraction / `profiles` column) — separate change.
- DBP slider — separate change.
- Hypotension band (`< 90 mmHg → score 25`) — clinical-review decision deferred. Slider min of 90 prevents UI exposure today.
- Engine weight tuning for the `blood_pressure` factor — out of scope.
- Bio-age delta in the simulator — still deferred from B6.

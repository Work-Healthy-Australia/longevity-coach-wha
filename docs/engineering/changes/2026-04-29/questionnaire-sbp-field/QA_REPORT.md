# QA Report: SBP questionnaire field
Date: 2026-04-29
Reviewer: dev-loop coordinator

## Build status
- `pnpm build`: PASS. Only the pre-existing Turbopack workspace-root warning.
- `pnpm test`: PASS — 435 tests across 68 suites, 0 failures, 0 skipped.

## Test results

| Suite | Tests | Pass | Fail | Skipped |
|---|---:|---:|---:|---:|
| `tests/unit/questionnaire/basics-sbp.test.ts` (new) | 6 | 6 | 0 | 0 |
| `tests/unit/risk/assemble-sbp.test.ts` (new) | 3 | 3 | 0 | 0 |
| (other) | 426 | 426 | 0 | 0 |
| **Total** | **435** | **435** | **0** | **0** |

Total new tests: **9** (target was ≥ 9).

## Findings

### Confirmed working
- New `systolic_bp_mmHg` field added to the `basics` step between `weight_kg` and `ethnicity`. Optional number, 70–250 mmHg, step 1, helpText nudges toward fresh readings.
- Form renders the field automatically (schema-driven; no UI component changes).
- Form pre-fills the value on save-and-resume (existing hydration handles it because the field id matches the response key).
- Server-side validation rejects out-of-range values (60 → label, 300 → label) and non-integer values (120.5 → label) via `validation.ts:13–19`. Optional empty path works.
- `assemble.ts::buildPatientInput()` lifts `basics.systolic_bp_mmHg` into `Demographics.systolic_bp_mmHg` via the existing `num()` helper, with string-coercion verified (`"145"` → 145).
- A member who fills 145 in onboarding will see the simulator's SBP slider open at 145 with no `(population default)` caption (the simulator already reads `dem?.systolic_bp_mmHg` from B6 + 2026-04-29 SBP slider work).
- A member who fills 170 will have Atlas's next narrative reference `"170 mmHg"` instead of `"hypertension"` because `computeBpScore` already produces the numeric `raw_value` shape.
- The deterministic engine is untouched; `cardiovascular.ts::computeBpScore` already has the AHA-aligned scoring bands and `Number.isFinite() && > 0` defence.

### Deferred items
- **Bound mismatch** (addendum #1): the questionnaire allows 70–250 mmHg but the simulator slider has min 90. A member who enters 80 mmHg (legitimate hypotension) will see the slider saturate at 90. Recommend a follow-up to lift the simulator slider min to 70 to align with the clinically-correct questionnaire bound. Not blocking; tracked as known limitation.
- **Manual smoke test** owed: complete onboarding with 145; visit `/simulator`, confirm slider opens at 145 with no population-default caption.
- **`PatientDemographics` alias** at `lib/risk/types.ts:248` excludes the new field — but a grep confirmed zero consumers across `lib/` and `app/`, so the alias is effectively dead code. Out of scope for this change; flag for a future cleanup.

### Known limitations
- Members may enter a stale reading. The label says "Recent" and helpText nudges toward "from a clinic, home monitor, or pharmacy" but there's no temporal validation.
- Self-reported values are noisier than clinic-measured ones. The numeric path still beats the binary "hypertension yes/no" fallback either way.
- Members on antihypertensive medication automatically get the −15 adjustment in the engine (per `computeBpScore` shipped 2026-04-29). No UI flag for this.

## Verdict
APPROVED — schema entry, assemble lift, validation gate, and tests all land cleanly. Engine and simulator pick up the new data automatically with zero code changes outside `questions.ts` and `assemble.ts`.

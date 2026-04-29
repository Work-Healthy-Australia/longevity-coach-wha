# QA Report: Numeric SBP slider for the simulator
Date: 2026-04-29
Reviewer: dev-loop coordinator

## Build status
- `pnpm build`: PASS. Only the pre-existing Turbopack workspace-root warning.
- `pnpm test`: PASS — 383 tests across 64 suites, 0 failures, 0 skipped.

## Test results

| Suite | Tests | Pass | Fail | Skipped |
|---|---:|---:|---:|---:|
| `tests/unit/risk/cardiovascular.test.ts` | 21 (was 4) | 21 | 0 | 0 |
| `tests/unit/simulator/apply-overrides.test.ts` | 7 (was 6) | 7 | 0 | 0 |
| `tests/unit/simulator/round-trip.test.ts` | 3 (was 2) | 3 | 0 | 0 |
| (other) | 352 | 352 | 0 | 0 |
| **Total** | **383** | **383** | **0** | **0** |

Total new tests: **19** (target was ≥ 14).

## Findings

### Confirmed working
- `Demographics.systolic_bp_mmHg?: number` added — backwards-compatible (optional).
- `computeBpScore` exported from `lib/risk/cardiovascular.ts` with AHA-aligned scoring bands (0/15/35/60/85/100).
- Defensive `Number.isFinite() && > 0` guard on the numeric path (addendum #1) — non-finite or non-positive values fall through to the binary path.
- `// LIMITATION:` comment in `computeBpScore` documenting the hypotension blind spot (addendum #2).
- Antihypertensive adjustment (−15 in numeric path, clamped to ≥ 0).
- Fallback chain preserved: numeric → binary `hypertension` flag → 0. **Zero regression** — all 4 pre-existing cardiovascular tests pass unchanged.
- `raw_value` shape varies between `"normal"`, `"hypertension"`, and `"NNN mmHg"` (addendum #3).
- Smoke test at `scoreCardiovascular` level confirms the factor's `raw_value` is `"145 mmHg"` and `score === 60` when `demographics.systolic_bp_mmHg = 145`.
- `SimulatorMetric` extended to include `"systolic_bp_mmHg"`.
- `applyOverrides` writes SBP into `demographics.systolic_bp_mmHg`; uses `!== undefined` guard.
- Defensive refinement in `applyOverrides`: the `weight_kg` block now spreads `next.demographics ?? base.demographics ?? {}` so future callers applying both demographic overrides in one call don't clobber each other. Latent-bug prevention; existing tests unaffected.
- `/simulator` page renders 5 sliders in order: LDL → HbA1c → hsCRP → **Systolic BP** → Weight.
- `POPULATION_DEFAULTS.systolic_bp_mmHg = 125`; member-no-data case opens the slider at 125 with `(population default)` caption.
- `<SimulatorClient>` is metric-agnostic — required no changes.
- Round-trip smoke test: SBP 110 → 175 produces a real `scoreCardiovascular` increase via genuine `scoreRisk` call (no mocks).

### Deferred items
- Manual visual smoke test owed: visit `/simulator`, drag SBP from 145 to 120, confirm cardiovascular row drops directionally and the composite risk follows.
- Production data source for `systolic_bp_mmHg` — no questionnaire field, no `profiles` column, no Janet extraction yet. Slider works via population default.
- DBP slider — separate change.
- Hypotension band (`< 90 mmHg → score 25`) — clinical-review decision deferred per addendum #2.
- Engine weight tuning for the `blood_pressure` factor — out of scope.
- Bio-age delta in the simulator — still deferred from B6.

### Known limitations
- **Hypotension blind spot.** SBP < 90 mmHg currently scores 0 (same as 110). The slider min is 90 so members can't reach it via the UI. Documented in the helper comment and the executive summary.
- **`raw_value` format change.** The factor's `raw_value` string varies by path: `"normal"` / `"hypertension"` / `"145 mmHg"`. No type-level breakage (consumers see `unknown`), but Atlas narrative pipeline and PDF report read these strings. Worth informing the clinical advisor and watching Atlas's first run after deploy.
- **Numeric overrides binary self-report.** A member with `hypertension` in conditions AND a numeric SBP of 110 (e.g. on aggressive medication) scores 0 (or 0 after antihyp adjustment). Desired behaviour — actual measured pressure beats self-report — but flagged in case the clinical-advisor cycle wants to reverse it.
- **Antihypertensive adjustment is heuristic.** −15 is a rule of thumb. Real clinical practice considers underlying-pressure-off-medication, which depends on med class and dose. Adjustable in a future change.

## Verdict
APPROVED — both tasks passed inline reviews; build + full suite green; all three Phase 4 addenda satisfied; zero regression on existing cardiovascular tests.

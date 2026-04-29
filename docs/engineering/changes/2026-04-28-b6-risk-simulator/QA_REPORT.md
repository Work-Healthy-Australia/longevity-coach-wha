# QA Report: B6 — Risk simulator
Date: 2026-04-29
Reviewer: dev-loop coordinator

## Build status
- `pnpm build`: PASS. `/simulator` registered as a dynamic route. Only the pre-existing Turbopack workspace-root warning.
- `pnpm test`: PASS — 364 tests across 62 suites, 0 failures, 0 skipped.

## Test results

| Suite | Tests | Pass | Fail | Skipped |
|---|---:|---:|---:|---:|
| `tests/unit/simulator/apply-overrides.test.ts` | 6 | 6 | 0 | 0 |
| `tests/unit/simulator/format-delta.test.ts` | 4 | 4 | 0 | 0 |
| `tests/unit/simulator/round-trip.test.ts` | 2 | 2 | 0 | 0 |
| (other) | 352 | 352 | 0 | 0 |
| **Total** | **364** | **364** | **0** | **0** |

Total new tests: **12** (target was ≥ 11).

## Findings

### Confirmed working
- Migration: **none required** (pure client-side simulation).
- `lib/simulator/` pure helpers (`applyOverrides`, `formatDelta`) imported only via direct file paths, no barrel re-export risk.
- **Round-trip smoke tests genuinely call `scoreRisk`** — no mocks. Two assertions catch a future regression where `applyOverrides` accidentally fails to plumb a slider through:
  - LDL up → composite_risk up
  - Weight up → metabolic domain score up
- `/simulator` page is a server component; only `<SimulatorClient>` is `"use client"`.
- Client component imports from `@/lib/risk/scorer` + `@/lib/risk/types` only (addendum #1 satisfied — no barrel pulling Supabase into the bundle).
- Server-side `assemblePatientFromDB` runs once, baseline computed once, results passed to the client component as props.
- Empty-state branch when `getOverallCompleteness < 0.10` — CTA → `/onboarding`.
- Population-default detection: each metric flagged with `(population default)` muted caption when the member's data is missing.
- All four sliders have `aria-label="<label> in <unit>"` (addendum #2 satisfied).
- `useDeferredValue` smooths slider drag; `useMemo` ensures the engine recomputes only when deferred values change.
- `parseFloat` (not `parseInt`) for `step: 0.1` precision on hba1c and hsCRP.
- Reset button disabled when `!isDirty`.
- Composite risk + 5 domain scores rendered with `formatDelta`; arrow tone (down=green, up=red, equal=grey) reflects directional change.
- Domain labels via fixed `DOMAIN_LABELS` map (no runtime capitalisation).
- One-line acknowledgement comment in `app/(app)/simulator/page.tsx` notes that the full `PatientInput` is serialised into the client HTML payload (addendum #3 satisfied).
- Dashboard quick-link tile added immediately after Trends; no existing tile replaced.
- 12 new tests passing; full suite 364/364.

### Deferred items
- **Manual visual smoke test owed.** Visit `/simulator` with seeded data; drag each slider; confirm scores update smoothly and arrow tones flip direction correctly. Visit with insufficient data (no questionnaire, no biomarkers); confirm empty-state CTA renders.
- **`PatientInput` payload trimming.** The full `PatientInput` is currently serialised into `__next_f`. De-identified but member-level. Trimming to a `SimulatorPatient` slice is a follow-up if profiling shows the payload bloating beyond ~50 KB.
- Numeric SBP slider — separate change. Engine currently treats BP as a binary `hypertension` flag from `MedicalHistory.conditions[]`; a numeric SBP slider would require an engine extension.
- Bio-age delta in the side-by-side display — separate change. Bio-age depends on more inputs than the four sliders touch (HRV, VO₂max, deep sleep); displaying a delta would risk misleading directionality.
- Multi-month "what if I do this for 6 months" trajectory — separate change.
- Save / share simulated states — separate change.
- Top-nav entry for `/simulator` — out of scope; dashboard quick-tile is the only entry point this round.

### Known limitations
- Population defaults can mislead: a member with no data who slides hsCRP from 1.5 → 8 will see CV risk rise — but the baseline was synthetic. The `(population default)` caption is the disclosure.
- Mobile slider precision: `step: 0.1` for hba1c/hsCRP is hard to land precisely on touch. Acceptable trade-off for clarity.
- No persistence: simulator state is lost on navigation. Intentional — this is a what-if tool, not a journal.
- Engine domain scores can be `0` for members with low data completeness in a specific domain; arrow tone in those rows shows as `equal` until simulated values diverge.

## Verdict
APPROVED — both tasks passed inline reviews; build + full suite green; all three Phase 4 addenda satisfied.

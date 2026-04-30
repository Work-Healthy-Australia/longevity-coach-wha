# Changelog: B6 — Risk simulator
Date: 2026-04-29
Phase: Epic 8 (The Living Record), pre-approved sprint-1 stretch

## What was built

- **`/simulator` page.** A signed-in member moves four sliders — LDL, HbA1c, hsCRP, Weight — and watches the deterministic risk engine recompute their composite risk and five domain scores in real-time, side-by-side with their baseline.
- **Server-component-loads-baseline / client-component-recomputes pattern.** The page's server component runs `assemblePatientFromDB(supabase, user.id)` once and computes baseline `scoreRisk(patient)`. The client component holds slider state, runs `scoreRisk(applyOverrides(patient, deferredValues))` under `useDeferredValue` for smooth drag, and renders `formatDelta(baseline, simulated)` for each score.
- **Pure `lib/simulator/` helpers.**
  - `applyOverrides(base, overrides)` — pure, returns a new `PatientInput` with slider values merged into `biomarkers.blood_panel` and `demographics`. Creates missing paths; treats numeric `0` as a valid override.
  - `formatDelta(baseline, simulated)` — formats `${b} → ${s} (${sign}${abs})` with U+2212 minus.
  - `SimulatorMetric`, `SimulatorOverrides`, `SliderConfig`, `BaselineSnapshot` types.
- **Empty state.** When `getOverallCompleteness(baseline.domains) < 0.10`, the page renders a "Complete your assessment to use the simulator" panel with a CTA to `/onboarding`.
- **Population-default detection.** When a member has no value for a metric, the slider opens at a population default (LDL 130, HbA1c 5.4, hsCRP 1.5, Weight 75) with a `(population default)` muted caption — visible disclosure that the baseline is synthetic.
- **Round-trip smoke tests.** `tests/unit/simulator/round-trip.test.ts` calls `scoreRisk` against an overridden `PatientInput` (no mocks) and asserts directional sanity (LDL ↑ → composite ↑; weight ↑ → metabolic score ↑). The safety net against a future regression where a slider stops plumbing through the engine.
- **Auth gating.** `/simulator` added to `PROTECTED_PREFIXES`.
- **Dashboard quick-link.** New `<QuickTile href="/simulator" label="Simulator" sub="Slide and see" icon="🎚️" />` added to the existing `lc-quick` row immediately after Trends. No existing tile was replaced or modified.

## What changed

- `lib/simulator/index.ts` (new) — re-exports.
- `lib/simulator/types.ts` (new) — `SimulatorMetric`, `SimulatorOverrides`, `SliderConfig`, `BaselineSnapshot`. Imports `PatientInput` from `@/lib/risk/types` directly (not the barrel).
- `lib/simulator/apply-overrides.ts` (new) — pure helper.
- `lib/simulator/format-delta.ts` (new) — pure helper.
- `lib/supabase/proxy.ts` — `/simulator` added to `PROTECTED_PREFIXES`.
- `app/(app)/simulator/page.tsx` (new) — server component. Top-of-file comment acknowledges the full-`PatientInput`-into-`__next_f` serialisation as a known limitation.
- `app/(app)/simulator/_components/simulator-client.tsx` (new) — `"use client"`. Imports `scoreRisk` from `@/lib/risk/scorer` and types from `@/lib/risk/types` directly. Uses `useDeferredValue` for smooth slider drag. `aria-label` on each range input.
- `app/(app)/simulator/simulator.css` (new) — scoped styles, two-column on desktop, stacked on mobile, sage palette.
- `app/(app)/dashboard/page.tsx` — one new `<QuickTile>` added to `lc-quick`; no other changes.
- `tests/unit/simulator/apply-overrides.test.ts` (new) — 6 cases.
- `tests/unit/simulator/format-delta.test.ts` (new) — 4 cases.
- `tests/unit/simulator/round-trip.test.ts` (new) — 2 cases (genuine `scoreRisk` calls, no mocks).

## Migrations applied

None. Pure client-side simulation.

## Deviations from plan

- **Test count is 12, target was ≥ 11.** A bonus apply-overrides case covers numeric `0` as a valid override (defends against a future "falsy" regression).
- **Dashboard tile placement** is immediately after Trends (per plan). No tile was replaced.

## Known gaps / deferred items

- Manual visual smoke test owed (operator).
- Numeric SBP slider — separate change. Engine treats BP as a binary `hypertension` flag from `MedicalHistory.conditions[]`; a numeric slider would require an engine extension.
- Bio-age delta in the side-by-side display — separate change. Bio-age depends on more inputs than the four sliders touch.
- `PatientInput` payload trimming — full `PatientInput` is serialised into `__next_f`. De-identified data, but a `SimulatorPatient` slice would shrink the payload. Deferred until profiling shows it bloating beyond ~50 KB.
- Multi-month trajectory simulator — separate change.
- Save / share simulated states — separate change.
- Top-nav entry for `/simulator` — dashboard quick-link only this round.

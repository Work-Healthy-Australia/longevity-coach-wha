# Plan: B6 — Risk simulator
**Date:** 2026-04-28
**Phase:** Epic 8 (The Living Record), pre-approved sprint-1 stretch per `plan-non-ai.md`
**Status:** Draft

## Objective

Give a signed-in member a `/simulator` page where they can drag four sliders — LDL, HbA1c, hsCRP, weight — and watch the deterministic risk engine recompute their composite risk and five domain scores **in real-time**, side-by-side with their current baseline. Done = a member with at least an assessment + some lab data sees baseline-vs-simulated scores update on every slider change; a member without enough data sees a friendly "Complete your assessment to use the simulator" CTA.

**Slider set (final):** LDL (mg/dL), HbA1c (%), hsCRP (mg/L), Weight (kg). All four are direct numeric inputs to `scoreRisk`. Systolic BP is intentionally NOT a slider this round — the engine treats it as a binary `hypertension` flag from `MedicalHistory.conditions[]`, not a numeric input. A slider driving a binary flag would be misleading. Adding numeric SBP to the engine is a separate change, called out in the executive summary.

**Engine assumption:** `scoreRisk(patient)` is bundle-safe for the browser (pure module, no `"use server"`, no DB imports). `assemblePatientFromDB` is server-side only and used in the page's server component.

## Scope

**In scope:**
- New page `/simulator` (server component) that loads `PatientInput` from DB once and hands it to a client component.
- New client component `<SimulatorClient>` that holds slider state, debounces re-runs of `scoreRisk`, and renders baseline-vs-simulated scores.
- Pure helper `lib/simulator/apply-overrides.ts` to merge slider values into a `PatientInput` (testable; engine isn't touched).
- Pure helper `lib/simulator/format-delta.ts` for the side-by-side display (e.g. `45 → 38 (−7)`).
- New scoped CSS `simulator.css`.
- `/simulator` added to `PROTECTED_PREFIXES`.
- Dashboard quick-tile entry for `/simulator` alongside the existing tiles.
- Tests for the helpers + a smoke test that round-trips `scoreRisk` against an overridden `PatientInput`.
- Empty-state handling for members without enough data.

**Out of scope:**
- Adding numeric `systolic_bp_mmHg` to the engine. Future change. Mentioned in the executive summary as the natural follow-up.
- Bio-age delta in the side-by-side display. Bio-age depends on more inputs than the four sliders touch (HRV, VO₂max, deep sleep, etc.); showing a delta would risk misleading directionality. Future change.
- Saving simulated states. Pure client-side; "Reset to current" restores baseline.
- Multi-day "what if I do this for 6 months" trajectory. Engine has `projectTrajectory` but it's a different mental model.
- Top-nav entry for `/simulator` — dashboard quick-tile only this round.
- Any change to the risk engine itself (`lib/risk/`).

## Data model changes

**None.** Pure client-side simulation. `scoreRisk` is deterministic; the simulator runs it in the browser with locally overridden inputs.

## Tasks

Two tasks, sequential.

---

### Task 1 — `lib/simulator/` helpers + proxy guard

**Files affected:**
- `lib/simulator/index.ts` (new — re-exports).
- `lib/simulator/apply-overrides.ts` (new).
- `lib/simulator/format-delta.ts` (new).
- `lib/simulator/types.ts` (new — `SimulatorOverrides` + `SliderConfig`).
- `lib/supabase/proxy.ts` (extend `PROTECTED_PREFIXES`).
- `tests/unit/simulator/apply-overrides.test.ts` (new).
- `tests/unit/simulator/format-delta.test.ts` (new).
- `tests/unit/simulator/round-trip.test.ts` (new — calls `scoreRisk` against an overridden input to confirm the wiring still produces sensible numbers).

**What to build:**

#### `lib/simulator/types.ts`

```ts
import type { PatientInput } from "@/lib/risk";

export type SimulatorMetric = "ldl" | "hba1c" | "hsCRP" | "weight_kg";

export type SimulatorOverrides = Partial<Record<SimulatorMetric, number>>;

export type SliderConfig = {
  metric: SimulatorMetric;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;       // population default if member has no data
  optimalText: string;         // for caption: "Optimal: < 100 mg/dL"
};

export type BaselineSnapshot = {
  patient: PatientInput;
  values: Record<SimulatorMetric, number | null>;  // null when member has no data for that metric
  hasEnoughData: boolean;     // false → page renders the empty-state CTA
};
```

#### `lib/simulator/apply-overrides.ts`

```ts
import type { PatientInput } from "@/lib/risk";
import type { SimulatorOverrides } from "./types";

/**
 * Returns a new PatientInput with the slider overrides applied. Pure.
 * Does not mutate the input. Slider values that are undefined leave the
 * baseline value untouched.
 */
export function applyOverrides(
  base: PatientInput,
  overrides: SimulatorOverrides,
): PatientInput;
```

Behaviour:
- Deep-clone or structured-clone the relevant nested objects (`biomarkers.blood_panel`, `demographics`).
- For each defined override:
  - `ldl` → `biomarkers.blood_panel.ldl`.
  - `hba1c` → `biomarkers.blood_panel.hba1c`.
  - `hsCRP` → `biomarkers.blood_panel.hsCRP`.
  - `weight_kg` → `demographics.weight_kg`.
- Preserve all other fields verbatim.
- Idempotent on empty overrides.

#### `lib/simulator/format-delta.ts`

```ts
export function formatDelta(baseline: number, simulated: number): string;
```

Behaviour:
- Round both to integers (engine scores are 0–100 ish).
- Output `${baseline} → ${simulated} (${sign}${abs})` where `sign` is `−`, `+`, or empty when zero.
- Examples: `45 → 38 (−7)`, `45 → 50 (+5)`, `45 → 45 (0)`.

#### `lib/simulator/index.ts`

Re-exports types + helpers.

#### Proxy

Add `"/simulator"` to `PROTECTED_PREFIXES`.

#### Tests

`apply-overrides.test.ts` (≥ 5 cases):
1. Empty overrides → returned input is structurally equal to baseline.
2. `{ ldl: 100 }` overrides only `biomarkers.blood_panel.ldl`; other fields preserved.
3. `{ weight_kg: 80 }` overrides only `demographics.weight_kg`; doesn't touch `biomarkers`.
4. All four overrides applied → all four fields updated, no others changed.
5. Baseline missing `biomarkers.blood_panel` entirely → override creates the path, doesn't crash.

`format-delta.test.ts` (≥ 4 cases):
1. `(45, 38)` → `"45 → 38 (−7)"` (en-dash minus).
2. `(45, 50)` → `"45 → 50 (+5)"`.
3. `(45, 45)` → `"45 → 45 (0)"`.
4. Floats round to integers: `(45.7, 38.2)` → `"46 → 38 (−8)"`.

`round-trip.test.ts` (≥ 2 cases):
1. Build a fixture `PatientInput` (use any existing risk-engine test fixture under `tests/fixtures/risk-profiles.ts`). Apply `{ ldl: 200 }`. Run `scoreRisk` on both. Assert the simulated `composite_risk` is **strictly greater** than baseline (LDL going up should never lower CV risk).
2. Apply `{ weight_kg: <baseline + 30> }` to a normal-weight fixture. Assert simulated metabolic domain score rises.

This is a smoke test for the wiring, not a thorough engine eval. It guards against future regressions where `applyOverrides` accidentally fails to plumb a slider through.

**Acceptance criteria:**
- `pnpm build` clean.
- `pnpm test` green; ≥ 11 new test cases under `tests/unit/simulator/`.
- All helpers exported from `lib/simulator/index.ts`.
- `/simulator` redirects to `/login` for unauthenticated users.

**Rules to apply:**
- `.claude/rules/nextjs-conventions.md` — pure helpers in `lib/`.
- `.claude/rules/data-management.md` — no PII; pure client-side simulation.

---

### Task 2 — `/simulator` page + client component + dashboard tile

**Files affected:**
- `app/(app)/simulator/page.tsx` (new — server component).
- `app/(app)/simulator/_components/simulator-client.tsx` (new — `"use client"`).
- `app/(app)/simulator/simulator.css` (new).
- `app/(app)/dashboard/page.tsx` (modify — add a `<QuickTile href="/simulator">` to the existing quick-links row).

**What to build:**

#### `app/(app)/simulator/page.tsx` (server component)

1. `createClient()` from `lib/supabase/server`. Get user; defensive `if (!user) return null`.
2. Use `assemblePatientFromDB(supabase, user.id)` to build the `PatientInput`.
3. Compute `baseline = scoreRisk(patient)`.
4. **Empty-state detection.** If the user has no `health_profiles` row OR `getOverallCompleteness(baseline.domains) < 0.10`, treat as "not enough data" and render an empty-state panel. The exact threshold mirrors the engine's `'insufficient'` confidence bucket.
5. Otherwise pass `{ patient, baseline, initialValues }` to `<SimulatorClient>` where `initialValues` are the member's current values for the four metrics (or population defaults where missing).
6. Page header: title `Risk Simulator`, subtitle `Move the sliders. See how each one shifts your risk and domain scores.`

Population defaults (used when member has no value for a metric — show as the slider's starting position with a small "(population default)" note):

```ts
const POPULATION_DEFAULTS: Record<SimulatorMetric, number> = {
  ldl: 130,        // mg/dL
  hba1c: 5.4,      // %
  hsCRP: 1.5,      // mg/L
  weight_kg: 75,   // kg
};
```

Slider configs:

```ts
const SLIDERS: SliderConfig[] = [
  { metric: "ldl", label: "LDL Cholesterol", unit: "mg/dL", min: 40, max: 250, step: 1, defaultValue: 130, optimalText: "Optimal: < 100 mg/dL" },
  { metric: "hba1c", label: "HbA1c", unit: "%", min: 4.0, max: 12.0, step: 0.1, defaultValue: 5.4, optimalText: "Optimal: < 5.4%" },
  { metric: "hsCRP", label: "hsCRP", unit: "mg/L", min: 0.1, max: 10, step: 0.1, defaultValue: 1.5, optimalText: "Optimal: < 1.0 mg/L" },
  { metric: "weight_kg", label: "Weight", unit: "kg", min: 40, max: 200, step: 0.5, defaultValue: 75, optimalText: "Healthy BMI 18.5–24.9 (depends on height)" },
];
```

#### `app/(app)/simulator/_components/simulator-client.tsx` (client component)

```tsx
"use client";
import { useMemo, useState, useDeferredValue } from "react";
import { scoreRisk, type PatientInput, type EngineOutput } from "@/lib/risk";
import { applyOverrides, formatDelta, type SimulatorOverrides, type SliderConfig } from "@/lib/simulator";
```

Props:
```ts
type Props = {
  patient: PatientInput;
  baseline: EngineOutput;
  initialValues: Record<SimulatorMetric, number>;
  sliders: SliderConfig[];
};
```

State:
- `values: Record<SimulatorMetric, number>` initialised from `initialValues`.
- Use `useDeferredValue(values)` so slider drag is smooth (React batches the engine recompute).
- `simulated = useMemo(() => scoreRisk(applyOverrides(patient, deferredValues)), [deferredValues, patient])`.

Layout:
- Two columns on desktop (>900px), stacked on mobile:
  - **Left column — sliders.** One labelled `<input type="range">` per metric. Below each, the current numeric value, the unit, and the `optimalText` caption.
  - **Right column — score display.** Composite risk first (large), then five domain rows. Each shows `formatDelta(baseline.score, simulated.score)`. Coloured arrow indicating direction (down = green, up = red, equal = grey).
- "Reset to current" button restores `initialValues`.
- Sub-line under composite risk: "Drag a slider to see live impact on your risk profile."

The component renders `null`-check fallbacks when any score is undefined (defensive — engine should always return them).

#### `app/(app)/simulator/simulator.css`

Scoped styles. Reuse colour tokens from `dashboard.css` and `labs.css`. No new palette. Slider visual uses native `accent-color` set to the project sage.

Mobile: stack vertically. Sliders are touch-targets at full width.

#### Dashboard tile

In `app/(app)/dashboard/page.tsx`, add one `<QuickTile href="/simulator" label="Simulator" sub="Slide and see" icon="🎚️" />` to the existing `lc-quick` row. **Do NOT** replace any `<ComingTile>`. **Do NOT** modify any existing tile or query. Place the new tile after the existing Trends tile.

#### Tests

No new tests required for the page/client component (the rendered chart-style output is a poor JSDOM target). Task 1's helper tests + the round-trip smoke test cover the hot path.

**Acceptance criteria:**
- `/simulator` renders sliders + score display when the member has enough data.
- Empty-state renders for members without enough data; CTA points to `/onboarding`.
- Dragging a slider updates the simulated scores within ~100ms.
- "Reset to current" restores the initial values.
- Dashboard quick-link tile links to `/simulator`.
- `pnpm build` clean.
- `pnpm test` green.
- `/simulator` is auth-gated.
- No PII on the page.

**Rules to apply:**
- `.claude/rules/nextjs-conventions.md` — server component for the page; only the simulator interactive surface is `"use client"`. `_components/` underscore-prefixed. Scoped CSS.
- `.claude/rules/security.md` — server-side data load via user-context client only; no admin client; no PII.
- `.claude/rules/data-management.md` — no PII; no derived data stored.

---

## Build order

Sequential. Task 1 must complete before Task 2 (Task 2 imports from `lib/simulator`).

## Per-task review gate

Spec compliance + code-quality reviews per task. Both must pass before marking complete. Manual visual check of the slider UI is operator-side (same pattern as B4, B5).

## Definition of done (whole change)

1. Both tasks ✅ on both reviews.
2. `pnpm build` clean.
3. `pnpm test` green with ≥ 11 new tests under `tests/unit/simulator/`.
4. Manual: visit `/simulator` with seeded data → drag sliders, see scores update; visit with insufficient data → empty-state CTA.
5. Dashboard quick-tile row gains a Simulator entry.
6. CHANGELOG, EXECUTIVE_SUMMARY, QA_REPORT present.
7. EXECUTIVE_SUMMARY explicitly calls out "numeric SBP slider" as the natural follow-up.

## Risks

- **Engine is bundle-safe today** but a future addition could accidentally introduce a server-only import. Mitigation: the round-trip test runs `scoreRisk` from the same module surface the client component will use; if a new server-only import lands in `lib/risk/`, the test catches it (vitest runs in node, but the bundling fails in `pnpm build`).
- **Slider thrash.** Without `useDeferredValue` the engine re-runs on every input frame. Plan uses it explicitly.
- **Population defaults can mislead.** A member with no data who slides hsCRP from 1.5 to 8 will see CV risk rise — but the baseline was synthetic. Mitigation: a "(population default)" caption next to any slider whose initial value came from defaults.
- **Mobile slider precision.** Step sizes (`step: 0.1` for hba1c) may be hard to land precisely on touch. Acceptable trade-off for clarity; can tune later.

## Plan-review addenda (post Phase 4)

The plan reviewer cleared APPROVED WITH NOTES. The following are mandatory for the executor:

1. **Client imports skip the barrel.** The `@/lib/risk` barrel re-exports `assemblePatientFromDB` from `assemble.ts`, which imports `@supabase/supabase-js`. Even with tree-shaking, dev bundles and any accidental future re-export risk pulling Supabase into the client. The simulator client component MUST import directly:
   ```ts
   import { scoreRisk } from "@/lib/risk/scorer";
   import type { PatientInput, EngineOutput } from "@/lib/risk/types";
   ```
   Do NOT use `import { ... } from "@/lib/risk"` from the client component. The pure helpers in `lib/simulator/` may import from the barrel since they only run server-side or in tests.

2. **Accessibility on the sliders.** Each `<input type="range">` MUST have an `aria-label` (or a `<label htmlFor>` with descriptive text) including the metric name and unit — e.g. `aria-label="LDL Cholesterol in milligrams per decilitre"`. Browsers expose `aria-valuenow` natively for range inputs, so no manual ARIA is needed for the current value, but the label is required.

3. **PatientInput serialisation acknowledgement.** Passing the full `PatientInput` to the client component serialises it into the HTML payload (`__next_f`). It's de-identified data but contains the entire questionnaire + biomarker JSON. For this round, add a one-line acknowledgement comment in `app/(app)/simulator/page.tsx` noting this. Trimming to a `SimulatorPatient` slice is a deferred follow-up; record it as a known limitation in the QA report + CHANGELOG. Do not block on it.

The executor reads this section before starting Task 1.

## Out of scope (carried forward)

- Numeric SBP slider + engine extension (separate change).
- Bio-age delta in the display.
- Multi-month trajectory simulator.
- Save / share simulated states.
- Top-nav entry for `/simulator`.

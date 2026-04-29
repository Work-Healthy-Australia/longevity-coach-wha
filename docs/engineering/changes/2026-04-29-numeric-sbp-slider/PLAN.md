# Plan: Numeric SBP slider for the simulator
**Date:** 2026-04-29
**Phase:** Epic 3 (The Number — risk engine refinement) + Epic 8 (The Living Record — simulator)
**Status:** Draft

## Objective

Extend the deterministic risk engine to accept a numeric `systolic_bp_mmHg` value and compute a graded score against AHA-aligned thresholds, then add SBP as the fifth slider on `/simulator`. Today the engine treats blood pressure as a binary `hypertension` flag from `MedicalHistory.conditions[]`; a numeric slider would be misleading. Done = a member can drag SBP from 145 to 120 and see their cardiovascular and composite risk drop smoothly through six scoring bands; existing members with no numeric SBP value behave identically to before (binary fallback preserved).

## Scope

**In scope:**
- Add `systolic_bp_mmHg?: number` to `Demographics` in `lib/risk/types.ts`.
- New pure helper `computeBpScore({ systolic_bp_mmHg, hasHTN, hasAntihyp })` in `lib/risk/cardiovascular.ts` (or a small co-located helper).
- Replace the inline binary calc in `scoreCardiovascular` with a call to the new helper. Keep the factor name (`blood_pressure`), weight (0.08), and behaviour-when-no-numeric identical.
- Extend `SimulatorMetric` with `"systolic_bp_mmHg"`. Update `applyOverrides` to write `systolic_bp_mmHg` → `demographics.systolic_bp_mmHg`.
- Add SBP slider config to `/simulator` page: range 90–200, step 1, default 125, optimal "< 120 mmHg".
- Tests: scoring band, fallback chain, round-trip smoke test (SBP up → CV risk up).

**Out of scope:**
- Diastolic BP. Separate change.
- Wiring `systolic_bp_mmHg` to a storage column or questionnaire input. The simulator works with a population default; production data source is a follow-up.
- Janet extracting BP from uploaded blood-test reports (Janet's prompt would need a structured `vitals` field — separate change).
- Changing the cardiovascular factor weight (0.08) or the broader scoring engine.

## Data model changes

**No DB changes.** `Demographics` is an engine-internal interface in `lib/risk/types.ts`, not a database table. Adding the optional field has zero migration cost.

When a future change wires production data, the column will live on `profiles` (vital sign on the patient, not lab data) — flagged as a follow-up, not part of this change.

## Tasks

Two tasks, sequential. Task 1 is the engine extension. Task 2 wires the simulator.

---

### Task 1 — Engine: numeric SBP scoring + fallback

**Files affected:**
- `lib/risk/types.ts` (modify — add `systolic_bp_mmHg?: number` to `Demographics`).
- `lib/risk/cardiovascular.ts` (modify — replace inline binary calc with `computeBpScore` helper).
- `tests/unit/risk/cardiovascular.test.ts` (extend — new cases for numeric scoring + fallback).

**What to build:**

#### Type extension

```ts
// lib/risk/types.ts
export interface Demographics {
  age?: number;
  sex?: Sex;
  height_cm?: number;
  weight_kg?: number;
  systolic_bp_mmHg?: number;  // NEW — vital sign, optional
}
```

Backwards-compatible (optional). The `PatientDemographics` alias at `types.ts:247` (`Required<Pick<...>>`) is unaffected because it picks specific keys.

#### Helper `computeBpScore`

Co-locate in `lib/risk/cardiovascular.ts` (small, single-use, no need for a separate file):

```ts
/**
 * Compute the blood-pressure factor score (0–100, higher = worse).
 *
 * Priority chain:
 *  1. If `systolic_bp_mmHg` is a finite number → graded AHA-aligned bands.
 *  2. Else if `hasHTN` → existing binary score (70, or 50 with antihypertensive).
 *  3. Else → 0 (normal).
 *
 * Antihypertensive medication: when `hasAntihyp` is true AND the score is
 * driven by a numeric value, subtract 15 (clamped to ≥ 0). Reflects that
 * the medicated reading understates underlying pressure. Mirrors the
 * binary-path behaviour where antihyp drops 70 → 50 (also a 20-point
 * reduction; we use 15 in the numeric path so the optimal-medicated case
 * doesn't slide into negative territory).
 */
export function computeBpScore(args: {
  systolic_bp_mmHg?: number;
  hasHTN: boolean;
  hasAntihyp: boolean;
}): { score: number; rawValue: string };
```

**Scoring bands (AHA-aligned):**

| Systolic mmHg | Score | Band |
|---|---:|---|
| < 120 | 0 | Optimal |
| 120–129 | 15 | Elevated |
| 130–139 | 35 | Stage 1 hypertension |
| 140–159 | 60 | Stage 2 hypertension |
| 160–179 | 85 | Severe |
| ≥ 180 | 100 | Crisis |

Implementation: a simple `if/else` ladder is fine. Don't interpolate inside bands — the bands ARE the clinical model.

`rawValue` returned alongside the score:
- Numeric path: `"${sbp} mmHg"` (e.g. `"145 mmHg"`).
- Binary `hypertension` path: `"hypertension"` (preserves existing factor display).
- Else: `"normal"`.

#### Replace the inline binary calc

In `scoreCardiovascular`, replace lines 80–85 (the existing `hasHTN`/`hasAntihyp`/`bpScore` block) with:

```ts
const conditions = med.conditions || [];
const meds = med.medications || [];
const hasHTN = conditions.some((c) => /hypertension|high blood pressure/i.test(c));
const hasAntihyp = meds.some((m) => /lisinopril|amlodipine|losartan|metoprolol|atenolol|ramipril|valsartan|perindopril/i.test(m));
const dem = patient.demographics || {};
const { score: bpScore, rawValue: bpRaw } = computeBpScore({
  systolic_bp_mmHg: dem.systolic_bp_mmHg,
  hasHTN,
  hasAntihyp,
});
factors.push({
  name: "blood_pressure",
  raw_value: bpRaw,
  score: bpScore,
  weight: 0.08,
  modifiable: true,
  optimal_range: "< 120/80 mmHg",
});
```

Behaviour-equivalence check (must hold by construction):
- `(no numeric, no HTN)` → score 0, rawValue `"normal"` (matches existing).
- `(no numeric, HTN, no antihyp)` → score 70, rawValue `"hypertension"` (matches existing).
- `(no numeric, HTN, antihyp)` → score 50, rawValue `"hypertension"` (matches existing).

#### Tests

`tests/unit/risk/cardiovascular.test.ts` — add a `describe("computeBpScore")` block covering ≥ 9 cases:

1. **Fallback — no numeric, no HTN** → score 0, rawValue `"normal"`.
2. **Fallback — no numeric, HTN** → score 70, rawValue `"hypertension"`.
3. **Fallback — no numeric, HTN + antihyp** → score 50, rawValue `"hypertension"`.
4. **Numeric — 110 mmHg** → score 0, rawValue `"110 mmHg"`.
5. **Numeric — 119** → score 0 (band boundary).
6. **Numeric — 120** → score 15 (band boundary).
7. **Numeric — 135** → score 35 (Stage 1).
8. **Numeric — 145** → score 60 (Stage 2).
9. **Numeric — 175** → score 85 (Severe).
10. **Numeric — 195** → score 100 (Crisis).
11. **Numeric + antihyp — 145** → score 45 (60 − 15).
12. **Numeric + antihyp — 110** → score 0 (clamped, not −15).
13. **Numeric overrides binary** — pass both `systolic_bp_mmHg: 110` and `hasHTN: true` → score 0 (numeric wins).
14. (Optional) Non-finite numeric (`NaN`) → falls through to binary path. Use `Number.isFinite()` not a falsy check.

Plus a smoke test at the `scoreCardiovascular` level showing the factor's `raw_value` is `"145 mmHg"` when `demographics.systolic_bp_mmHg = 145`.

**Acceptance criteria:**
- `pnpm build` clean.
- `pnpm test` green; ≥ 12 new test cases under `tests/unit/risk/cardiovascular.test.ts`.
- All existing `cardiovascular.test.ts` cases continue to pass (zero-regression — fallback path preserves prior behaviour).
- `Demographics.systolic_bp_mmHg` is `number | undefined`; type checks across `lib/`.
- No DB changes; no migration.

**Rules to apply:**
- `.claude/rules/nextjs-conventions.md` — pure helper.
- `.claude/rules/ai-agents.md` — engine remains deterministic, single-call.
- `.claude/rules/data-management.md` — no PII; engine-internal interface, not storage.

---

### Task 2 — Simulator: SBP slider

**Files affected:**
- `lib/simulator/types.ts` (modify — extend `SimulatorMetric` union).
- `lib/simulator/apply-overrides.ts` (modify — wire `systolic_bp_mmHg` → `demographics.systolic_bp_mmHg`).
- `app/(app)/simulator/page.tsx` (modify — add SBP slider config + initial value + population default).
- `tests/unit/simulator/apply-overrides.test.ts` (extend — SBP override case).
- `tests/unit/simulator/round-trip.test.ts` (extend — SBP-up → CV-up smoke test).

**What to build:**

#### Extend `SimulatorMetric`

```ts
// lib/simulator/types.ts
export type SimulatorMetric =
  | "ldl"
  | "hba1c"
  | "hsCRP"
  | "weight_kg"
  | "systolic_bp_mmHg";  // NEW
```

#### Extend `applyOverrides`

Add a fifth case to the override mapping in `lib/simulator/apply-overrides.ts`:

```ts
if (overrides.systolic_bp_mmHg !== undefined) {
  next.demographics = {
    ...(next.demographics ?? {}),
    systolic_bp_mmHg: overrides.systolic_bp_mmHg,
  };
}
```

Place alongside the existing `weight_kg` mapping (both target `demographics`). Treat numeric `0` as a valid override (use `!== undefined`, not falsy check) — even though SBP of 0 is physiologically nonsensical, the simulator slider's min is 90 so this is a defensive consistency choice matching the existing helpers.

#### Update `/simulator/page.tsx`

Add SBP to the slider config array:

```ts
const SLIDERS: SliderConfig[] = [
  { metric: "ldl", label: "LDL Cholesterol", unit: "mg/dL", min: 40, max: 250, step: 1, defaultValue: 130, optimalText: "Optimal: < 100 mg/dL" },
  { metric: "hba1c", label: "HbA1c", unit: "%", min: 4.0, max: 12.0, step: 0.1, defaultValue: 5.4, optimalText: "Optimal: < 5.4%" },
  { metric: "hsCRP", label: "hsCRP", unit: "mg/L", min: 0.1, max: 10, step: 0.1, defaultValue: 1.5, optimalText: "Optimal: < 1.0 mg/L" },
  { metric: "systolic_bp_mmHg", label: "Systolic BP", unit: "mmHg", min: 90, max: 200, step: 1, defaultValue: 125, optimalText: "Optimal: < 120 mmHg" },
  { metric: "weight_kg", label: "Weight", unit: "kg", min: 40, max: 200, step: 0.5, defaultValue: 75, optimalText: "Healthy BMI 18.5–24.9 (depends on height)" },
];
```

Order: place SBP between hsCRP and Weight (groups the cardio-metabolic numeric inputs together; weight is a body composition input that affects metabolic more than cardio).

Update `POPULATION_DEFAULTS`:

```ts
const POPULATION_DEFAULTS: Record<SimulatorMetric, number> = {
  ldl: 130,
  hba1c: 5.4,
  hsCRP: 1.5,
  systolic_bp_mmHg: 125,
  weight_kg: 75,
};
```

Update `initialValues` and `isPopulationDefault`:

```ts
const dem = patient.demographics;
const initialValues: Record<SimulatorMetric, number> = {
  ldl: bp?.ldl ?? POPULATION_DEFAULTS.ldl,
  hba1c: bp?.hba1c ?? POPULATION_DEFAULTS.hba1c,
  hsCRP: bp?.hsCRP ?? POPULATION_DEFAULTS.hsCRP,
  systolic_bp_mmHg: dem?.systolic_bp_mmHg ?? POPULATION_DEFAULTS.systolic_bp_mmHg,
  weight_kg: dem?.weight_kg ?? POPULATION_DEFAULTS.weight_kg,
};

const isPopulationDefault: Record<SimulatorMetric, boolean> = {
  ldl: bp?.ldl == null,
  hba1c: bp?.hba1c == null,
  hsCRP: bp?.hsCRP == null,
  systolic_bp_mmHg: dem?.systolic_bp_mmHg == null,
  weight_kg: dem?.weight_kg == null,
};
```

`<SimulatorClient>` requires no changes — it's already metric-agnostic (it iterates the `sliders` prop and indexes `Record<SimulatorMetric, number>`).

#### Tests

`tests/unit/simulator/apply-overrides.test.ts` — extend with one case:
- `{ systolic_bp_mmHg: 145 }` → `result.demographics.systolic_bp_mmHg === 145`; other demographics + biomarkers unchanged.

`tests/unit/simulator/round-trip.test.ts` — extend with one case:
- **SBP up → CV risk up.** Build a baseline patient with `demographics.systolic_bp_mmHg = 110`. Override `{ systolic_bp_mmHg: 175 }`. Run `scoreRisk` on both. Assert `simulated.domains.cardiovascular.score > baseline.domains.cardiovascular.score`.

**Acceptance criteria:**
- `pnpm build` clean.
- `pnpm test` green; 2 new test cases (apply-overrides SBP, round-trip SBP) on top of Task 1's cardiovascular tests.
- `/simulator` renders 5 sliders in the order: LDL, HbA1c, hsCRP, Systolic BP, Weight.
- Members with no numeric SBP see the slider open at 125 mmHg with `(population default)` caption.
- Members with a numeric SBP (will only happen once a future change populates it) see their value as the initial slider position.
- Dragging SBP changes the cardiovascular row's score directionally (up → up) without affecting other domains noticeably.
- Existing simulator tests (12 cases from B6) continue to pass.

**Rules to apply:**
- `.claude/rules/nextjs-conventions.md` — server component for the page; client component imports from `@/lib/risk/scorer` directly (existing addendum from B6).
- `.claude/rules/data-management.md` — no PII; numeric value stored in engine-internal `Demographics` only, not serialised to a DB column this round.
- `.claude/rules/security.md` — no admin client; no new server surface.

---

## Build order

Sequential. Task 1 (engine) must land before Task 2 (simulator) — Task 2's round-trip test imports the engine and would fail without the new scoring band.

## Per-task review gate

Spec compliance + code-quality reviews per task. Both must pass before marking complete.

## Definition of done (whole change)

1. Both tasks ✅ on both reviews.
2. `pnpm build` clean.
3. `pnpm test` green with ≥ 14 new tests across `cardiovascular.test.ts`, `apply-overrides.test.ts`, `round-trip.test.ts`.
4. Manual: visit `/simulator` with seeded data; drag the SBP slider and confirm the cardiovascular and composite risk rows update directionally.
5. Manual: existing four sliders still work as before.
6. CHANGELOG, EXECUTIVE_SUMMARY, QA_REPORT present.

## Risks

- **Numeric path overrides binary clinical assertion.** If a member self-reports `hypertension` in their conditions list AND has a numeric SBP of 110 (e.g. on aggressive medication), the numeric path wins and the score becomes 0 (or 0 after antihyp adjustment). This is the desired behaviour — actual measured pressure is a better signal than a self-report — but worth flagging in the executive summary so the clinical advisor isn't surprised.
- **Antihypertensive adjustment is heuristic.** Subtracting 15 is a rule of thumb. Real clinical practice considers what the underlying pressure WOULD be off-medication, which depends on the medication class and dose. The 15-point adjustment is consistent with the existing binary path's 70→50 (20-point) drop; we use 15 in the numeric path to avoid clamping noise on optimal-medicated readings. Open to clinical feedback.
- **No production data source yet.** Until questionnaire / Janet wires SBP, every member sees the population default. Acceptable for a what-if simulator (B6 already ships in this state for hsCRP). Flagged in the executive summary.
- **Existing fixtures.** `tests/fixtures/risk-profiles.ts` profiles don't set `systolic_bp_mmHg` today. They'll keep using the binary fallback in any test that uses them — zero regression. The new round-trip test builds inline patients with explicit SBP.

## Plan-review addenda (post Phase 4)

The plan reviewer cleared APPROVED WITH NOTES. The following are mandatory for the executor:

1. **Defensive guard against non-positive numeric SBP.** `Number.isFinite(-10)` returns `true`, which would map to band 0 (silently optimal). The slider min is 90 so this can't happen via the UI, but a future data source (Janet, questionnaire, wearable) could write a bad value. Inside `computeBpScore`, treat **`systolic_bp_mmHg <= 0`** as if no numeric were provided — fall through to the binary path. Add a test case asserting `computeBpScore({ systolic_bp_mmHg: 0, hasHTN: true, hasAntihyp: false })` returns score 70 (binary path), not 0 (numeric optimal).

2. **Document the hypotension blind spot.** SBP < 90 mmHg (clinical hypotension) currently scores 0 — same as 110. Real hypotension carries syncope and perfusion risk. The slider min is 90 so members can't reach it via the UI, but the engine will silently treat 75 as optimal if a future writer feeds that value. **Two options:** (a) add a hypotension band (`< 90 mmHg → score 25`) inside `computeBpScore`, or (b) add a clear `// LIMITATION:` comment in the helper noting that hypotension is not modelled and document it in the executive summary as known. Pick (b) for this round — the score band design is a clinical decision worth a separate review, and the slider UI prevents it from being a real user-facing issue. Add the comment + executive-summary line explicitly.

3. **`raw_value` format change.** The factor's `raw_value` string now varies between `"normal"`, `"hypertension"`, and `"145 mmHg"`. Existing consumers (Atlas narrative pipeline, PDF report) read these strings. None will break, but the executive summary must call out that the numeric format is new — so the Atlas prompt cache picks up the change and the clinical advisor isn't surprised.

These are non-blocking; the plan is approved.

## Out of scope (carried forward + reality flags)

- DBP slider.
- Storage column on `profiles` for `systolic_bp_mmHg`.
- Questionnaire field for SBP.
- Janet extraction of BP from uploaded reports (would need a `vitals` block in the prompt — separate change).
- Engine weight tuning for the BP factor.
- Bio-age delta in the simulator (still deferred per B6).

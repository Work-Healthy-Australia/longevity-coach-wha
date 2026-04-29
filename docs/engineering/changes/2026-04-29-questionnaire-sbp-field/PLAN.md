# Plan: Onboarding questionnaire — Recent systolic BP field
**Date:** 2026-04-29
**Phase:** Epic 2 (The Intake) + Epic 8 (Living Record — simulator data source)
**Status:** Draft

## Objective

Add an optional "Recent systolic blood pressure reading" number field to the **basics** step of the onboarding questionnaire so members can self-report their SBP. The value flows through `health_profiles.responses.basics.systolic_bp_mmHg` (JSONB) and `assemblePatientFromDB` lifts it into `Demographics.systolic_bp_mmHg` — automatically personalising the simulator slider's initial value and feeding the deterministic risk engine's numeric BP scoring band (already shipped 2026-04-29). Done = a member who completes onboarding with their reading sees the simulator open at their value with no `(population default)` caption, and Atlas's narrative can reference their actual BP rather than a binary `hypertension` flag.

## Path locked: Path A (JSONB matching existing pattern)

Per Phase 1 + 2 research, the field lives in `health_profiles.responses.basics` JSONB alongside `height_cm` and `weight_kg`. No new migration, no typed column, no PII boundary issue (vital sign on de-identified questionnaire data, not on `profiles`). Future "vitals schema" change is out of scope and tracked separately.

## Scope

**In scope:**
- One new optional `number` field in `lib/questionnaire/questions.ts` `basics` step.
- One-line extension in `lib/risk/assemble.ts` to lift `basics.systolic_bp_mmHg` → `Demographics.systolic_bp_mmHg`.
- Validation bounds via `min`/`max`/`step` on the FieldDef (already enforced server-side by `requiredMissing` in `lib/questionnaire/validation.ts:13–19`).
- Tests for the new schema entry + the assemble-time lift.

**Out of scope:**
- Diastolic BP. Separate change.
- New `biomarkers.vitals` table or typed column on `profiles` — tracked as future "vitals schema" change.
- Janet extracting BP from blood-test reports — separate change in Sprint 2 if prioritised.
- DBP / resting heart rate / other vital signs — separate changes.
- Backfilling SBP for existing members — they'll be prompted to update on their next questionnaire visit (existing save-and-resume covers this).
- Changes to the simulator UI — it already reads `Demographics.systolic_bp_mmHg` and personalises automatically (B6 + 2026-04-29 SBP slider work).
- Changes to the engine's scoring — `computeBpScore` already handles numeric path (shipped 2026-04-29).

## Data model changes

**No DB changes.** The field lives at `health_profiles.responses.basics.systolic_bp_mmHg` (JSONB, integer value, optional). Matches existing `height_cm` and `weight_kg` pattern. Single writer remains the onboarding server action.

If/when a future change adds a typed `vitals` table or column, this field becomes the migration source.

## Tasks

One task, executed by a single subagent. Small enough that splitting adds noise.

---

### Task 1 — Schema + assemble + tests

**Files affected:**
- `lib/questionnaire/questions.ts` (modify — add field to `basics` step).
- `lib/risk/assemble.ts` (modify — lift into `Demographics.systolic_bp_mmHg`).
- `tests/unit/questionnaire/basics-sbp.test.ts` (new — schema + validation).
- `tests/unit/risk/assemble.test.ts` (extend if it covers `Demographics` building; otherwise add a new file `tests/unit/risk/assemble-sbp.test.ts`).

**What to build:**

#### `lib/questionnaire/questions.ts` — add field to `basics` step

Locate the `basics` step's `fields` array. Currently has `date_of_birth`, `sex_at_birth`, `gender_identity`, `height_cm`, `weight_kg`, `ethnicity`. Add the new field **between `weight_kg` and `ethnicity`** (groups it with body measurements):

```ts
{
  id: "systolic_bp_mmHg",
  label: "Recent systolic BP reading",
  type: "number",
  optional: true,
  placeholder: "120",
  suffix: "mmHg",
  min: 70,
  max: 250,
  step: 1,
  helpText:
    "If you have a recent reading from a clinic, home monitor, or pharmacy. Skip if you don't have one. The top number on a BP reading.",
},
```

Notes:
- `optional: true` — never blocks form submission.
- `min: 70 / max: 250 / step: 1` — clinically defensible bounds (below 70 is severe shock, above 250 is rare hypertensive crisis). Whole numbers only. HTML5 attrs + `validation.ts:13–19` server-side gate.
- `helpText` makes it skip-friendly. Members without a recent reading just leave it blank.
- Field id `systolic_bp_mmHg` matches `Demographics.systolic_bp_mmHg` exactly so the assemble lift is one-to-one.

#### `lib/risk/assemble.ts` — lift into Demographics

Find the `demographics` block at line 330–335:

```ts
demographics: {
  age,
  sex,
  height_cm: num(basics.height_cm),
  weight_kg: num(basics.weight_kg),
},
```

Add one line:

```ts
demographics: {
  age,
  sex,
  height_cm: num(basics.height_cm),
  weight_kg: num(basics.weight_kg),
  systolic_bp_mmHg: num(basics.systolic_bp_mmHg),
},
```

The existing `num()` helper (line 233) handles `string | number | undefined → number | undefined`. No NaN / `<= 0` filtering needed at the assemble layer — `computeBpScore` already has `Number.isFinite() && > 0` defence (shipped 2026-04-29).

#### Tests

**`tests/unit/questionnaire/basics-sbp.test.ts`** — schema + validation. ≥4 cases:

1. `onboardingQuestionnaire.steps.find(s => s.id === 'basics')` contains a field with `id === 'systolic_bp_mmHg'`, `type === 'number'`, `optional === true`, `min === 70`, `max === 250`, `step === 1`.
2. `requiredMissing(basicsStep, { systolic_bp_mmHg: 60 })` returns the field label (out of range below).
3. `requiredMissing(basicsStep, { systolic_bp_mmHg: 300 })` returns the field label (out of range above).
4. `requiredMissing(basicsStep, { systolic_bp_mmHg: 120, /* other required fields filled */ })` returns `null` (valid).
5. `requiredMissing(basicsStep, { /* no systolic_bp */ /* other required fields filled */ })` returns `null` (optional — empty is OK).
6. `requiredMissing(basicsStep, { systolic_bp_mmHg: 120.5 })` returns the field label (`step === 1` requires integer).

Use vitest. Import `onboardingQuestionnaire` from `@/lib/questionnaire/questions` and `requiredMissing` from `@/lib/questionnaire/validation`.

**`tests/unit/risk/assemble-sbp.test.ts`** (or extend `tests/unit/risk/assemble.test.ts` if it already covers demographics building). ≥3 cases:

1. `buildPatientInput` with `responses.basics.systolic_bp_mmHg = 145` → `result.demographics.systolic_bp_mmHg === 145`.
2. `buildPatientInput` with no `systolic_bp_mmHg` → `result.demographics.systolic_bp_mmHg === undefined`.
3. `buildPatientInput` with `responses.basics.systolic_bp_mmHg = "145"` (string from JSONB) → `result.demographics.systolic_bp_mmHg === 145` (the `num()` helper coerces).

Build minimal `AssembleSources` fixtures inline; no DB mocking needed.

#### Run

`pnpm build` and `pnpm test`. Both must be green before HANDOFF.

**Acceptance criteria:**
- New field renders in the `basics` step UI without any component changes (schema-driven form picks it up automatically).
- Form pre-fills the value on save-and-resume (existing hydration handles this automatically since the field id matches the response key).
- A member who fills `120` sees the simulator open at 120 with no `(population default)` caption.
- A member who fills `170` and submits the questionnaire sees Atlas's next narrative reference their numeric BP (the `blood_pressure` factor's `raw_value` will be `"170 mmHg"`, not `"hypertension"`).
- Server-side validation blocks `< 70`, `> 250`, non-integer values.
- ≥ 9 new test cases (6 questionnaire + 3 assemble).
- `pnpm build` clean. `pnpm test` green.
- Zero changes to migrations, the simulator UI, the engine's BP scoring, or any other surface.

**Rules to apply:**
- `.claude/rules/data-management.md` — Rule 2 (PII boundary): SBP is not PII; stays in de-identified `responses` JSONB. Rule 3 (typed vs JSONB): JSONB acceptable per Path A reasoning (engine deserialises at read time, not a SQL filter); consistent with existing `height_cm`/`weight_kg`. Rule 4 (single writer): `health_profiles` writer is the onboarding server action; unchanged.
- `.claude/rules/nextjs-conventions.md` — schema-driven form, no UI component changes. Pure helpers in `lib/`.
- `.claude/rules/security.md` — no new admin-client surface; no PII in logs.

---

## Build order

Single task. No internal sequencing required.

## Per-task review gate

Spec compliance + code-quality reviews. Both must pass.

## Definition of done

1. Task ✅ on both reviews.
2. `pnpm build` clean.
3. `pnpm test` green with ≥ 9 new cases.
4. Manual: visit `/onboarding` step "About you", see the new field; enter 120, submit; visit `/simulator`, slider opens at 120 with no `(population default)` caption.
5. CHANGELOG, EXECUTIVE_SUMMARY, QA_REPORT present.

## Plan-review addenda (post Phase 4)

Reviewer cleared APPROVED WITH NOTES. Non-blocking but apply at execution:

1. **Bound mismatch with simulator slider** — Questionnaire bounds are 70–250; simulator slider min is 90. A member who legitimately enters 80 mmHg would saturate the slider at 90. Note this in the CHANGELOG so a future iteration aligns the two (likely by lifting the simulator min to 70 — questionnaire bound is the clinically-correct one).
2. **Inspect `tests/unit/risk/assemble.test.ts` before deciding** — instead of guessing whether it already covers Demographics building, the executor reads the file and chooses extend vs. add new file. The plan's spec applies either way.
3. **`PatientDemographics` alias (`types.ts:248`)** — `Required<Pick<Demographics, "age" | "sex" | "height_cm" | "weight_kg">>` excludes the new `systolic_bp_mmHg`. Confirm at execution that Atlas / report layer reads `Demographics` directly, not `PatientDemographics`. If anything reads via the alias, the new field would be invisible there. Sanity check only — likely a no-op.

## Risks

- **Members may enter a stale reading** (e.g. last year's annual physical). Acceptable — the questionnaire UX includes "Recent" in the label and helpText says "from a clinic, home monitor, or pharmacy" to nudge toward fresh values. If clinical advisors want a tighter spec ("within last 6 months"), that's a label tweak in a follow-up.
- **Self-reported values are noisy** vs. clinic-measured. The numeric path beats the binary path either way (graded scoring beats yes/no). When Janet's BP-from-PDF extraction lands later, it can override the self-report.
- **Members on antihypertensive meds** see the engine's `−15` adjustment applied automatically (existing logic in `computeBpScore`). Their score correctly reflects medicated reading without further UI changes.

## Out of scope (carried forward)

- DBP slider + DBP questionnaire field.
- Resting heart rate questionnaire field.
- `biomarkers.vitals` typed table or column.
- Janet extracting BP from uploaded blood-test reports.
- Backfill prompt for existing members on next dashboard visit.
- Tighter "within last 6 months" temporal validation.

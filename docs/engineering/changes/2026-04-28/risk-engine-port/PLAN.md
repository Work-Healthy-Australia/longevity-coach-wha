# Plan: Risk Engine Port
Date: 2026-04-28
Phase: Phase 2 — Intelligence
Status: Draft

## Objective

Port the deterministic risk scoring engine from the Base44 reference into `lib/risk/`. The engine takes a structured patient object and returns biological age, a longevity score (0–100), a five-domain risk breakdown, a six-month trajectory projection, and the top modifiable risk factors — all in a single synchronous call with no external dependencies and no LLM involvement. Once wired, every member who completes the health questionnaire will have a risk score written to `risk_scores` immediately, enabling Epics 2.1 and 2.2.

## Scope

**In scope:**
- `lib/risk/types.ts` — all TypeScript interfaces (PatientInput, DomainResult, EngineOutput, TrajectoryProjection)
- `lib/risk/adapter.ts` — `buildPatientObject()` maps `health_profiles.responses` + `profiles` row + latest `daily_logs` row into PatientInput
- `lib/risk/engine.ts` — full deterministic scoring: five domain scorers, bio-age calculator, trajectory projector, composite scorer, dynamic weight adjustment
- `app/(app)/onboarding/actions.ts` — call engine inside `submitAssessment()` after `health_profiles` write; persist result to `risk_scores` via admin client
- `tests/unit/risk-engine/` — two parity fixtures (lifestyle-only, full-data)

**Out of scope:**
- Atlas pipeline (risk narrative LLM) — separate Phase 2 task
- Sage pipeline (supplement protocol LLM) — separate Phase 2 task
- PDF report generation — Phase 2, follows pipelines
- UI display of scores (dashboard cards, report screen) — Phase 2, follows engine
- Biomarker parsing from uploaded lab results — data feeds in when uploads are parsed; engine handles missing data gracefully

## Data model changes

No new migrations required. `risk_scores` table is fully provisioned by migration `0005_risk_scores_expand.sql`.

Columns written by the engine:
| Column | Type | Source |
|---|---|---|
| `longevity_score` | numeric(5,2) | engine output |
| `longevity_label` | text | engine output |
| `composite_risk` | numeric(5,2) | engine output |
| `risk_level` | text | engine output |
| `biological_age` | numeric | engine output |
| `cv_risk` | numeric(5,2) | domain score |
| `metabolic_risk` | numeric(5,2) | domain score |
| `neuro_risk` | numeric(5,2) | domain score |
| `cancer_risk` | numeric(5,2) | domain score |
| `msk_risk` | numeric(5,2) | domain score |
| `domain_scores` | jsonb | full domain objects (factors, completeness, top_modifiable_risks) |
| `trajectory_6month` | jsonb | trajectory projection object |
| `top_risk_drivers` | text[] | top 5 modifiable factor names |
| `data_completeness` | numeric(4,3) | average across domains |
| `confidence_level` | text | low / moderate / high / insufficient |
| `next_recommended_tests` | text | stringified recommendation |
| `assessment_date` | date | today at call time |
| `engine_output` | jsonb | full raw engine output (for debugging/audit) |

**Not stored (AGENTS.md Rule 1 — derived on read):**
- `chronological_age` — compute from `profiles.date_of_birth` at call time
- `age_delta` — compute as `chronological_age - biological_age` at read time

**Writer:** service-role admin client only. RLS denies user writes. No other writer.

---

## Tasks

### Task 1 — TypeScript interfaces (`lib/risk/types.ts`)

**Files affected:** `lib/risk/types.ts` (create)

**What to build:**

Define all TypeScript interfaces consumed by the engine and adapter. These must match the `risk_scores` table columns and the engine output schema from `docs/architecture/risk-engine-assessment.md`.

Interfaces required:

```ts
PatientDemographics       // age (computed), sex, height_cm, weight_kg
FamilyHistory             // cardiovascular, cancer, neurodegenerative, diabetes
MedicalHistory            // conditions[], medications[], allergies[], surgeries[]
Lifestyle                 // smoking_status, exercise_minutes_weekly, exercise_type,
                          // sleep_hours, diet_type, stress_level, alcohol_units_weekly
BloodPanel                // apoB, lp_a, ldl, hdl, triglycerides, systolic_bp, diastolic_bp,
                          // hsCRP, homocysteine, hba1c, fasting_glucose, fasting_insulin,
                          // HOMA_IR, uric_acid, ALT, GGT, vitamin_D, omega3_index,
                          // vitamin_B12, NLR, PSA, testosterone, estradiol, DHEA_S, magnesium_RBC
Imaging                   // coronary_calcium_score, carotid_imt_mm, liver_fat_fraction,
                          // visceral_fat_area_cm2, bone_density_tscore, appendicular_lean_mass_index
Genetic                   // APOE_genotype, polygenic_risk_scores, BRCA1, BRCA2, lynch_syndrome
Hormonal                  // testosterone, estradiol, DHEA_S, IGF1
Microbiome                // diversity_score
Biomarkers                // blood_panel?, imaging?, genetic?, hormonal?, microbiome?
WearableData              // resting_hr, hrv_rmssd, vo2max_estimated, avg_deep_sleep_pct,
                          // avg_sleep_duration, avg_daily_steps
PatientInput              // demographics, family_history, medical_history, lifestyle,
                          // biomarkers?, wearable_data?
FactorResult              // name, score (0-100), weight, modifiable, value?
DomainResult              // score, risk_level, factors[], top_modifiable_risks[], data_completeness
EngineOutput              // full output schema — matches risk_scores columns
TrajectoryProjection      // current_longevity_score, projected_longevity_score,
                          // projected_improvement, improvement_factors[]
```

All biomarker sub-objects are fully optional — the engine must handle any subset gracefully.

**Acceptance criteria:**
- [ ] All interfaces exported from `lib/risk/types.ts`
- [ ] `PatientInput` has no required biomarker fields
- [ ] `EngineOutput` fields match the `risk_scores` Insert type columns exactly
- [ ] No `chronological_age` or `age_delta` in the stored output type (derived on read)
- [ ] `pnpm build` passes

**Rules to apply:** `.claude/rules/data-management.md` (Rule 1 — no derived data stored), `.claude/rules/nextjs-conventions.md`

---

### Task 2 — Questionnaire adapter (`lib/risk/adapter.ts`)

**Files affected:** `lib/risk/adapter.ts` (create)

**What to build:**

Export one function: `buildPatientObject(params): PatientInput`

```ts
type AdapterParams = {
  responses: Record<string, Record<string, unknown>>;  // health_profiles.responses JSONB
  dateOfBirth: string;          // profiles.date_of_birth (ISO date string)
  sex: string;                  // from responses.basics.sex
  latestLog?: {                 // most recent daily_logs row (optional)
    stress_level?: string;
    resting_heart_rate?: number;
    hrv?: number;
    steps?: number;
    sleep_hours?: number;
  };
};
```

Key mappings (from `docs/architecture/risk-engine-assessment.md` adapter table):

| Engine field | Source |
|---|---|
| `demographics.age` | `differenceInYears(new Date(), parseISO(dateOfBirth))` — use `date-fns` |
| `demographics.sex` | `responses.basics.sex` |
| `demographics.height_cm` | `responses.basics.height_cm` |
| `demographics.weight_kg` | `responses.basics.weight_kg` |
| `lifestyle.smoking_status` | `responses.lifestyle.smoking` |
| `lifestyle.exercise_minutes_weekly` | `responses.lifestyle.exercise_frequency_per_week × exercise_duration_minutes` |
| `lifestyle.sleep_hours` | `responses.lifestyle.sleep_hours` |
| `lifestyle.diet_type` | `responses.lifestyle.diet_pattern` |
| `lifestyle.stress_level` | `latestLog.stress_level` (map from check-in scale if needed) |
| `wearable_data.resting_hr` | `latestLog.resting_heart_rate` |
| `wearable_data.hrv_rmssd` | `latestLog.hrv` |
| `wearable_data.avg_daily_steps` | `latestLog.steps` |
| `wearable_data.avg_sleep_duration` | `latestLog.sleep_hours` |
| `family_history.*` | Parsed from `responses.family_history` — map each member's conditions to the four sub-objects |

Family history parsing: `responses.family_history` contains entries with `relationship`, `cause_category`, and `conditions[]`. First-degree = `parent` or `sibling`. Map `cause_category` to `cardiovascular | cancer | neurodegenerative | diabetes`.

No biomarker fields are mapped by the adapter — biomarkers come from uploaded lab results via a separate path not yet built. The adapter produces a lifestyle-only PatientInput, which is valid MVP.

**Acceptance criteria:**
- [ ] `buildPatientObject()` returns a valid `PatientInput` from lifestyle-only questionnaire data
- [ ] Age is computed from `dateOfBirth` at call time using `date-fns`, never read from questionnaire
- [ ] Missing wearable/log data produces `undefined` fields (not zero), so the engine skips those factors
- [ ] Family history first-degree / second-degree correctly classified
- [ ] `pnpm build` passes

**Rules to apply:** `.claude/rules/data-management.md` (Rule 1 — age computed, not stored; Rule 2 — DOB from profiles not responses)

---

### Task 3 — Risk engine (`lib/risk/engine.ts`)

**Files affected:** `lib/risk/engine.ts` (create)

**What to build:**

Export one function: `runRiskEngine(patient: PatientInput): EngineOutput`

Implement all scoring logic from `docs/architecture/risk-engine-assessment.md` exactly:

**Five domain scorers** (each returns `DomainResult`):
- `scoreCardiovascular(patient)` — 15 factors, weights from spec
- `scoreMetabolic(patient)` — 12 factors
- `scoreNeurodegenerative(patient)` — 16 factors (note: "neurological" in UI = "neurodegenerative" in engine)
- `scoreOncological(patient)` — 13 factors
- `scoreMusculoskeletal(patient)` — 14 factors

**Scoring conventions for each factor:**
- Each factor returns a score 0–100 (0 = optimal, 100 = worst)
- Domain score = weighted average of present factors only
- If no factors present → score = 50, data_completeness = 0
- `data_completeness` = factors_present / expected_total for that domain

**Dynamic weight adjustment:**
- If any domain scores > 70, boost its weight by 20% (capped at 50%)
- Renormalise all weights to sum to 1.0
- Default weights: CV=0.30, Metabolic=0.25, Neuro=0.15, Onco=0.15, MSK=0.15

**Composite and longevity score:**
```
compositeRisk = Σ (domain.score × domain.weight)
longevityScore = 100 − compositeRisk
Labels: ≥85 Optimal | ≥70 Good | ≥55 Needs Attention | ≥40 Concerning | <40 Critical
```

**Biological age calculator** (`calculateBiologicalAge`):
- Starts from `demographics.age`
- Applies additive/subtractive modifiers for each available biomarker (13 modifiers from spec)
- Clamp final offset to −15 / +20 years
- Lifestyle-only path: use HRV, smoking, exercise, diet, sleep from wearable/lifestyle

**Trajectory projection** (`projectTrajectory`):
- For each modifiable factor with score > 30
- Apply 70% adherence factor to each intervention's max reduction (from spec table)
- Return `improvement_factors[]` with per-factor projections
- Return `projected_longevity_score` and `projected_improvement`

**Score confidence:**
| Overall completeness | Confidence |
|---|---|
| < 0.20 | `insufficient` |
| 0.20–0.40 | `low` |
| 0.40–0.70 | `moderate` |
| > 0.70 | `high` |

**Recommended tests:** surface top 2 domains by lowest `data_completeness`; map to test panel strings from spec.

**Acceptance criteria:**
- [ ] `runRiskEngine()` is exported and accepts `PatientInput`
- [ ] All five domain scorers implemented with correct factor weights
- [ ] Dynamic weight adjustment implemented and weights renormalise to 1.0
- [ ] Biological age clamped to ±15/+20 from chronological age
- [ ] Trajectory projection applies 70% adherence factor
- [ ] Score confidence correctly mapped from completeness thresholds
- [ ] No LLM calls, no network calls, no async — pure synchronous TypeScript
- [ ] Engine handles zero biomarkers (lifestyle-only) without throwing
- [ ] `pnpm build` passes

**Rules to apply:** `.claude/rules/ai-agents.md` (pipeline worker — no LLM inside engine), `.claude/rules/data-management.md` (Rule 1 — no derived fields stored)

---

### Task 4 — Wire engine into `submitAssessment()`

**Files affected:**
- `app/(app)/onboarding/actions.ts` (modify)
- `lib/supabase/admin.ts` (read, do not modify — import only)

**What to build:**

After the `health_profiles` write in `submitAssessment()` and before `triggerPipeline()`, add:

1. Fetch the member's `profiles` row (for `date_of_birth`) using the server client (already available in scope)
2. Fetch the most recent `daily_logs` row for the user (select `stress_level`, `resting_heart_rate`, `hrv`, `steps`, `sleep_hours`) — this may not exist for a new member; handle gracefully
3. Call `buildPatientObject({ responses: cleanedResponses, dateOfBirth, sex, latestLog })`
4. Call `runRiskEngine(patient)`
5. Map `EngineOutput` to `risk_scores` Insert shape
6. Upsert to `risk_scores` using `createAdminClient()` with `onConflict: 'user_uuid'` (one row per user, overwrite on re-submit)

The entire engine block must be wrapped in `try/catch` — if the engine throws for any reason, log the error and continue. The `submitAssessment()` must never fail because the risk engine fails.

`daily_logs` table is in the `biomarkers` schema. Query it as `supabase.schema('biomarkers').from('daily_logs')`.

The `profiles` fetch needs `date_of_birth` which is a typed column on `profiles`.

**Acceptance criteria:**
- [ ] Engine is called synchronously inside `submitAssessment()` after `health_profiles` write
- [ ] `risk_scores` row is upserted (not inserted) — handles re-submission
- [ ] Admin client used for the write (not user client)
- [ ] If engine throws, error is logged but `submitAssessment()` continues to redirect
- [ ] `date_of_birth` comes from `profiles`, not from questionnaire responses
- [ ] `pnpm build` passes
- [ ] No TypeScript errors

**Rules to apply:** `.claude/rules/security.md` (admin client usage), `.claude/rules/data-management.md` (Rule 4 — risk_scores written by engine only), `.claude/rules/nextjs-conventions.md`

---

### Task 5 — Unit tests (`tests/unit/risk-engine/`)

**Files affected:**
- `tests/unit/risk-engine/fixtures/lifestyle-only.ts` (create)
- `tests/unit/risk-engine/fixtures/full-data.ts` (create)
- `tests/unit/risk-engine/engine.test.ts` (create)
- `tests/unit/risk-engine/adapter.test.ts` (create)

**What to build:**

**Fixture 1 — lifestyle-only patient:**
- Demographics: 45yo male, 180cm, 85kg
- No biomarkers, no wearable data
- Lifestyle: never-smoker, 150 min/week exercise (mixed), 7h sleep, Mediterranean diet, moderate stress
- Family history: father had cardiovascular disease (first-degree, onset 65), no cancer/neuro/diabetes
- Expected: `confidence_level = 'insufficient'`, all domain scores near 50, `longevity_label` is not `null`

**Fixture 2 — full-data patient:**
- Demographics: 52yo female, 165cm, 70kg
- Blood panel: ApoB 82 mg/dL, LDL 75, HDL 65, hsCRP 0.8, HbA1c 5.3%, HOMA-IR 1.8
- Wearable: resting_hr 58, hrv_rmssd 45, vo2max 38, avg_deep_sleep 22%, steps 9000
- Lifestyle: never-smoker, 200 min/week, Mediterranean diet, low stress
- Family history: mother had breast cancer (first-degree, onset 58)
- Expected: `confidence_level` is `'moderate'` or `'high'`, `longevity_score >= 60`

**Test cases:**
- Adapter correctly maps questionnaire shape → PatientInput for both fixtures
- Engine returns valid EngineOutput for lifestyle-only (no throw)
- Engine returns valid EngineOutput for full-data
- `longevityScore + compositeRisk === 100` (within floating point)
- Domain weights renormalise to 1.0 after dynamic adjustment
- Biological age is within clamped bounds (chronological ± 15/+20)
- Lifestyle-only produces `confidence_level === 'insufficient'` or `'low'`

**Acceptance criteria:**
- [ ] `pnpm test` passes all new test cases
- [ ] No test imports Supabase or makes network calls
- [ ] Both fixtures defined and exported from their files
- [ ] `pnpm build` passes

**Rules to apply:** `.claude/rules/nextjs-conventions.md` (Vitest, not Jest)

---

## Build order

Tasks must run sequentially — each depends on the previous:

1. **Task 1** (types) → 2 **Task 2** (adapter uses types) → **Task 3** (engine uses types) → **Task 4** (wires adapter + engine) → **Task 5** (tests use all of the above)

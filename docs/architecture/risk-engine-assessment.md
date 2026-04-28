# Risk Engine — Assessment & Port Reference

**Source:** `base44/functions/riskEngine/entry.ts` (Base44 reference repo)  
**Target:** `lib/risk/engine.ts` (new build — Phase 2)  
**Last assessed:** 2026-04-28  
**Status:** Not yet ported. `lib/risk/` is a stub.

---

## What the engine does

The engine is a self-contained deterministic scoring system. It takes a structured patient object and produces a biological age, a longevity score (0–100), a five-domain risk breakdown, a six-month trajectory projection, and a list of the top modifiable risk factors — all in a single synchronous function call with no external dependencies.

It does **not** call an LLM. It does not make network requests. It is pure arithmetic that can be ported directly into `lib/risk/engine.ts` with minimal adaptation.

---

## Input schema

The engine receives a `patient` object with five top-level sections:

### `demographics`
| Field | Type | Notes |
|---|---|---|
| `age` | number | Chronological age in years |
| `sex` | `'male'` \| `'female'` | Used for age-adjusted reference ranges |
| `height_cm` | number | Used for BMI calculation |
| `weight_kg` | number | Used for BMI calculation |

### `family_history`
| Field | Type | Notes |
|---|---|---|
| `cardiovascular` | `{ first_degree, second_degree, age_onset }` | Heart disease, stroke, coronary artery disease |
| `cancer` | `{ first_degree, types[], age_onset }` | Type matters — BRCA/colorectal/pancreatic are high-risk |
| `neurodegenerative` | `{ first_degree, age_onset }` | Alzheimer's, Parkinson's, dementia |
| `diabetes` | `{ first_degree }` | Type 2 diabetes family risk |

Family history is parsed from the questionnaire's `family_members` array. Each member's `cause_category` and `conditions` are mapped to the above structure. First-degree = parent or sibling. Second-degree = grandparent, aunt, uncle.

### `medical_history`
| Field | Type |
|---|---|
| `conditions` | string[] — chronic conditions |
| `medications` | string[] |
| `allergies` | string[] |
| `surgeries` | string[] |

### `lifestyle`
| Field | Type | Source in our questionnaire |
|---|---|---|
| `smoking_status` | `never` \| `former` \| `current` \| `former_under_10y` \| `former_over_10y` | `health_profiles.responses.lifestyle.smoking` |
| `exercise_minutes_weekly` | number | `exercise_frequency_per_week × exercise_duration_minutes` |
| `exercise_type` | string | `exercise_types[0]` |
| `sleep_hours` | number | `sleep_hours` |
| `diet_type` | string | `diet_pattern` |
| `stress_level` | `low` \| `moderate` \| `high` \| `very_high` | Mapped from check-in `stress_level` |
| `alcohol_units_weekly` | number | Not yet in questionnaire — needs adding |

### `biomarkers`
All biomarker sections are optional. The engine scores whatever is present and reports data completeness.

**`blood_panel`** — key fields scored:
| Marker | Optimal range | Domain(s) |
|---|---|---|
| `apoB` | < 75 mg/dL | CVD, bio-age |
| `lp_a` | < 30 nmol/L | CVD |
| `ldl` | < 70 mg/dL | CVD |
| `hdl` | > 60 mg/dL | CVD |
| `triglycerides` | < 100 mg/dL | CVD, Metabolic |
| `systolic_bp` | < 120 mmHg | CVD |
| `diastolic_bp` | < 80 mmHg | CVD |
| `hsCRP` | < 1.0 mg/L | CVD, Neuro, Onco, MSK |
| `homocysteine` | < 10 μmol/L | CVD, Neuro |
| `hba1c` | < 5.1% | Metabolic, bio-age |
| `fasting_glucose` | < 90 mg/dL | Metabolic |
| `fasting_insulin` | < 5 μIU/mL | Metabolic |
| `HOMA_IR` | < 1.5 | Metabolic, bio-age |
| `uric_acid` | < 5.5 (F) / < 6.5 (M) mg/dL | Metabolic |
| `ALT` | < 25 U/L | Metabolic |
| `GGT` | < 20 U/L | Metabolic |
| `vitamin_D` | > 50 ng/mL | Neuro, MSK |
| `omega3_index` | > 8% | CVD, Neuro |
| `vitamin_B12` | > 400 pg/mL | Neuro |
| `NLR` | < 2.0 | Onco |
| `PSA` | < 2.5 ng/mL (male only) | Onco |
| `testosterone` | age-adjusted | MSK |
| `estradiol` | cycle-adjusted | MSK |
| `DHEA_S` | age-adjusted | MSK |
| `magnesium_RBC` | > 5.2 mg/dL | MSK |

**`imaging`:**
| Marker | Domain |
|---|---|
| `coronary_calcium_score` | CVD |
| `carotid_imt_mm` | CVD |
| `liver_fat_fraction` | Metabolic |
| `visceral_fat_area_cm2` | Metabolic, bio-age |
| `bone_density_tscore` | MSK |
| `appendicular_lean_mass_index` | MSK |

**`genetic`:**
| Marker | Domain |
|---|---|
| `APOE_genotype` (`e3/e3`, `e3/e4`, `e4/e4`) | Neuro |
| `polygenic_risk_scores.cardiovascular` | CVD |
| `polygenic_risk_scores.alzheimers` | Neuro |
| `BRCA1`, `BRCA2` (`positive`/`negative`) | Onco |
| `lynch_syndrome` | Onco |

**`hormonal`:**
| Marker | Domain |
|---|---|
| `testosterone`, `estradiol`, `DHEA_S` | MSK |
| `IGF1` | MSK |

**`microbiome`:**
| Marker | Domain |
|---|---|
| `diversity_score` (0–100) | Metabolic |

### `wearable_data`
| Field | Optimal | Domain |
|---|---|---|
| `resting_hr` | < 60 bpm | CVD |
| `hrv_rmssd` | age-adjusted | CVD, Neuro, bio-age |
| `vo2max_estimated` | age/sex-adjusted | CVD |
| `avg_deep_sleep_pct` | > 20% | Neuro |
| `avg_sleep_duration` | 7–9 hrs | Neuro |
| `avg_daily_steps` | > 8,000 | CVD |

---

## Five-domain scoring

Each domain runs an independent scoring function. Every factor returns a score 0–100 (0 = optimal, 100 = worst) with an assigned weight. The domain score is the weighted average of all present factors.

If **no factors** are present, the domain defaults to score = 50, data_completeness = 0.

### Domain 1 — Cardiovascular (default weight: 30%)

Expected total factors: 15

| Factor | Weight | Modifiable |
|---|---|---|
| Age + sex base risk | 0.10 | No |
| ApoB | 0.10 | Yes |
| Lp(a) | 0.08 | No |
| LDL | 0.08 | Yes |
| Blood pressure (systolic/diastolic) | 0.08 | Yes |
| hsCRP | 0.06 | Yes |
| Homocysteine | 0.05 | Yes |
| Resting HR | 0.04 | Yes |
| HRV (RMSSD) | 0.04 | Yes |
| VO2max | 0.04 | Yes |
| Smoking | 0.04 | Yes |
| Coronary calcium score (CAC) | 0.08 | No |
| Carotid IMT | 0.06 | No |
| Genetic PRS cardiovascular | 0.06 | No |
| Family history CVD | 0.09 | No |

### Domain 2 — Metabolic (default weight: 25%)

Expected total factors: 12

| Factor | Weight | Modifiable |
|---|---|---|
| HbA1c | 0.12 | Yes |
| Fasting insulin | 0.10 | Yes |
| HOMA-IR | 0.10 | Yes |
| Fasting glucose | 0.06 | Yes |
| TG/HDL ratio | 0.06 | Yes |
| Uric acid | 0.04 | Yes |
| ALT | 0.04 | Yes |
| GGT | 0.04 | Yes |
| BMI | 0.08 | Yes |
| Liver fat fraction (imaging) | 0.08 | Yes |
| Microbiome diversity | 0.06 | Yes |
| Family history diabetes | 0.06 | No |

### Domain 3 — Neurodegenerative (default weight: 15%)

Expected total factors: 16

| Factor | Weight | Modifiable |
|---|---|---|
| APOE genotype | 0.10 | No |
| Genetic PRS Alzheimer's | 0.08 | No |
| Family history neuro | 0.08 | No |
| Deep sleep % | 0.10 | Yes |
| Sleep duration | 0.06 | Yes |
| hsCRP | 0.06 | Yes |
| Homocysteine | 0.06 | Yes |
| HRV (autonomic) | 0.05 | Yes |
| Omega-3 index | 0.07 | Yes |
| Vitamin D | 0.06 | Yes |
| Vitamin B12 | 0.05 | Yes |
| Stress level | 0.04 | Yes |
| Alcohol | 0.04 | Yes |
| Exercise volume | 0.04 | Yes |
| Aerobic exercise | 0.06 | Yes |
| Cognitive activity | 0.05 | Yes |

### Domain 4 — Oncological (default weight: 15%)

Expected total factors: 13

| Factor | Weight | Modifiable |
|---|---|---|
| Family history cancer (type-weighted) | 0.15 | No |
| BRCA1/2 | 0.12 | No |
| Lynch syndrome | 0.08 | No |
| Age + sex | 0.10 | No |
| Smoking | 0.10 | Yes |
| hsCRP (inflammation) | 0.05 | Yes |
| BMI | 0.05 | Yes |
| Alcohol | 0.05 | Yes |
| Diet quality | 0.05 | Yes |
| Exercise volume | 0.05 | Yes |
| Fasting insulin | 0.04 | Yes |
| Visceral fat | 0.04 | Yes |
| PSA (male only) | 0.06 | No |

### Domain 5 — Musculoskeletal (default weight: 15%)

Expected total factors: 14

| Factor | Weight | Modifiable |
|---|---|---|
| Age + sex base risk | 0.08 | No |
| Bone density T-score | 0.12 | Yes |
| Appendicular lean mass index | 0.10 | Yes |
| Grip strength (estimated) | 0.08 | Yes |
| Testosterone / estradiol | 0.07 | Yes |
| DHEA-S | 0.05 | Yes |
| IGF-1 | 0.05 | Yes |
| Vitamin D | 0.08 | Yes |
| Magnesium RBC | 0.05 | Yes |
| Exercise (resistance training) | 0.08 | Yes |
| Protein intake | 0.06 | Yes |
| Aerobic exercise | 0.04 | Yes |
| hsCRP (inflammation) | 0.02 | Yes |
| Family history MSK | 0.02 | No |

---

## Dynamic weight adjustment

When any domain scores above 70 (high risk), its weight is boosted by 20% (capped at 50%). All weights are then renormalised to sum to 1.0. This means a member with a very high cardiovascular risk will have that domain's contribution to their composite score automatically elevated.

---

## Composite risk and longevity score

```
compositeRisk = Σ (domain.score × domain.weight)
longevityScore = 100 − compositeRisk

Labels:
  ≥ 85  → Optimal
  ≥ 70  → Good
  ≥ 55  → Needs Attention
  ≥ 40  → Concerning
  < 40  → Critical
```

---

## Biological age calculation

Biological age starts from chronological age and applies additive/subtractive modifiers for each available biomarker. Each modifier has a weight and a maximum contribution.

| Modifier factor | Max years added | Weight |
|---|---|---|
| HRV (RMSSD) | ±12 yrs | 0.10 |
| HbA1c | ±10 yrs | 0.09 |
| HOMA-IR | +10 yrs max | 0.08 |
| hsCRP | ±8 yrs | 0.08 |
| ApoB | ±8 yrs | 0.08 |
| VO2max | ±10 yrs | 0.09 |
| Visceral fat area | +8 yrs max | 0.07 |
| Deep sleep % | ±8 yrs | 0.08 |
| Smoking | +15 yrs max | 0.12 |
| Exercise volume | ±6 yrs | 0.07 |
| Diet quality | ±5 yrs | 0.06 |
| Omega-3 index | ±5 yrs | 0.05 |
| Vitamin D | ±4 yrs | 0.04 |

Total offset is clamped to **−15 / +20 years** from chronological age.

**Lifestyle-only path:** When no biomarkers are present, the engine can still compute biological age using HRV (from wearable/check-in), smoking status, exercise volume, diet quality, and sleep duration. The result will have lower confidence but is still valid for an MVP report.

---

## Trajectory projection (6 months)

For each modifiable risk factor currently scored above 30, the engine estimates how much improvement is achievable with full protocol adherence (assumed 70% adherence by default).

**Intervention effect sizes (maximum % reduction in factor score with full adherence):**

| Factor | Max reduction |
|---|---|
| Smoking cessation | 50% |
| ApoB (with intervention) | 35% |
| Vitamin D optimisation | 30% |
| Homocysteine | 25% |
| HOMA-IR | 25% |
| Omega-3 index | 25% |
| Stress reduction | 25% |
| LDL | 25% |
| HRV / autonomic | 20% |
| VO2max | 20% |
| Blood pressure | 20% |
| Liver fat | 20% |
| Visceral fat | 20% |
| Microbiome diversity | 20% |
| Diet quality | 20% |
| Exercise volume | 20% |
| HbA1c | 20% |

The trajectory output includes: `current_longevity_score`, `projected_longevity_score`, `projected_improvement`, and `improvement_factors` with per-factor projections.

---

## Engine output schema

```
{
  longevity_score:         0–100 (higher = better)
  longevity_label:         Optimal | Good | Needs Attention | Concerning | Critical
  composite_risk:          0–100 (lower = better)
  biological_age:          number (years, 1 decimal place)
  chronological_age:       number
  age_delta:               number (chronological − biological; positive = younger)
  risk_level:              very_low | low | moderate | high | very_high
  trajectory_6month: {
    current_longevity_score
    projected_longevity_score
    projected_improvement
    improvement_factors[]
  }
  domains: {
    cardiovascular:    { score, risk_level, factors[], top_modifiable_risks[], data_completeness }
    metabolic:         { ... }
    neurodegenerative: { ... }
    oncological:       { ... }
    musculoskeletal:   { ... }
  }
  domain_weights:          { cardiovascular, metabolic, neurodegenerative, oncological, musculoskeletal }
  top_risks:               top 5 modifiable factors across all domains
  data_completeness:       overall 0–1 fraction of expected factors present
  score_confidence:        low | moderate | high | insufficient
  last_calculated:         ISO timestamp
  next_recommended_tests:  top 2 domain test recommendations (lowest completeness domains)
}
```

This maps directly to the columns in `supabase/migrations/0005_risk_scores_expand.sql`.

---

## Data completeness and confidence

Each domain tracks `data_completeness` as `factors_present / expected_total_factors`. The overall completeness is the average across domains.

| Overall completeness | Score confidence |
|---|---|
| < 0.20 | `insufficient` |
| 0.20 – 0.40 | `low` |
| 0.40 – 0.70 | `moderate` |
| > 0.70 | `high` |

With lifestyle-only questionnaire data and no biomarker uploads, expect completeness of approximately **0.15–0.25** — confidence `low` to `insufficient`. This is the expected MVP state. The report must communicate this clearly to the member.

---

## Recommended tests by domain

When a domain has low completeness, the engine surfaces a specific test recommendation:

| Domain | Recommended test panel |
|---|---|
| Cardiovascular | ApoB, Lp(a), coronary calcium score (CAC), carotid IMT |
| Metabolic | Fasting insulin, HOMA-IR, HbA1c, body composition DEXA |
| Neurodegenerative | APOE genotyping, omega-3 index, sleep study |
| Oncological | Cancer genetic panel (BRCA/Lynch), NLR, inflammatory markers |
| Musculoskeletal | DEXA bone density, testosterone/estradiol, magnesium RBC |

---

## Questionnaire → engine adapter

The Base44 engine uses a `buildPatientObjectFromDB()` function that maps our `health_profiles.responses` JSONB shape to the engine's `patient` input. Key mappings for our build:

| Engine field | Our source |
|---|---|
| `demographics.age` | Computed from `profiles.date_of_birth` at call time |
| `demographics.sex` | `health_profiles.responses.basics.sex` |
| `demographics.height_cm` | `health_profiles.responses.basics.height_cm` |
| `demographics.weight_kg` | `health_profiles.responses.basics.weight_kg` |
| `lifestyle.smoking_status` | `responses.lifestyle.smoking` |
| `lifestyle.exercise_minutes_weekly` | `responses.lifestyle.exercise_frequency_per_week × exercise_duration_minutes` |
| `lifestyle.sleep_hours` | `responses.lifestyle.sleep_hours` |
| `lifestyle.diet_type` | `responses.lifestyle.diet_pattern` |
| `lifestyle.stress_level` | Most recent `daily_logs.stress_level` check-in |
| `wearable_data.resting_hr` | Most recent `daily_logs.resting_heart_rate` |
| `wearable_data.hrv_rmssd` | Most recent `daily_logs.hrv` |
| `wearable_data.avg_daily_steps` | Most recent `daily_logs.steps` |
| `wearable_data.avg_sleep_duration` | Most recent `daily_logs.sleep_hours` |
| `family_history.*` | Parsed from `family_members` table rows |
| `biomarkers.*` | Parsed from `lab_results` rows in `biomarkers` schema |

---

## Port notes for `lib/risk/engine.ts`

1. **Strip the Deno wrapper.** Remove `import { createClientFromRequest } from 'npm:@base44/sdk'` and `Deno.serve(async (req) => { ... })`. Export the scoring functions and `buildPatientObject` adapter directly.

2. **TypeScript interfaces.** Define `PatientInput`, `DomainResult`, `EngineOutput`, and `TrajectoryProjection` interfaces. These match the output schema above and the `risk_scores` table columns from migration `0005`.

3. **Age at call time.** Do not pass `age` directly from the questionnaire — compute it from `profiles.date_of_birth` at the moment the engine is called. Do not store `chronological_age` or `age_delta` in the DB (AGENTS.md rule 1 — derived on read).

4. **Lifestyle-only is valid MVP.** The engine will score correctly with zero biomarkers. Confidence will be `low`/`insufficient` and most domain scores will default to 50. This is expected behaviour — ship the plumbing, biomarkers fill in as patients upload results.

5. **Invocation.** Call the engine from `app/(app)/onboarding/actions.ts` inside `submitAssessment()`, after saving `health_profiles`. Write the result to `risk_scores` using the service-role admin client. The write is the only authorised writer for that table.

6. **No LLM calls inside the engine.** The deterministic engine is separate from the risk narrative (Atlas agent) and the supplement protocol (Sage agent). Port the arithmetic first; the narrative layer comes after.

7. **Fixture tests.** Before shipping, write at least two parity tests: one lifestyle-only patient (no biomarkers) and one full-data patient with known expected outputs sourced from the Base44 reference. Store fixtures in `tests/risk-engine/`.

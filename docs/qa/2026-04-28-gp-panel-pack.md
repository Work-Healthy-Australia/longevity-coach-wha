# GP-Panel Review Pack — Deterministic Risk Engine

**Generated:** 2026-04-28 by `tests/unit/risk/_gp-panel-pack.test.ts`
**Reviewers:** Clinical advisory panel
**Engine version:** Deterministic port of base-44 entry.ts (1,231 lines), see `lib/risk/`.

## Purpose

The deterministic risk engine has been ported from Base44 to TypeScript and is now wired into `submitAssessment()`. Before promoting it to a clinician-channel pilot we'd value a sanity check from the panel.

Below are 10 representative profiles spanning the demographic and risk landscape Janet Cares is likely to encounter. For each, the engine produced biological age, composite risk, five-domain scores, top modifiable risks, and a confidence level reflecting data completeness.

## What we'd like you to check

1. **Bio-age plausibility** — does the gap between biological and chronological age look defensible?
2. **Composite risk classification** — matches your clinical impression?
3. **Top modifiable risks** — correct ordering?
4. **Confidence calibration** — does `high`/`moderate`/`low`/`insufficient` match the data shown?
5. **Next-test recommendations** — sensible?

Please tick the checkboxes inline and add free-text feedback under each sample. Reply by **2026-05-12** if possible.

## Engine method (one-paragraph summary)

Each domain is scored 0–100 by combining ~10–20 weighted factors (e.g., apoB, hsCRP, vitamin D, sleep hours). Composite risk weights the five domains with dynamic up-weighting if any one domain is high. Biological age modifies chronological age by a weighted sum of the strongest mortality predictors (VO₂max, HRV, hsCRP, HbA1c, HOMA-IR, ApoB, visceral fat, deep sleep, sex-specific testosterone). Confidence reflects what fraction of expected factors had data.

---

## S1 · Healthy 35yo male, full biomarker panel, no family history

**De-identified profile:** male, age 35, BMI 23.1. Smoking: never. Exercise: 320 min/wk.

### Engine output

- **Biological age:** 34.7 (0.3 years younger than chronological)
- **Composite risk:** 0 → `very_low`
- **Longevity score:** 100 (Optimal)
- **Confidence:** `moderate`
- **Data completeness:** 67%

### Domain scores

| Domain | Score | Risk | Top driver |
|---|---:|---|---|
| cardiovascular | 0 | `very_low` | — |
| metabolic | 0 | `very_low` | — |
| neurodegenerative | 2 | `very_low` | — |
| oncological | 0 | `very_low` | — |
| musculoskeletal | 0 | `very_low` | — |

### Engine-recommended next tests

DEXA bone density; testosterone/estradiol; magnesium RBC; APOE genotyping; omega-3 index; sleep study

### GP-panel notes

- [ ] Bio-age estimate is clinically defensible.
- [ ] Composite risk classification matches my impression.
- [ ] Top modifiable risks are correctly ordered.
- [ ] Confidence level is appropriately calibrated.
- [ ] Recommended tests are reasonable.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S2 · Same as S1 but with wearable data (HRV, VO₂max, sleep)

**De-identified profile:** male, age 35, BMI 23.1. Smoking: never. Exercise: 320 min/wk.

### Engine output

- **Biological age:** 33.4 (1.6 years younger than chronological)
- **Composite risk:** 0 → `very_low`
- **Longevity score:** 100 (Optimal)
- **Confidence:** `moderate`
- **Data completeness:** 73%

### Domain scores

| Domain | Score | Risk | Top driver |
|---|---:|---|---|
| cardiovascular | 0 | `very_low` | — |
| metabolic | 0 | `very_low` | — |
| neurodegenerative | 2 | `very_low` | — |
| oncological | 0 | `very_low` | — |
| musculoskeletal | 0 | `very_low` | — |

### Engine-recommended next tests

DEXA bone density; testosterone/estradiol; magnesium RBC; Cancer genetic panel (BRCA/Lynch); NLR; inflammatory markers

### GP-panel notes

- [ ] Bio-age estimate is clinically defensible.
- [ ] Composite risk classification matches my impression.
- [ ] Top modifiable risks are correctly ordered.
- [ ] Confidence level is appropriately calibrated.
- [ ] Recommended tests are reasonable.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S3 · 58yo male, current smoker, multiple CV risk factors, family CV history

**De-identified profile:** male, age 58, BMI 28.4. Smoking: current. Exercise: 60 min/wk.
**Conditions:** Hypertension, High cholesterol
**Medications:** lisinopril

### Engine output

- **Biological age:** 65.7 (7.7 years older than chronological)
- **Composite risk:** 65 → `high`
- **Longevity score:** 35 (Critical)
- **Confidence:** `low`
- **Data completeness:** 40%

### Domain scores

| Domain | Score | Risk | Top driver |
|---|---:|---|---|
| cardiovascular | 77 | `very_high` | apoB (85) |
| metabolic | 64 | `high` | tg_hdl_ratio (80) |
| neurodegenerative | 59 | `high` | homocysteine_neuro (80) |
| oncological | 68 | `high` | smoking_onco (90) |
| musculoskeletal | 43 | `moderate` | resistance_training (60) |

### Top modifiable risks (panel-level)

1. **apoB** — score 85 (cardiovascular) · optimal: < 80 mg/dL
2. **smoking_onco** — score 90 (oncological) · optimal: Never
3. **hsCRP** — score 80 (cardiovascular) · optimal: < 1.0 mg/L
4. **homocysteine_neuro** — score 80 (neurodegenerative) · optimal: < 10 μmol/L
5. **hsCRP_onco** — score 80 (oncological) · optimal: < 1.0 mg/L

### Engine-recommended next tests

DEXA bone density; testosterone/estradiol; magnesium RBC; Fasting insulin; HOMA-IR; HbA1c; body composition DEXA

### GP-panel notes

- [ ] Bio-age estimate is clinically defensible.
- [ ] Composite risk classification matches my impression.
- [ ] Top modifiable risks are correctly ordered.
- [ ] Confidence level is appropriately calibrated.
- [ ] Recommended tests are reasonable.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S4 · 48yo woman, pre-diabetes, central adiposity, MASLD

**De-identified profile:** female, age 48, BMI 33.8. Smoking: former. Exercise: 40 min/wk.
**Conditions:** Pre-diabetes

### Engine output

- **Biological age:** 54.5 (6.5 years older than chronological)
- **Composite risk:** 49 → `moderate`
- **Longevity score:** 51 (Concerning)
- **Confidence:** `low`
- **Data completeness:** 39%

### Domain scores

| Domain | Score | Risk | Top driver |
|---|---:|---|---|
| cardiovascular | 38 | `moderate` | triglycerides (75) |
| metabolic | 74 | `very_high` | hba1c (80) |
| neurodegenerative | 34 | `moderate` | aerobic_exercise (55) |
| oncological | 46 | `moderate` | fasting_insulin_onco (65) |
| musculoskeletal | 40 | `moderate` | resistance_training (60) |

### Top modifiable risks (panel-level)

1. **hba1c** — score 80 (metabolic) · optimal: < 5.4%
2. **HOMA_IR** — score 75 (metabolic) · optimal: < 1.5
3. **fasting_insulin** — score 70 (metabolic) · optimal: < 5 μIU/mL
4. **resistance_training** — score 60 (musculoskeletal) · optimal: ≥ 2x resistance training/week
5. **liver_fat_fraction** — score 84 (metabolic) · optimal: < 5%

### Engine-recommended next tests

DEXA bone density; testosterone/estradiol; magnesium RBC; ApoB; Lp(a); coronary calcium score (CAC); carotid IMT

### GP-panel notes

- [ ] Bio-age estimate is clinically defensible.
- [ ] Composite risk classification matches my impression.
- [ ] Top modifiable risks are correctly ordered.
- [ ] Confidence level is appropriately calibrated.
- [ ] Recommended tests are reasonable.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S5 · 42yo woman, sparse data — only demographics + smoking status. New signup case

**De-identified profile:** female, age 42, BMI 24.2. Smoking: never. Exercise: 0 min/wk.

### Engine output

- **Biological age:** 42 (matches chronological)
- **Composite risk:** 10 → `very_low`
- **Longevity score:** 90 (Optimal)
- **Confidence:** `insufficient`
- **Data completeness:** 8%

### Domain scores

| Domain | Score | Risk | Top driver |
|---|---:|---|---|
| cardiovascular | 0 | `very_low` | — |
| metabolic | 0 | `very_low` | — |
| neurodegenerative | 50 | `moderate` | — |
| oncological | 0 | `very_low` | — |
| musculoskeletal | 15 | `very_low` | — |

### Engine-recommended next tests

APOE genotyping; omega-3 index; sleep study; Fasting insulin; HOMA-IR; HbA1c; body composition DEXA

### GP-panel notes

- [ ] Bio-age estimate is clinically defensible.
- [ ] Composite risk classification matches my impression.
- [ ] Top modifiable risks are correctly ordered.
- [ ] Confidence level is appropriately calibrated.
- [ ] Recommended tests are reasonable.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S6 · 64yo postmenopausal woman, low DEXA T-scores, vit-D deficient, statin-naive

**De-identified profile:** female, age 64, BMI 22.1. Smoking: former. Exercise: 90 min/wk.
**Conditions:** Hypothyroidism
**Medications:** levothyroxine

### Engine output

- **Biological age:** 67.5 (3.5 years older than chronological)
- **Composite risk:** 29 → `low`
- **Longevity score:** 71 (Good)
- **Confidence:** `low`
- **Data completeness:** 44%

### Domain scores

| Domain | Score | Risk | Top driver |
|---|---:|---|---|
| cardiovascular | 29 | `low` | apoB (34) |
| metabolic | 25 | `low` | exercise_volume (64) |
| neurodegenerative | 20 | `low` | aerobic_exercise (49) |
| oncological | 16 | `low` | — |
| musculoskeletal | 55 | `moderate` | DEXA_spine (85) |

### Top modifiable risks (panel-level)

1. **DEXA_spine** — score 85 (musculoskeletal) · optimal: > -1.0
2. **DEXA_hip** — score 60 (musculoskeletal) · optimal: > -1.0
3. **resistance_training** — score 60 (musculoskeletal) · optimal: ≥ 2x resistance training/week
4. **estradiol_msk** — score 60 (musculoskeletal) · optimal: Adequate for age/menopausal status
5. **apoB** — score 34 (cardiovascular) · optimal: < 80 mg/dL

### Engine-recommended next tests

Fasting insulin; HOMA-IR; HbA1c; body composition DEXA; APOE genotyping; omega-3 index; sleep study

### GP-panel notes

- [ ] Bio-age estimate is clinically defensible.
- [ ] Composite risk classification matches my impression.
- [ ] Top modifiable risks are correctly ordered.
- [ ] Confidence level is appropriately calibrated.
- [ ] Recommended tests are reasonable.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S7 · 56yo male long-term smoker, family lung+CRC cancer, pro-inflammatory state

**De-identified profile:** male, age 56, BMI 27.4. Smoking: current. Exercise: 0 min/wk.

### Engine output

- **Biological age:** 60.4 (4.4 years older than chronological)
- **Composite risk:** 53 → `moderate`
- **Longevity score:** 47 (Concerning)
- **Confidence:** `insufficient`
- **Data completeness:** 35%

### Domain scores

| Domain | Score | Risk | Top driver |
|---|---:|---|---|
| cardiovascular | 55 | `moderate` | apoB (55) |
| metabolic | 58 | `high` | hba1c (50) |
| neurodegenerative | 45 | `moderate` | hsCRP_neuro (80) |
| oncological | 60 | `high` | smoking_onco (90) |
| musculoskeletal | 43 | `moderate` | resistance_training (60) |

### Top modifiable risks (panel-level)

1. **smoking_onco** — score 90 (oncological) · optimal: Never
2. **apoB** — score 55 (cardiovascular) · optimal: < 80 mg/dL
3. **hsCRP** — score 80 (cardiovascular) · optimal: < 1.0 mg/L
4. **hsCRP_onco** — score 80 (oncological) · optimal: < 1.0 mg/L
5. **hba1c** — score 50 (metabolic) · optimal: < 5.4%

### Engine-recommended next tests

DEXA bone density; testosterone/estradiol; magnesium RBC; Fasting insulin; HOMA-IR; HbA1c; body composition DEXA

### GP-panel notes

- [ ] Bio-age estimate is clinically defensible.
- [ ] Composite risk classification matches my impression.
- [ ] Top modifiable risks are correctly ordered.
- [ ] Confidence level is appropriately calibrated.
- [ ] Recommended tests are reasonable.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S8 · 52yo woman, APOE e4/e3 carrier, family AD, otherwise healthy

**De-identified profile:** female, age 52, BMI 23.0. Smoking: never. Exercise: 180 min/wk.

### Engine output

- **Biological age:** 53.6 (1.6 years older than chronological)
- **Composite risk:** 13 → `very_low`
- **Longevity score:** 87 (Optimal)
- **Confidence:** `low`
- **Data completeness:** 38%

### Domain scores

| Domain | Score | Risk | Top driver |
|---|---:|---|---|
| cardiovascular | 14 | `very_low` | homocysteine (45) |
| metabolic | 7 | `very_low` | exercise_volume (35) |
| neurodegenerative | 32 | `moderate` | homocysteine_neuro (50) |
| oncological | 0 | `very_low` | — |
| musculoskeletal | 14 | `very_low` | — |

### Top modifiable risks (panel-level)

1. **homocysteine_neuro** — score 50 (neurodegenerative) · optimal: < 10 μmol/L
2. **omega3_index** — score 55 (neurodegenerative) · optimal: > 8%
3. **vitamin_B12** — score 46 (neurodegenerative) · optimal: > 600 pg/mL
4. **homocysteine** — score 45 (cardiovascular) · optimal: < 10 μmol/L
5. **ldl** — score 35 (cardiovascular) · optimal: < 100 mg/dL

### Engine-recommended next tests

DEXA bone density; testosterone/estradiol; magnesium RBC; Fasting insulin; HOMA-IR; HbA1c; body composition DEXA

### GP-panel notes

- [ ] Bio-age estimate is clinically defensible.
- [ ] Composite risk classification matches my impression.
- [ ] Top modifiable risks are correctly ordered.
- [ ] Confidence level is appropriately calibrated.
- [ ] Recommended tests are reasonable.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S9 · 38yo male athlete, suspected familial hypercholesterolemia (very high apoB+LDL+Lp(a))

**De-identified profile:** male, age 38, BMI 23.5. Smoking: never. Exercise: 360 min/wk.

### Engine output

- **Biological age:** 37.8 (0.2 years younger than chronological)
- **Composite risk:** 10 → `very_low`
- **Longevity score:** 90 (Optimal)
- **Confidence:** `low`
- **Data completeness:** 44%

### Domain scores

| Domain | Score | Risk | Top driver |
|---|---:|---|---|
| cardiovascular | 34 | `moderate` | apoB (95) |
| metabolic | 1 | `very_low` | — |
| neurodegenerative | 0 | `very_low` | — |
| oncological | 0 | `very_low` | — |
| musculoskeletal | 0 | `very_low` | — |

### Top modifiable risks (panel-level)

1. **apoB** — score 95 (cardiovascular) · optimal: < 80 mg/dL
2. **ldl** — score 80 (cardiovascular) · optimal: < 100 mg/dL

### Engine-recommended next tests

DEXA bone density; testosterone/estradiol; magnesium RBC; Fasting insulin; HOMA-IR; HbA1c; body composition DEXA

### GP-panel notes

- [ ] Bio-age estimate is clinically defensible.
- [ ] Composite risk classification matches my impression.
- [ ] Top modifiable risks are correctly ordered.
- [ ] Confidence level is appropriately calibrated.
- [ ] Recommended tests are reasonable.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S10 · 61yo male T2D on 4 meds, central obesity, MASLD, hypertensive

**De-identified profile:** male, age 61, BMI 34.1. Smoking: former. Exercise: 60 min/wk.
**Conditions:** Type 2 diabetes, Hypertension, High cholesterol
**Medications:** metformin, atorvastatin, lisinopril, empagliflozin

### Engine output

- **Biological age:** 67.3 (6.3 years older than chronological)
- **Composite risk:** 54 → `moderate`
- **Longevity score:** 46 (Concerning)
- **Confidence:** `low`
- **Data completeness:** 47%

### Domain scores

| Domain | Score | Risk | Top driver |
|---|---:|---|---|
| cardiovascular | 51 | `moderate` | apoB (38) |
| metabolic | 76 | `very_high` | hba1c (95) |
| neurodegenerative | 38 | `moderate` | aerobic_exercise (55) |
| oncological | 43 | `moderate` | hsCRP_onco (50) |
| musculoskeletal | 40 | `moderate` | resistance_training (60) |

### Top modifiable risks (panel-level)

1. **hba1c** — score 95 (metabolic) · optimal: < 5.4%
2. **HOMA_IR** — score 75 (metabolic) · optimal: < 1.5
3. **fasting_insulin** — score 70 (metabolic) · optimal: < 5 μIU/mL
4. **resistance_training** — score 60 (musculoskeletal) · optimal: ≥ 2x resistance training/week
5. **fasting_glucose** — score 95 (metabolic) · optimal: < 90 mg/dL

### Engine-recommended next tests

DEXA bone density; testosterone/estradiol; magnesium RBC; APOE genotyping; omega-3 index; sleep study

### GP-panel notes

- [ ] Bio-age estimate is clinically defensible.
- [ ] Composite risk classification matches my impression.
- [ ] Top modifiable risks are correctly ordered.
- [ ] Confidence level is appropriately calibrated.
- [ ] Recommended tests are reasonable.

**Free-text feedback:**

> _Reviewer to fill in._

---

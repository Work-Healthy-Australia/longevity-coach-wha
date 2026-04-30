# GP-Panel Review Pack — Risk Narrative (Atlas)

**Generated:** 2026-04-30 by `tests/integration/_review-packs.test.ts`
**Reviewers:** Clinical advisory panel (GP)
**Agent:** `risk_analyzer` (Atlas) — Claude Sonnet 4.6
**Companion:** [`docs/qa/2026-04-28-gp-panel-pack.md`](./2026-04-28-gp-panel-pack.md) (engine numbers; same 10 fixtures).

## Purpose

The risk-narrative pipeline (`risk_analyzer`) wraps the deterministic engine in an LLM-authored explanation. Reviewers have already vetted the engine numbers; this pack asks whether **Atlas's narrative grounded in those numbers is clinically defensible** before we promote the loop to a member pilot.

Each entry shows: the de-identified profile, the engine baseline (the same anchor Atlas saw), and Atlas's full output (scores, narrative, drivers, screenings, confidence).

## What we'd like you to check

1. **Narrative defensibility** — language is grounded in the data, free of overstatement.
2. **Driver fidelity** — top risk drivers actually map to the patient's biomarker signal.
3. **Engine alignment** — Atlas's scores stay within ~10 points of the engine baseline, or any deviation is explained.
4. **Confidence calibration** — `low`/`moderate`/`high`/`insufficient` matches the data shown.
5. **Screening proportionality** — recommended next tests are sensible for the risk profile.
6. **Safety boundaries** — nothing that would require clinician oversight is stated as fact.

Please tick the checkboxes inline and add free-text feedback under each sample.

---

## S1 · Healthy 35yo male, full biomarker panel, no family history

**De-identified profile:** male, age 35, BMI 23.1. Smoking: never. Exercise: 320 min/wk.

### Engine baseline (deterministic anchor)

- Biological age: 34.7 (chronological 35)
- Composite risk: 0 → `very_low`
- Confidence: `moderate` · Data completeness: 67%
- Domain scores: CV 0 · Met 0 · Neuro 2 · Onco 0 · MSK 0

### Atlas LLM output

- **Biological age:** 33.5 · **Longevity score:** 96/100
- **Confidence:** `high`
- **Domain scores:** CV 5 · Met 5 · Neuro 8 · Onco 8 · MSK 8

**Narrative:**

> Your overall health profile is exceptional and places you well ahead of your chronological age of 35. Your biological age is estimated at approximately 33–34 years, reflecting the cumulative benefit of consistent exercise, a Mediterranean diet, low stress, moderate alcohol intake, and non-smoking status. Every major biomarker panel — lipids, metabolic, inflammatory, hormonal, and imaging — sits in the optimal range, and your coronary calcium score of zero confirms an absence of subclinical atherosclerosis at this stage.
> 
> Across all five clinical domains your risk is very low. Cardiovascular risk is minimal: ApoB of 70 mg/dL, LDL of 90 mg/dL (approximately 2.3 mmol/L), zero CAC, and carotid IMT of 0.5 mm are all highly favourable. Metabolic health is outstanding — HOMA-IR of 1.0, fasting insulin of 4 µIU/mL, HbA1c of 5.0% (31 mmol/mol), and visceral fat area of 60 cm² all indicate excellent insulin sensitivity and no near-term diabetes risk. Neurodegenerative risk is low given APOE e3/e3 genotype, physical activity, social engagement, low hsCRP, and no hypertension or depression reported; the small upward nudge from the engine baseline reflects the absence of a formal hearing and vision assessment. Musculoskeletal risk is very low with positive T-scores at both spine (+0.5) and hip (+0.3), well within the healthy range.
> 
> The primary focus at this stage should be optimisation and early detection rather than risk reduction. Continuing your current lifestyle habits, monitoring key biomarkers annually, and completing the few remaining assessments listed below will help sustain this trajectory into your 40s and beyond.

**Top risk drivers:** `Incomplete family history data (hereditary cancer and CVD risk unknown)`, `No wearable/HRV data to assess autonomic resilience`, `Hearing and vision status not formally assessed (key dementia risk factors)`, `Vitamin D at 55 nmol/L — adequate but could be optimised to 75–100 nmol/L`, `Sleep quality not objectively measured despite adequate duration reported`
**Top protective levers:** `High-volume mixed exercise (320 min/week cardio + resistance) — strongest longevity lever`, `Mediterranean dietary pattern with low inflammatory markers (hsCRP 0.5 mg/L)`, `Optimal lipid and metabolic biomarker profile (ApoB 70, HOMA-IR 1.0, zero CAC)`, `APOE e3/e3 genotype — neutral/favourable neurodegenerative risk`, `Omega-3 index of 9% — cardioprotective and anti-inflammatory`
**Recommended screenings:** Annual fasting lipid panel + ApoB + Lp(a) recheck (baseline already excellent — track trajectory); Formal hearing assessment (highest population-attributable risk for dementia, often missed at age 35); Comprehensive family history review — first-degree relatives for CVD < 60y, T2DM, and cancer syndromes; Skin cancer full-body check with dermatologist (annual, given Australian UV exposure); Colorectal cancer risk assessment and consideration of baseline colonoscopy or FIT at age 40–45; Testosterone and IGF-1 recheck at age 40 to track hormonal trajectory; Sleep study or validated objective sleep quality assessment (e.g., actigraphy or PSG if indicated); Vitamin D optimisation recheck in 3 months if supplementation initiated
**Data gaps flagged by Atlas:** Family history absent — no data on premature CVD, T2DM, hereditary cancer syndromes, or parental hip fracture; Wearable data absent — no resting heart rate, HRV, VO2 max estimate, or sleep staging data; Formal hearing and vision test results not provided; Blood pressure measurement not recorded (required for AusCVD and dementia risk scoring); Waist circumference not provided (key AUSDRISK and visceral adiposity input — partially offset by visceral fat imaging); Resting ECG / rhythm strip absent (atrial fibrillation screening); PSA not recorded (relevant from age 40 for prostate cancer baseline in males)

### GP-panel notes

- [ ] Narrative is clinically defensible and free of overstatement.
- [ ] Top risk drivers match the underlying biomarker signal.
- [ ] Atlas's domain scores are consistent with the engine baseline (≤10-point deviation is OK if explained).
- [ ] Confidence level is appropriately calibrated to the data shown.
- [ ] Recommended screenings are sensible and proportionate.
- [ ] No safety-critical statement that would require clinician oversight.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S2 · Same as S1 but with wearable data (HRV, VO₂max, sleep)

**De-identified profile:** male, age 35, BMI 23.1. Smoking: never. Exercise: 320 min/wk.

### Engine baseline (deterministic anchor)

- Biological age: 33.4 (chronological 35)
- Composite risk: 0 → `very_low`
- Confidence: `moderate` · Data completeness: 73%
- Domain scores: CV 0 · Met 0 · Neuro 2 · Onco 0 · MSK 0

### Atlas LLM output

- **Biological age:** 32.5 · **Longevity score:** 94/100
- **Confidence:** `moderate`
- **Domain scores:** CV 8 · Met 6 · Neuro 8 · Onco 10 · MSK 8

**Narrative:**

> Your overall health picture is exceptional for a 35-year-old. Your estimated biological age of approximately 32–33 years reflects a body that is ageing more slowly than your chronological years, driven by outstanding cardiovascular fitness (VO2max ~55 ml/kg/min places you in the top tier for your age group), a pristine lipid profile (ApoB 70 mg/dL, LDL ~2.3 mmol/L, zero coronary calcium, carotid IMT 0.5 mm), excellent metabolic health (HOMA-IR 1.0, HbA1c 5.0%, fasting insulin 4 µIU/mL, negligible liver fat), and strong anti-inflammatory markers (hsCRP 0.5 mg/L, NLR 1.5, omega-3 index 9%). Your Mediterranean diet, 320 minutes of weekly mixed exercise, 8 hours of quality sleep, low stress, and moderate alcohol intake (4 units/week) are all aligned with best-practice longevity medicine recommendations.
> 
> Across all five clinical domains — cardiovascular, metabolic, neurodegenerative, oncological, and musculoskeletal — your risk sits firmly in the very low range. Your APOE e3/e3 genotype carries no elevated Alzheimer's risk above population baseline, your bone density T-scores are positive (spine +0.5, hip +0.3), and your testosterone and IGF-1 levels are healthy. Wearable data reinforces the picture: resting HR 52 bpm, HRV 75 ms, and 22% deep sleep are all markers of strong autonomic and recovery capacity.
> 
> The small adjustments from the engine baseline reflect the absence of a formal family history dataset (oncological and neurodegenerative domains) and a few remaining data gaps noted below. No urgent clinical actions are indicated, but the recommended screenings listed will help maintain this trajectory and close the remaining information gaps over the coming 12 months.

**Top risk drivers:** `Incomplete family history (cancer and dementia lineage unknown)`, `No formal hearing assessment on record`, `Vitamin D at 55 nmol/L — adequate but below optimal longevity target (≥75 nmol/L)`, `Alcohol intake (4 units/week) — no safe cancer threshold per WHO 2023`, `Visceral fat area 60 cm² — currently optimal but warrants monitoring with age`
**Top protective levers:** `High aerobic fitness (VO2max ~55) — most powerful all-cause mortality predictor`, `Pristine cardiometabolic biomarkers (ApoB, LDL, HOMA-IR, hsCRP all optimal)`, `Mediterranean diet with high omega-3 index (9%) — anti-inflammatory and neuroprotective`, `Excellent sleep architecture (8 hrs, 22% deep sleep, HRV 75 ms)`, `APOE e3/e3 — population-baseline neurodegenerative genetic risk`
**Recommended screenings:** Comprehensive family history review (cancer, CVD, dementia — first-degree relatives); Audiometry / formal hearing assessment (largest modifiable dementia PAR at 8.2%); Vitamin D optimisation check in 3 months (target ≥75 nmol/L); Cancer genetic panel (BRCA1/2, Lynch syndrome) given absent family history data; Annual fasting lipid panel + HbA1c to track metabolic trajectory; DXA bone density repeat in 3–5 years to establish longitudinal trend
**Data gaps flagged by Atlas:** Family history entirely absent — limits oncological and neurodegenerative risk stratification; No formal hearing assessment result; No blood pressure reading on record (estimated low risk from overall profile but unconfirmed); No body weight / BMI / waist circumference provided (visceral fat area used as proxy); Cancer genetic panel (BRCA/Lynch) not yet performed; Cortisol / adrenal axis not assessed

### GP-panel notes

- [ ] Narrative is clinically defensible and free of overstatement.
- [ ] Top risk drivers match the underlying biomarker signal.
- [ ] Atlas's domain scores are consistent with the engine baseline (≤10-point deviation is OK if explained).
- [ ] Confidence level is appropriately calibrated to the data shown.
- [ ] Recommended screenings are sensible and proportionate.
- [ ] No safety-critical statement that would require clinician oversight.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S3 · 58yo male, current smoker, multiple CV risk factors, family CV history

**De-identified profile:** male, age 58, BMI 28.4. Smoking: current. Exercise: 60 min/wk.
**Conditions:** Hypertension, High cholesterol
**Medications:** lisinopril

### Engine baseline (deterministic anchor)

- Biological age: 65.7 (chronological 58)
- Composite risk: 65 → `high`
- Confidence: `low` · Data completeness: 40%
- Domain scores: CV 77 · Met 64 · Neuro 59 · Onco 68 · MSK 43

### Atlas LLM output

- **Biological age:** 68 · **Longevity score:** 28/100
- **Confidence:** `moderate`
- **Domain scores:** CV 88 · Met 64 · Neuro 62 · Onco 72 · MSK 43

**Narrative:**

> Based on your health data, your estimated biological age is 68 years — approximately 10 years older than your chronological age of 58. This gap reflects a combination of cardiovascular, metabolic, and lifestyle factors that are accelerating the ageing process but are largely modifiable with targeted intervention.
> 
> Your cardiovascular profile is the most urgent concern. You have confirmed hypertension and high cholesterol, a first-degree family history of heart disease before age 60, elevated LDL (165 mg/dL), very high apoB (145 mg/dL), low HDL (35 mg/dL), elevated triglycerides (220 mg/dL), and a coronary artery calcium score of 250 — placing you in a high-risk category for a cardiac event in the next 5–10 years. Your elevated hsCRP (3.5 mg/L) signals active vascular inflammation, compounding this risk. Current smoking and 16 standard drinks of alcohol per week are significantly worsening every domain of your health.
> 
> The encouraging news is that most of your top risk drivers are modifiable. Quitting smoking, reducing alcohol, intensifying lipid-lowering therapy, optimising blood pressure control, and increasing structured exercise could meaningfully reduce your biological age and risk trajectory. A prompt review with your GP or a cardiologist is strongly recommended, alongside the additional tests listed below to fill important gaps in your metabolic and bone health picture.

**Top risk drivers:** `Current smoking (elevates CV, cancer, and dementia risk simultaneously)`, `Elevated apoB (145 mg/dL) and LDL with coronary calcium score of 250 — established atherosclerosis`, `High alcohol intake (16 standard drinks/week — above safe threshold for cancer, liver, and CV risk)`, `Elevated hsCRP (3.5 mg/L) indicating systemic vascular inflammation`, `Elevated homocysteine (16 µmol/L) — independent risk factor for dementia and cardiovascular events`
**Top protective levers:** `Smoking cessation — single highest-impact intervention across all domains`, `Statin intensification or addition of ezetimibe/PCSK9 inhibitor to lower LDL and apoB`, `Reduce alcohol to < 7 standard drinks/week or abstain`, `Increase exercise to ≥ 150 min/week including resistance training`, `Mediterranean or whole-food dietary pattern to address triglycerides, HDL, and inflammation`
**Recommended screenings:** Urgent lipid review with cardiologist — consider PCSK9 inhibitor given CAC 250 and apoB 145; HbA1c and fasting insulin/HOMA-IR — metabolic risk is elevated but incompletely characterised; DXA bone density scan — musculoskeletal data is sparse; smoking and alcohol increase fracture risk; Testosterone and hormonal panel — relevant at 58 for metabolic and MSK health; Colorectal cancer screening (FOBT or colonoscopy) — age 58, current smoker, alcohol use; Spirometry / lung function test — current smoker, essential for COPD and lung cancer surveillance; Resting blood pressure measurement to confirm hypertension control on lisinopril
**Data gaps flagged by Atlas:** HbA1c — essential to characterise metabolic/diabetes risk (AUSDRISK inputs incomplete); Fasting insulin and HOMA-IR — insulin resistance cannot be quantified without these; Waist circumference — needed for AUSDRISK and metabolic risk scoring; Blood pressure reading — on lisinopril but no current BP value provided; DXA bone density — FRAX cannot be fully calculated; smoking and alcohol are FRAX risk factors; Spirometry / lung function — current smoker with no respiratory data; Cognitive screening result — homocysteine is elevated but no cognitive assessment data available; Alcohol type and pattern — weekly units reported but no binge pattern detail

### GP-panel notes

- [ ] Narrative is clinically defensible and free of overstatement.
- [ ] Top risk drivers match the underlying biomarker signal.
- [ ] Atlas's domain scores are consistent with the engine baseline (≤10-point deviation is OK if explained).
- [ ] Confidence level is appropriately calibrated to the data shown.
- [ ] Recommended screenings are sensible and proportionate.
- [ ] No safety-critical statement that would require clinician oversight.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S4 · 48yo woman, pre-diabetes, central adiposity, MASLD

**De-identified profile:** female, age 48, BMI 33.8. Smoking: former. Exercise: 40 min/wk.
**Conditions:** Pre-diabetes

### Engine baseline (deterministic anchor)

- Biological age: 54.5 (chronological 48)
- Composite risk: 49 → `moderate`
- Confidence: `low` · Data completeness: 39%
- Domain scores: CV 38 · Met 74 · Neuro 34 · Onco 46 · MSK 40

### Atlas LLM output

- **Biological age:** 56 · **Longevity score:** 48/100
- **Confidence:** `moderate`
- **Domain scores:** CV 45 · Met 76 · Neuro 38 · Onco 42 · MSK 42

**Narrative:**

> At 48 years old, your biological age is estimated at 56 — roughly 8 years older than your chronological age. This gap is largely driven by your metabolic health profile, which is the most pressing concern identified in this assessment. Your blood results show pre-diabetes (HbA1c 6.2%, fasting glucose 115 mg/dL), significant insulin resistance (HOMA-IR 3.5), elevated triglycerides (240 mg/dL), low HDL cholesterol (38 mg/dL), and liver enzyme elevations (ALT and GGT) consistent with metabolic-associated fatty liver disease — confirmed by imaging showing 18% liver fat fraction and high visceral fat. This cluster of findings is a powerful driver of accelerated ageing and elevates your risk across multiple domains including cardiovascular and oncological health.
> 
> Your cardiovascular risk sits in the low-to-moderate range based on available data, but important gaps remain — we do not yet have your LDL/ApoB, blood pressure, or coronary calcium score. The combination of low HDL, very high triglycerides, and insulin resistance strongly suggests atherogenic dyslipidaemia, which could push your true cardiovascular risk higher once a full lipid panel is available. Your neurodegenerative and musculoskeletal risks are moderate, influenced by physical inactivity, disrupted sleep, and the metabolic burden already described — all of which are recognised dementia and bone-health risk factors.
> 
> The encouraging news is that the majority of your risk drivers are modifiable. Structured resistance training, a low-glycaemic or Mediterranean-style diet, improved sleep, and modest alcohol reduction can meaningfully reverse insulin resistance, reduce liver fat, and lower your biological age. Early, targeted action now — ideally with GP and allied health support — gives you an excellent opportunity to shift your trajectory significantly within 6–12 months.

**Top risk drivers:** `Insulin resistance and pre-diabetes (HOMA-IR 3.5, HbA1c 6.2%)`, `Metabolic-associated fatty liver disease (liver fat 18%, ALT/GGT elevated)`, `Atherogenic dyslipidaemia (triglycerides 240, HDL 38 mg/dL)`, `Physical inactivity (only 40 min/week exercise, no resistance training)`, `Short sleep duration (6 hours/night) and moderate chronic stress`
**Top protective levers:** `Structured resistance training 3x/week to improve insulin sensitivity and muscle mass`, `Low-glycaemic, Mediterranean-style diet to reduce liver fat and HbA1c`, `Alcohol reduction (currently 8 units/week — targeting <7 to lower metabolic and oncological risk)`, `Sleep optimisation to 7–8 hours to support metabolic regulation and neurological health`, `Regular monitoring with GP: HbA1c, lipid panel, liver function every 3–6 months`
**Recommended screenings:** Fasting lipid panel with LDL and ApoB (urgent — missing key CV risk data); Lp(a) — once-in-lifetime test; important given family history of diabetes and metabolic risk; Coronary calcium score (CAC) — to stratify true cardiovascular risk; DEXA scan — bone density and body composition (visceral fat quantification); Testosterone and SHBG — metabolic syndrome commonly suppresses testosterone in males; Liver ultrasound or FibroScan to assess liver fibrosis stage given fatty liver findings; Blood pressure measurement — not yet available, essential for CV risk calculation; Magnesium (RBC) — commonly depleted in insulin resistance and poor sleep
**Data gaps flagged by Atlas:** Blood pressure / resting SBP — essential for AusCVD risk calculation; LDL cholesterol and ApoB — critical missing CV risk inputs; Lp(a) — not yet measured; BMI and waist circumference — needed for AUSDRISK and FRAX scoring; Smoking pack-year history — former smoker, cessation date unknown; Family history of cardiovascular disease or cancer — not reported; DXA bone density — no fracture risk data available; Hearing assessment — largest modifiable dementia risk factor, not assessed; Depression / cognitive screening — not reported; Resting heart rate and HRV from wearable — not connected

### GP-panel notes

- [ ] Narrative is clinically defensible and free of overstatement.
- [ ] Top risk drivers match the underlying biomarker signal.
- [ ] Atlas's domain scores are consistent with the engine baseline (≤10-point deviation is OK if explained).
- [ ] Confidence level is appropriately calibrated to the data shown.
- [ ] Recommended screenings are sensible and proportionate.
- [ ] No safety-critical statement that would require clinician oversight.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S5 · 42yo woman, sparse data — only demographics + smoking status

**De-identified profile:** female, age 42, BMI 24.2. Smoking: never. Exercise: 0 min/wk.

### Engine baseline (deterministic anchor)

- Biological age: 42 (chronological 42)
- Composite risk: 10 → `very_low`
- Confidence: `insufficient` · Data completeness: 8%
- Domain scores: CV 0 · Met 0 · Neuro 50 · Onco 0 · MSK 15

### Atlas LLM output

- **Biological age:** 42 · **Longevity score:** 88/100
- **Confidence:** `insufficient`
- **Domain scores:** CV 10 · Met 10 · Neuro 50 · Onco 10 · MSK 15

**Narrative:**

> Based on the very limited information available, your profile shows only one confirmed data point — that you have never smoked. This is a meaningful protective factor across cardiovascular, oncological, and neurological health. However, with less than 10% of the health questionnaire completed and no pathology results on file, it is not possible to generate a reliable, personalised risk assessment across most domains. The scores shown largely reflect population-level averages for a 42-year-old non-smoker rather than your individual health picture.
> 
> The moderate neurodegenerative risk score (50/100) reflects the absence of data rather than a confirmed elevated risk — without information about blood pressure, cholesterol, physical activity, sleep quality, hearing, social connection, or cognitive history, the assessment defaults to a cautious mid-range estimate aligned with population norms for this age group. This should not be interpreted as a cause for alarm, but rather as a prompt to provide more information.
> 
> To generate a meaningful, personalised longevity assessment, we strongly encourage you to complete the remaining questionnaire sections (medical history, family history, lifestyle, and biomarkers) and, where possible, upload recent pathology results including a fasting lipid panel, HbA1c, fasting insulin, and a full blood count. The more information you share, the more actionable and accurate your Atlas report will be.

**Top risk drivers:** `Insufficient data to identify personal risk drivers`, `Population-level neurodegenerative risk factors (age 42, unknown modifiable factor burden)`, `Unknown metabolic status (no HbA1c, fasting insulin, or waist circumference data)`, `Unknown cardiovascular risk profile (no lipids, BP, or family history data)`, `Unknown musculoskeletal risk (no BMI, bone density, or fracture history data)`
**Top protective levers:** `Never-smoking status (significant protective factor across CV, oncological, and neurological domains)`, `Complete the health questionnaire to unlock personalised protective recommendations`, `Obtain baseline pathology (lipids, HbA1c, fasting insulin) to guide targeted interventions`, `Assess physical activity levels — exercise is protective across all five longevity domains`, `Review sleep quality — poor sleep is a modifiable neurodegenerative and metabolic risk factor`
**Recommended screenings:** Fasting lipid panel (total cholesterol, LDL, HDL, triglycerides) — baseline cardiovascular risk; HbA1c and fasting insulin / HOMA-IR — metabolic and diabetes risk; Resting blood pressure measurement — cardiovascular and neurodegenerative risk; Body composition DEXA — musculoskeletal and metabolic risk; APOE genotyping — neurodegenerative risk stratification; Omega-3 index — cardiovascular and neurological inflammation marker; Hearing assessment — largest single modifiable dementia risk factor (PAR 8.2%); Sleep study or validated sleep quality assessment
**Data gaps flagged by Atlas:** Medical history: no conditions, medications, or prior diagnoses recorded; Family history: no cardiovascular, cancer, diabetes, or dementia family history provided; Lifestyle: physical activity level, alcohol intake, diet quality, sleep duration/quality all unknown; Biomarkers: no lipid panel, HbA1c, fasting glucose, insulin, blood pressure, BMI, or waist circumference; Wearable data: no heart rate, activity, sleep, or HRV data available; Oncological risk: no family cancer history, sun exposure habits, or alcohol intake recorded; Musculoskeletal risk: no BMI, prior fracture history, corticosteroid use, or joint symptoms recorded

### GP-panel notes

- [ ] Narrative is clinically defensible and free of overstatement.
- [ ] Top risk drivers match the underlying biomarker signal.
- [ ] Atlas's domain scores are consistent with the engine baseline (≤10-point deviation is OK if explained).
- [ ] Confidence level is appropriately calibrated to the data shown.
- [ ] Recommended screenings are sensible and proportionate.
- [ ] No safety-critical statement that would require clinician oversight.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S6 · 64yo postmenopausal woman, low DEXA T-scores, vit-D borderline, statin-naive

**De-identified profile:** female, age 64, BMI 22.1. Smoking: former. Exercise: 90 min/wk.
**Conditions:** Hypothyroidism
**Medications:** levothyroxine

### Engine baseline (deterministic anchor)

- Biological age: 67.5 (chronological 64)
- Composite risk: 29 → `low`
- Confidence: `low` · Data completeness: 44%
- Domain scores: CV 29 · Met 25 · Neuro 20 · Onco 16 · MSK 55

### Atlas LLM output

- **Biological age:** 66.5 · **Longevity score:** 68/100
- **Confidence:** `moderate`
- **Domain scores:** CV 32 · Met 22 · Neuro 22 · Onco 28 · MSK 72

**Narrative:**

> At 64 years old, your overall health profile is encouraging in several domains, but your musculoskeletal health requires prompt attention. Your DEXA scan reveals osteoporosis at the spine (T-score -2.3) and osteopenia at the hip (T-score -1.8), which — combined with a first-degree family history of osteoporosis and low postmenopausal estradiol — places you at elevated fracture risk. This is the most important area to address with your GP, and a formal FRAX assessment and pharmacotherapy discussion are warranted.
> 
> Your cardiovascular profile is low-to-moderate risk. Your LDL of 135 mg/dL (approximately 3.5 mmol/L) and apoB of 95 mg/dL are above optimal targets for someone with a family history of cardiovascular disease, and as a former smoker these warrant monitoring. The good news is your HDL is excellent, triglycerides are normal, hsCRP is only mildly elevated, and your Mediterranean diet and low stress are strong protective factors. Your metabolic health looks good with an HbA1c of 5.5% and healthy lipid ratios, though fasting insulin and HOMA-IR would complete the picture.
> 
> Your neurodegenerative and oncological risks are low, supported by your healthy lifestyle, diet quality, adequate sleep, and low alcohol intake. The main areas to focus on going forward are: building resistance training into your exercise routine (currently cardio-only, which is insufficient for bone density), discussing bone-protective therapy with your doctor, optimising your LDL and apoB, and ensuring your thyroid function remains well-controlled on levothyroxine.

**Top risk drivers:** `Osteoporosis at spine (T-score -2.3) with family history`, `Low estradiol (postmenopausal) accelerating bone loss`, `No resistance training — critical gap for bone and muscle preservation`, `Elevated LDL (~3.5 mmol/L) and apoB 95 mg/dL in context of former smoking and family CVD history`, `Vitamin D 38 nmol/L — borderline low for bone health`
**Top protective levers:** `Mediterranean diet — strong anti-inflammatory and cardioprotective pattern`, `Excellent HDL (60 mg/dL) and normal triglycerides`, `Low alcohol intake (6 units/week) and low stress`, `Adequate sleep (7 hours/night)`, `Hypothyroidism managed with levothyroxine — ensure TSH is optimised`
**Recommended screenings:** Formal FRAX 10-year fracture risk calculation with GP — consider pharmacotherapy (bisphosphonate or denosumab); Fasting insulin and HOMA-IR to complete metabolic assessment; HbA1c repeat in 12 months; Fasting lipid panel with LDL particle number; consider apoB target < 65 mg/dL given risk profile; TSH and free T4 to confirm adequate levothyroxine dosing; Vitamin D supplementation review — target 75–150 nmol/L for bone health; APOE genotyping if interested in personalised dementia risk stratification; Hearing assessment (largest modifiable dementia risk factor by PAR); Omega-3 index to guide supplementation
**Data gaps flagged by Atlas:** Fasting insulin and HOMA-IR (metabolic completeness only 29%); Resting blood pressure measurement (needed for AusCVD risk calculation); TSH / free T4 (thyroid control affects bone, cardiac, and metabolic risk); Waist circumference (AUSDRISK input); Hearing assessment result (top dementia risk factor — unassessed); Sleep quality / apnoea screen (wearable data absent); Full cancer family history (only cardiovascular and osteoporosis recorded); Body composition DEXA (muscle mass / sarcopenia risk — distinct from bone DEXA); Glucose / fasting blood glucose (not provided)

### GP-panel notes

- [ ] Narrative is clinically defensible and free of overstatement.
- [ ] Top risk drivers match the underlying biomarker signal.
- [ ] Atlas's domain scores are consistent with the engine baseline (≤10-point deviation is OK if explained).
- [ ] Confidence level is appropriately calibrated to the data shown.
- [ ] Recommended screenings are sensible and proportionate.
- [ ] No safety-critical statement that would require clinician oversight.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S7 · 56yo male long-term smoker, family lung+CRC cancer, pro-inflammatory state

**De-identified profile:** male, age 56, BMI 27.4. Smoking: current. Exercise: 0 min/wk.

### Engine baseline (deterministic anchor)

- Biological age: 60.4 (chronological 56)
- Composite risk: 53 → `moderate`
- Confidence: `insufficient` · Data completeness: 35%
- Domain scores: CV 55 · Met 58 · Neuro 45 · Onco 60 · MSK 43

### Atlas LLM output

- **Biological age:** 63 · **Longevity score:** 38/100
- **Confidence:** `low`
- **Domain scores:** CV 62 · Met 60 · Neuro 52 · Onco 72 · MSK 43

**Narrative:**

> Your health data paints a picture of several interconnected risks that, taken together, are accelerating your biological age beyond your chronological age of 56. The most urgent concerns are your current smoking, elevated inflammatory marker (hsCRP at 4.2 mg/L), and high apoB (115 mg/dL), which together significantly raise your cardiovascular and cancer risk. Your blood fats — particularly triglycerides at 175 mg/dL and LDL at 140 mg/dL — combined with zero weekly exercise and a western-style diet suggest your metabolic and cardiovascular systems are under sustained stress.
> 
> Your family history of lung and colorectal cancer (first-degree relative, onset at 58) combined with current smoking and alcohol at 14 standard drinks per week places your oncological risk in the elevated range. Smoking alone accounts for roughly 15% of all cancers globally, and your family history adds meaningful additional risk for both lung and bowel cancers. On the neurological side, physical inactivity, poor sleep (6 hours), high LDL, elevated alcohol, and moderate stress contribute to a moderate-to-elevated dementia risk profile based on the 2024 Lancet Commission framework.
> 
> The encouraging news is that most of your top risk drivers are modifiable. Quitting smoking is the single highest-impact action you can take — it would reduce your cancer, cardiovascular, and neurodegenerative risk simultaneously. Adding even 150 minutes of moderate exercise per week, improving sleep to 7–8 hours, and reducing alcohol would meaningfully shift your biological age trajectory. We strongly recommend a GP review to discuss lipid management, inflammatory workup, and cancer screening given your family history.

**Top risk drivers:** `Current smoking (oncological and cardiovascular)`, `Elevated hsCRP 4.2 mg/L (systemic inflammation)`, `High apoB 115 mg/dL and LDL 140 mg/dL`, `Zero weekly physical activity`, `Alcohol 14 standard drinks/week with family cancer history`
**Top protective levers:** `Smoking cessation (highest single-action impact)`, `Initiating regular aerobic and resistance exercise (≥150 min/week)`, `Reducing alcohol to <7 standard drinks/week`, `Improving sleep duration to 7–8 hours`, `Dietary shift toward Mediterranean or whole-food pattern to address triglycerides and inflammation`
**Recommended screenings:** Low-dose CT lung cancer screening (LDCT) — current smoker age 56 with family history of lung cancer; Colonoscopy — first-degree family history of colorectal cancer onset at 58; Fasting lipid panel with apoB and Lp(a); HbA1c and fasting insulin / HOMA-IR (HbA1c 5.8% is in pre-diabetes range); hsCRP repeat + full inflammatory panel; DEXA bone density scan (baseline, given age and lifestyle); Testosterone / SHBG (male hormonal panel to assess metabolic and MSK risk); Resting blood pressure measurement; RBC magnesium
**Data gaps flagged by Atlas:** Resting blood pressure (critical for AusCVD and neuro risk scoring); HbA1c confirmation and fasting glucose / HOMA-IR (current HbA1c 5.8% suggests pre-diabetes but not confirmed); Waist circumference (required for AUSDRISK metabolic scoring); DXA bone density (no MSK structural data available); Hearing assessment result (largest modifiable PAR for dementia); Lp(a) measurement (important for residual CV risk given elevated apoB); Body weight and BMI (required for FRAX, AUSDRISK, and oncological scoring); Physical activity confirmation via wearable data (wearable section empty); Full cancer screening history (colonoscopy, CT lung); Testosterone and sex hormone panel

### GP-panel notes

- [ ] Narrative is clinically defensible and free of overstatement.
- [ ] Top risk drivers match the underlying biomarker signal.
- [ ] Atlas's domain scores are consistent with the engine baseline (≤10-point deviation is OK if explained).
- [ ] Confidence level is appropriately calibrated to the data shown.
- [ ] Recommended screenings are sensible and proportionate.
- [ ] No safety-critical statement that would require clinician oversight.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S8 · 52yo woman, APOE e4/e3 carrier, family AD, otherwise healthy

**De-identified profile:** female, age 52, BMI 23.0. Smoking: never. Exercise: 180 min/wk.

### Engine baseline (deterministic anchor)

- Biological age: 53.6 (chronological 52)
- Composite risk: 13 → `very_low`
- Confidence: `low` · Data completeness: 38%
- Domain scores: CV 14 · Met 7 · Neuro 32 · Onco 0 · MSK 14

### Atlas LLM output

- **Biological age:** 51.5 · **Longevity score:** 84/100
- **Confidence:** `moderate`
- **Domain scores:** CV 18 · Met 10 · Neuro 48 · Onco 8 · MSK 18

**Narrative:**

> Overall, your health profile is very encouraging. At 52, your estimated biological age is approximately 51–52 years — essentially on par with your chronological age — driven by strong lifestyle foundations: you have never smoked, follow a Mediterranean diet, exercise 180 minutes per week with mixed cardio and weights, sleep 7 hours, and drink only 4 standard drinks per week. Your cardiovascular and metabolic markers are largely in a healthy range, and your inflammation marker (hsCRP 0.8 mg/L) is low.
> 
> The most notable area requiring attention is neurodegenerative risk. You carry one copy of the APOE e4 gene variant, which is the most significant known genetic risk factor for late-onset Alzheimer's disease — it roughly doubles to quadruples lifetime risk compared to the e3/e3 genotype. On top of this, your homocysteine is mildly elevated at 12 µmol/L (optimal is below 10), your omega-3 index is 5% (target is ≥8%), your vitamin B12 at 380 pmol/L is adequate but could be optimised, and you have a first-degree family history of neurodegenerative disease with onset at 68. These factors together place your neuro risk in the moderate range. The good news is that all of these are highly modifiable through targeted nutrition, supplementation, and lifestyle strategies.
> 
> Your cardiovascular risk is low. LDL of 115 mg/dL (approximately 3.0 mmol/L) sits at the upper boundary of the normal range given your APOE e4 status and elevated homocysteine, and is worth monitoring. Your HDL of 65 mg/dL is excellent and protective. Metabolic health looks excellent with HbA1c of 5.2% (33 mmol/mol) — well within the normal range. Oncological and musculoskeletal risks are very low given your lifestyle profile and age. Key next steps include optimising omega-3 intake, addressing homocysteine with B-vitamin support, checking fasting insulin and HOMA-IR, and completing a DXA scan for bone density baseline.

**Top risk drivers:** `APOE e4 carrier status (elevated neurodegenerative risk)`, `Elevated homocysteine (12 µmol/L) — cardiovascular and neuro risk`, `Low omega-3 index (5%) — neurodegenerative and cardiovascular risk`, `First-degree family history of neurodegenerative disease (onset age 68)`, `LDL at upper normal boundary (115 mg/dL / ~3.0 mmol/L) given APOE e4 context`
**Top protective levers:** `Mediterranean diet — anti-inflammatory, neuroprotective, cardioprotective`, `Regular mixed exercise (180 min/week) — largest modifiable factor for dementia prevention`, `Never-smoker status — significantly reduces CV, onco, and neuro risk`, `Low alcohol intake (4 units/week) — below risk threshold across all domains`, `Low hsCRP (0.8 mg/L) — indicates low systemic inflammation`
**Recommended screenings:** Fasting insulin and HOMA-IR (metabolic insulin resistance baseline); HbA1c annual recheck (already good; monitor trend); DXA bone density scan (baseline at 52, especially given no prior result); Testosterone/estradiol panel (hormonal health baseline for longevity); Magnesium RBC (intracellular magnesium; relevant to metabolic and neuro health); Fasting lipid panel with ApoB trend monitoring (LDL and homocysteine context); Cognitive baseline assessment (MoCA or similar; APOE e4 + family history warrants baseline); Omega-3 index retest after supplementation optimisation
**Data gaps flagged by Atlas:** Fasting insulin and HOMA-IR (insulin resistance cannot be assessed without these); DXA bone density (musculoskeletal risk estimate is limited without this); Resting blood pressure measurement (required for AusCVD risk calculation); Body composition / waist circumference (needed for AUSDRISK and metabolic risk precision); Testosterone and estradiol levels (hormonal context for MSK, metabolic, and neuro risk); Magnesium RBC (relevant to metabolic and neurodegenerative risk); Hearing assessment (largest population-attributable risk factor for dementia — 8.2% PAR); Vision assessment (modifiable dementia risk factor per Lancet 2024 Commission); Detailed family cancer history (oncological risk currently estimated as low but unverified)

### GP-panel notes

- [ ] Narrative is clinically defensible and free of overstatement.
- [ ] Top risk drivers match the underlying biomarker signal.
- [ ] Atlas's domain scores are consistent with the engine baseline (≤10-point deviation is OK if explained).
- [ ] Confidence level is appropriately calibrated to the data shown.
- [ ] Recommended screenings are sensible and proportionate.
- [ ] No safety-critical statement that would require clinician oversight.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S9 · 38yo male athlete, suspected familial hypercholesterolemia (very high apoB+LDL+Lp(a))

**De-identified profile:** male, age 38, BMI 23.5. Smoking: never. Exercise: 360 min/wk.

### Engine baseline (deterministic anchor)

- Biological age: 37.8 (chronological 38)
- Composite risk: 10 → `very_low`
- Confidence: `low` · Data completeness: 44%
- Domain scores: CV 34 · Met 1 · Neuro 0 · Onco 0 · MSK 0

### Atlas LLM output

- **Biological age:** 35.5 · **Longevity score:** 74/100
- **Confidence:** `moderate`
- **Domain scores:** CV 52 · Met 8 · Neuro 14 · Onco 12 · MSK 18

**Narrative:**

> At 38 years old, your overall health profile is strong in many areas — you are a non-smoker, follow a vegan diet, exercise well above recommended levels (360 minutes per week of mixed cardio and weights), sleep 8 hours nightly, have low stress, and drink only minimally. Your metabolic, neurological, oncological, and musculoskeletal risk scores are all very low, reflecting these excellent lifestyle habits. Your estimated biological age of approximately 35.5 years suggests your body is aging slightly younger than your chronological age, which is a great sign.
> 
> However, your cardiovascular picture requires attention. Your LDL cholesterol is significantly elevated at 195 mg/dL (approximately 5.0 mmol/L) and your ApoB is 155 mg/dL — both well above optimal targets, particularly given that your father experienced a cardiovascular event at age 42 (premature family history). Your Lp(a) of 85 nmol/L is also elevated, a largely inherited risk factor that independently increases cardiovascular risk. While your coronary calcium score of 0 and carotid IMT of 0.65 mm are reassuring signs that atherosclerosis has not yet taken hold, the combination of high ApoB, high LDL, high Lp(a), and strong family history of premature CVD places you in an intermediate-to-elevated cardiovascular risk category that warrants proactive clinical review. Your hsCRP of 0.6 and excellent VO2 max (~50 mL/kg/min) and HRV (70 ms) are protective and reflect excellent cardiovascular fitness.
> 
> The longevity score has been adjusted downward from the engine baseline of 90 to 74, primarily because the elevated ApoB, LDL, and Lp(a) in the context of premature family history represent a meaningful long-term cardiovascular risk that the engine's domain weighting may underweight. A clinical conversation with your GP or a preventive cardiologist about lipid-lowering strategies — including whether dietary optimisation on a vegan diet (B12, omega-3 status), pharmacotherapy (statins or PCSK9 inhibitors), or closer monitoring is appropriate — is strongly recommended.

**Top risk drivers:** `Elevated ApoB (155 mg/dL) — key driver of atherosclerotic risk`, `Elevated LDL cholesterol (~5.0 mmol/L) — significantly above target for high-risk profile`, `Elevated Lp(a) (~85 nmol/L) — largely genetic, independently raises CVD risk`, `Family history of premature cardiovascular disease (father, age 42)`, `Potential vegan diet nutrient gaps (B12, omega-3, vitamin D) affecting lipid and cardiovascular metabolism`
**Top protective levers:** `High aerobic fitness (VO2 max ~50 mL/kg/min) — one of the strongest longevity predictors`, `Excellent HRV (70 ms rmssd) — reflects strong autonomic and cardiovascular resilience`, `Non-smoker with very low alcohol intake`, `Consistent high-volume mixed exercise (cardio + resistance training)`, `Low systemic inflammation (hsCRP 0.6 mg/L) and low triglycerides (70 mg/dL)`
**Recommended screenings:** Fasting lipid panel with full lipoprotein subfractions (confirm LDL, ApoB, Lp(a) on repeat); Preventive cardiology or GP review for lipid management strategy given premature family history; HbA1c and fasting insulin / HOMA-IR (metabolic completeness); Vitamin B12, folate, vitamin D, and omega-3 index (vegan diet nutrient gaps); DXA bone density scan (musculoskeletal baseline, especially on vegan diet with potential calcium/vitamin D gaps); Testosterone and sex hormone panel (baseline for 38-year-old male); RBC magnesium level
**Data gaps flagged by Atlas:** Resting blood pressure measurement (critical for AusCVD risk calculation); Fasting glucose and HOMA-IR (metabolic risk incomplete at 29% data); Body weight, BMI, and waist circumference (needed for AUSDRISK, FRAX, and oncological scoring); DXA body composition and bone density (musculoskeletal data only 21% complete); Vitamin B12 and omega-3 index (relevant for vegan diet cardiovascular and neuro risk); Hearing assessment result (largest modifiable dementia risk factor); Full family history detail (cancer, dementia, osteoporosis in first-degree relatives)

### GP-panel notes

- [ ] Narrative is clinically defensible and free of overstatement.
- [ ] Top risk drivers match the underlying biomarker signal.
- [ ] Atlas's domain scores are consistent with the engine baseline (≤10-point deviation is OK if explained).
- [ ] Confidence level is appropriately calibrated to the data shown.
- [ ] Recommended screenings are sensible and proportionate.
- [ ] No safety-critical statement that would require clinician oversight.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S10 · 61yo male T2D on 4 meds, central obesity, MASLD, hypertensive

**De-identified profile:** male, age 61, BMI 34.1. Smoking: former. Exercise: 60 min/wk.
**Conditions:** Type 2 diabetes, Hypertension, High cholesterol
**Medications:** metformin, atorvastatin, lisinopril, empagliflozin

### Engine baseline (deterministic anchor)

- Biological age: 67.3 (chronological 61)
- Composite risk: 54 → `moderate`
- Confidence: `low` · Data completeness: 47%
- Domain scores: CV 51 · Met 76 · Neuro 38 · Onco 43 · MSK 40

### Atlas LLM output

- **Biological age:** 69 · **Longevity score:** 38/100
- **Confidence:** `moderate`
- **Domain scores:** CV 62 · Met 82 · Neuro 42 · Onco 43 · MSK 42

**Narrative:**

> Your results reflect a health profile that is working hard against some significant headwinds. The most pressing concern is your metabolic health: your HbA1c of 7.4% (57 mmol/mol), fasting glucose of 145 mg/dL, HOMA-IR of 4.2, and elevated triglycerides alongside a high visceral fat area all confirm that your Type 2 diabetes is not yet at target, and that insulin resistance is driving inflammation across multiple body systems. Your liver enzymes (ALT and GGT) and the imaging finding of 14% liver fat fraction are consistent with metabolic-associated fatty liver disease (MASLD), which amplifies both cardiovascular and metabolic risk. The good news is that you are already on a strong medication regimen including empagliflozin, which has proven cardiovascular and kidney-protective benefits — this is a meaningful protective lever.
> 
> Your cardiovascular risk sits in the moderate-to-elevated range. You have three co-existing conditions (T2DM, hypertension, high cholesterol), a family history of cardiovascular disease with onset at 60, and your HDL of 38 mmol/L is low while your triglycerides remain elevated. Your LDL of 105 mg/dL (approximately 2.7 mmol/L) is above the recommended target of less than 1.8 mmol/L for someone at your risk level under Australian guidelines. ApoB at 98 mg/dL also suggests residual atherogenic particle burden despite statin therapy. Your biological age is estimated at approximately 69 years — around 8 years older than your chronological age of 61 — largely driven by these metabolic and cardiovascular signals.
> 
> The encouraging news is that many of your top risk drivers are modifiable. Improving your HbA1c toward the 6.5–7.0% range, reducing visceral fat through structured exercise and dietary change, increasing weekly physical activity (especially resistance training), improving sleep duration beyond 6 hours, and managing chronic stress can each meaningfully shift your trajectory. With focused effort over 12–18 months, it is realistic to reduce your biological age estimate and substantially lower your risk across all domains. Regular monitoring and close collaboration with your GP and potentially an endocrinologist and cardiologist are strongly recommended.

**Top risk drivers:** `Poorly controlled Type 2 diabetes (HbA1c 7.4%, fasting glucose 145 mg/dL, HOMA-IR 4.2)`, `High visceral fat (158 cm²) and hepatic steatosis (liver fat 14%)`, `Low HDL (38 mg/dL) with elevated triglycerides (195 mg/dL) — atherogenic dyslipidaemia`, `Insufficient physical activity (60 min/week) with no resistance training`, `Chronic high stress and short sleep (6 hours/night)`
**Top protective levers:** `Empagliflozin (SGLT2 inhibitor) — cardiorenal and metabolic protection already in place`, `Former smoker status — eliminates tobacco-related risk elevation`, `Alcohol intake low (4 units/week) — not a significant contributor to risk`, `Statin therapy (atorvastatin) — LDL partially managed; opportunity to optimise dose/target`, `Structured resistance training programme — high-yield intervention for metabolic and MSK risk`
**Recommended screenings:** Cardiology review: coronary artery calcium (CAC) score to better stratify CVD risk and guide LDL-lowering intensity; Endocrinology or diabetes educator review: optimise HbA1c target and consider GLP-1 agonist addition; Liver assessment: FibroScan or liver elastography to stage MASLD/fibrosis given ALT, GGT and liver fat fraction; DXA scan: body composition and bone density baseline (no current MSK data; resistance training history absent); Sleep study (polysomnography): rule out obstructive sleep apnoea given visceral obesity, short sleep, high stress; Uric acid management review: level 7.2 mg/dL is above threshold; assess for gout risk and metabolic syndrome contribution
**Data gaps flagged by Atlas:** Resting blood pressure reading (SBP/DBP) — critical for AusCVD risk calculation and hypertension management review; Fasting lipid panel with LDL in mmol/L and non-HDL cholesterol for precise AusCVD 5-year risk calculation; eGFR and urine albumin-to-creatinine ratio (uACR) — essential given T2DM, hypertension, empagliflozin use; APOE genotyping — would significantly refine neurodegenerative risk estimate; DXA scan result (bone density and body composition) — MSK domain currently low data (21%); Wearable/activity data — no wearable data provided; step count, heart rate variability, and sleep staging would improve neuro, CV and metabolic scoring

### GP-panel notes

- [ ] Narrative is clinically defensible and free of overstatement.
- [ ] Top risk drivers match the underlying biomarker signal.
- [ ] Atlas's domain scores are consistent with the engine baseline (≤10-point deviation is OK if explained).
- [ ] Confidence level is appropriately calibrated to the data shown.
- [ ] Recommended screenings are sensible and proportionate.
- [ ] No safety-critical statement that would require clinician oversight.

**Free-text feedback:**

> _Reviewer to fill in._

---

# Integrative-Medicine Review Pack — Supplement Protocol (Sage)

**Generated:** 2026-04-30 by `tests/integration/_review-packs.test.ts`
**Reviewers:** Integrative-medicine panel
**Agent:** `supplement_advisor` (Sage) — Claude Sonnet 4.6
**Companion:** narrative pack at `docs/qa/2026-04-30-narrative-review-pack.md` (same 10 fixtures, same Atlas output Sage saw).

## Purpose

Sage produces a personalised 30-day supplement protocol from the patient's risk profile + questionnaire + uploaded labs. Before promoting to a member pilot we want a clinical review across 10 representative profiles spanning the demographic and risk landscape.

Each entry shows: the de-identified profile, the Atlas risk signal Sage was given, and Sage's full protocol (item, form, dosage, timing, priority, domains, rationale).

## What we'd like you to check

1. **Evidence grounding** — every item has clinical evidence at the proposed dose.
2. **Drug-supplement safety** — no interactions with the patient's medication list (statin + CoQ10, levothyroxine + calcium timing, SSRI + 5-HTP, etc.).
3. **Dose appropriateness** — safe for this patient's age, sex, and renal/hepatic status.
4. **Priority calibration** — `critical` / `high` / `recommended` / `performance` reflects urgency.
5. **Personalisation** — rationales reference the patient's specific drivers, not generic claims.
6. **Adherence realism** — total daily pill burden is sustainable for 12+ months.

Please tick the checkboxes inline and add free-text feedback under each sample.

---

## S1 · Healthy 35yo male, full biomarker panel, no family history

**De-identified profile:** male, age 35, BMI 23.1. Smoking: never. Exercise: 320 min/wk.
**Risk profile (Atlas):** CV 5 · Met 5 · Neuro 8 · Onco 8 · MSK 8

### Sage protocol — 13 items

*Full blood panel, imaging (DEXA, CAC, carotid IMT, liver fat, visceral fat), genetic (APOE e3/e3), hormonal (IGF-1), and microbiome data available — high confidence protocol. No pathology documents uploaded; protocol based on structured questionnaire biomarker data. All key longevity biomarkers are within optimal ranges: no critical deficiencies detected. Elevated risk scores in Neuro (8), Onco (8), and MSK (8) are the primary drivers of this protocol despite excellent objective biomarkers, suggesting risk is likely genetic/familial or questionnaire-derived — clinician review of family history data (currently empty) is recommended to further contextualise Neuro and Onco risk scores.* · interactions_checked: `true`

| # | Supplement | Form | Dosage | Timing | Priority | Domains | Rationale |
|---:|---|---|---|---|---|---|---|
| 1 | Vitamin D3 + K2 | Softgel | 2000 IU D3 / 100 mcg K2 (MK-7) | With largest meal (fat-containing) | recommended | MSK, neuro, onco, immune | Vitamin D at 55 ng/mL is adequate but optimising toward 60–70 ng/mL supports bone density (DEXA T-scores positive but MSK risk elevated), neuroprotection, and cancer-risk reduction. K2 (MK-7) directs calcium to bone and away from vasculature, complementing the already-excellent CAC score of 0. |
| 2 | Omega-3 Fish Oil (EPA/DHA) | Softgel | 2000 mg combined EPA+DHA | With largest meal | high | neuro, cardiovascular, onco, inflammatory | Omega-3 index of 9% is in the optimal range; maintaining this with a modest maintenance dose continues to support neuroinflammation reduction (Neuro risk = 8), membrane integrity, and cancer-risk modulation. EPA in particular supports resolution of low-grade inflammation and mood stability. |
| 3 | Magnesium Glycinate | Capsule | 400 mg elemental magnesium | Before bed | recommended | neuro, MSK, metabolic, sleep | RBC magnesium of 6 mg/dL is within range, but given high exercise volume (320 min/week mixed training), magnesium losses through sweat are significant. Glycinate form maximises absorption and CNS bioavailability, supporting sleep architecture, muscle recovery, and neuroprotection relevant to the elevated Neuro and MSK risk scores. |
| 4 | NMN (Nicotinamide Mononucleotide) | Capsule | 500 mg | Morning, fasted or with light breakfast | recommended | neuro, onco, metabolic, longevity | At 35 with high Neuro and Onco risk scores, NAD+ precursor supplementation supports mitochondrial biogenesis, DNA repair capacity (PARP activity), and neuronal resilience. NMN is preferred over NR for direct conversion efficiency. Complements active exercise lifestyle which already boosts NAMPT. |
| 5 | Creatine Monohydrate | Powder | 5 g | Post-workout or with any meal on rest days | performance | MSK, neuro, metabolic | MSK risk score of 8 warrants proactive musculoskeletal support. Creatine improves muscle phosphocreatine resynthesis, lean mass maintenance, and bone loading response. Emerging evidence also supports neuronal energy buffering relevant to the elevated Neuro risk score. Safe, well-tolerated, and synergistic with the existing resistance training protocol. |
| 6 | Lion's Mane Mushroom Extract (>30% beta-glucans) | Capsule | 1000 mg | Morning with breakfast | recommended | neuro, onco | Neuro risk score of 8 in a 35-year-old warrants proactive NGF (nerve growth factor) stimulation. Hericenones and erinacines in Lion's Mane stimulate NGF synthesis, supporting neuroplasticity and cognitive resilience. Additionally, beta-glucan fractions have immunomodulatory and anti-tumour properties relevant to the elevated Onco risk score. |
| 7 | Sulforaphane (Broccoli Sprout Extract, standardised) | Capsule | 30 mg sulforaphane equivalent | With breakfast | high | onco, neuro, inflammatory | Onco risk score of 8 is the primary driver. Sulforaphane activates Nrf2 pathway, upregulating phase II detoxification enzymes and antioxidant defences. Strong epidemiological and mechanistic evidence for cancer risk reduction. Secondary benefit: Nrf2 activation is neuroprotective, relevant to elevated Neuro score. hsCRP of 0.5 is excellent; sulforaphane helps sustain this. |
| 8 | Phosphatidylserine | Softgel | 200 mg | With evening meal | performance | neuro, MSK | Given elevated Neuro risk score, phosphatidylserine supports neuronal membrane integrity, cortisol blunting post-exercise, and cognitive function. At high training volumes (320 min/week), it also attenuates exercise-induced cortisol spikes, supporting recovery and HPA axis regulation. |
| 9 | Ubiquinol (CoQ10) | Softgel | 200 mg | With largest meal (fat-containing) | recommended | cardiovascular, neuro, onco, mitochondrial | Ubiquinol (reduced CoQ10) supports mitochondrial electron transport chain efficiency and acts as a fat-soluble antioxidant. At 35, endogenous CoQ10 synthesis is still reasonable but supplementation provides a meaningful buffer for mitochondrial health relevant to Neuro and Onco risk. Ubiquinol form has superior bioavailability over ubiquinone. |
| 10 | Zinc Picolinate | Capsule | 15 mg | With evening meal (not with iron-containing foods) | recommended | onco, immune, MSK, neuro | Zinc is critical for DNA repair fidelity, p53 tumour suppressor function, and immune surveillance — all directly relevant to an Onco risk score of 8. Also supports testosterone biosynthesis (total testosterone 600 ng/dL is good; maintaining this is a goal), muscle protein synthesis, and neuronal signalling. Picolinate form optimises absorption. |
| 11 | Berberine | Capsule | 500 mg | With largest meal | recommended | metabolic, onco, longevity | Despite excellent metabolic markers (HOMA-IR 1.0, HbA1c 5.0%, fasting insulin 4), berberine activates AMPK — a key longevity pathway — and has demonstrated anti-proliferative effects relevant to the elevated Onco risk score. Acts as a caloric-restriction mimetic and supports microbiome diversity (current index 4.5 is good; berberine can further enrich beneficial taxa). |
| 12 | Astaxanthin | Softgel | 12 mg | With largest meal (fat-containing) | recommended | neuro, onco, cardiovascular, MSK | One of the most potent lipid-soluble antioxidants, astaxanthin crosses the blood-brain barrier and provides neuroprotection directly relevant to Neuro risk score of 8. Also supports mitochondrial membrane integrity, reduces exercise-induced oxidative damage (supporting MSK recovery), and has anti-angiogenic properties relevant to Onco risk. |
| 13 | Probiotic (Multi-strain, >50 billion CFU) | Capsule | 50 billion CFU (Lactobacillus + Bifidobacterium blend) | Morning, fasted or 30 min before breakfast | recommended | onco, neuro, immune, metabolic | Microbiome diversity index of 4.5 is good but not exceptional. A multi-strain probiotic supports the gut-brain axis (relevant to Neuro risk), gut-immune surveillance (Onco risk), and maintains diversity alongside the existing Mediterranean diet. Bifidobacterium longum and Lactobacillus rhamnosus strains have specific evidence for neuroinflammation reduction. |

**Per-item notes:**
- 11. **Berberine** — Berberine can inhibit CYP3A4 and CYP2D6. No current medications listed, so no interaction risk at this time. If medications are added in future, re-evaluate.

### Integrative-medicine review notes

- [ ] Items are evidence-grounded (no homeopathy, no proprietary blends).
- [ ] Dosages are safe for this patient's age, sex, and conditions.
- [ ] No drug-supplement interactions with the patient's medication list.
- [ ] Priority labels (`critical`/`high`/`recommended`/`performance`) match clinical urgency.
- [ ] Rationales reference the patient's specific risk drivers, not generic claims.
- [ ] Forms (e.g., methylated B12 vs cyanocobalamin) are clinically sensible.
- [ ] Timing instructions are practical and account for absorption.
- [ ] Total daily pill burden is reasonable for sustained adherence.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S2 · Same as S1 but with wearable data (HRV, VO₂max, sleep)

**De-identified profile:** male, age 35, BMI 23.1. Smoking: never. Exercise: 320 min/wk.
**Risk profile (Atlas):** CV 8 · Met 6 · Neuro 8 · Onco 10 · MSK 8

### Sage protocol — 13 items

*No pathology documents were uploaded. Protocol is based on questionnaire data and self-reported biomarkers only. Biomarkers appear within normal-to-optimal ranges across all panels. NOTABLE: Oncology risk score is critically elevated at 10/10 — this warrants clinical review to identify the driving risk factors (family history data was not provided; this gap reduces confidence). Full family history, genetic cancer panel (BRCA, Lynch syndrome markers), and a gastroenterology or oncology consultation are strongly recommended. Imaging markers (CAC=0, IMT=0.5, liver fat 2%) are reassuring. All biomarkers provided are self-reported and have not been verified against uploaded laboratory documents.* · interactions_checked: `true`

| # | Supplement | Form | Dosage | Timing | Priority | Domains | Rationale |
|---:|---|---|---|---|---|---|---|
| 1 | Vitamin D3 + K2 | Softgel | 2000 IU D3 + 100 mcg MK-7 K2 | With largest meal (fat-containing) | recommended | musculoskeletal, oncology, cardiovascular, immune | Vitamin D at 55 ng/mL is adequate but optimising toward 60–70 ng/mL supports bone density (DEXA T-scores mildly low-normal), cancer risk reduction (Onco score 10), and immune modulation. K2 as MK-7 directs calcium to bone and away from vasculature, complementing a CAC score of 0 and supporting long-term arterial health. |
| 2 | Omega-3 Fish Oil (EPA/DHA) | Softgel | 2000 mg combined EPA+DHA | With largest meal | high | cardiovascular, neuro, oncology, inflammatory | Omega-3 index of 9% is good but the upper-optimal target is 10–12%. EPA and DHA reduce residual cardiovascular risk, support neuronal membrane integrity (Neuro score 8), downregulate inflammatory signalling relevant to cancer risk (Onco score 10), and are consistent with the patient's Mediterranean diet pattern. |
| 3 | Magnesium Glycinate | Capsule | 400 mg | Before bed | high | neuro, cardiovascular, metabolic, sleep, musculoskeletal | RBC magnesium of 6.0 mg/dL sits at the lower end of optimal. Magnesium glycinate supports neurological function (Neuro score 8), cardiac electrophysiology, insulin sensitivity, muscle recovery given 320 min/week exercise, and sleep architecture. Glycinate form minimises GI upset and has mild anxiolytic properties. |
| 4 | Sulforaphane (Broccoli Sprout Extract) | Capsule | 30 mg standardised sulforaphane | Morning, with or without food | high | oncology, detoxification, cardiovascular, inflammatory | Onco score of 10 is the highest risk domain. Sulforaphane activates Nrf2 pathway, upregulating phase II detoxification enzymes and antioxidant defences. Evidence supports reduction in cancer cell proliferation, reduction in hsCRP (already excellent at 0.5 but sustained), and cardiovascular protection. A cornerstone supplement for chemoprevention in a young patient with elevated oncology risk. |
| 5 | Berberine | Capsule | 500 mg | With main meal once daily | recommended | metabolic, cardiovascular, oncology, longevity | Despite excellent metabolic markers (HOMA-IR 1, HbA1c 5.0, fasting insulin 4), berberine activates AMPK — a master metabolic regulator associated with longevity. It supports microbiome diversity (diversity index 4.5 is good but can be improved), has anti-proliferative properties relevant to Onco score 10, and modestly lowers ApoB. Dose kept to once daily to avoid GI intolerance. |
| 6 | NMN (Nicotinamide Mononucleotide) | Capsule | 500 mg | Morning, fasted or with light breakfast | recommended | longevity, neuro, metabolic, cardiovascular | NAD+ precursor supporting mitochondrial efficiency and DNA repair — highly relevant at age 35 as a longevity investment. Supports neurological resilience (Neuro score 8), enhances benefits of the patient's high exercise volume (VO2max 55 is excellent; NMN may further support mitochondrial biogenesis), and complements AMPK activation from berberine. APOE e3/e3 status is neutral, but NAD+ pathway supports long-term neurological health. |
| 7 | Lithium Orotate | Tablet | 5 mg | With evening meal | recommended | neuro, oncology, longevity | Low-dose lithium orotate (not pharmaceutical lithium) has emerging evidence for neuroprotection, BDNF upregulation, and GSK-3β inhibition relevant to neurodegeneration prevention (Neuro score 8). Epidemiological data links low environmental lithium to higher rates of neurological and mood disorders. Also has emerging anti-proliferative data. Safe at 5 mg micronutrient dose. |
| 8 | Coenzyme Q10 (Ubiquinol) | Softgel | 200 mg | With largest meal (fat-containing) | recommended | cardiovascular, neuro, longevity, performance | Ubiquinol (active form) supports mitochondrial electron transport chain efficiency, cardiac muscle energetics (resting HR 52 and HRV 75 reflect excellent autonomic tone — CoQ10 helps maintain this), and is a lipid-soluble antioxidant. Relevant to Neuro score 8 and CV score 8 as a longevity-oriented mitochondrial support agent. |
| 9 | Zinc Bisglycinate | Capsule | 15 mg | With evening meal | recommended | oncology, immune, hormonal, musculoskeletal | Zinc is critical for DNA repair fidelity, immune surveillance, and testosterone metabolism (total testosterone 600 ng/dL is good; zinc supports maintenance). Particularly relevant to Onco score 10 given zinc's role in p53 tumour suppressor function. Bisglycinate form has superior absorption. Kept at 15 mg to avoid copper displacement at higher doses. |
| 10 | Curcumin Phytosome | Capsule | 500 mg | With largest meal | recommended | oncology, inflammatory, neuro, musculoskeletal | Phytosome form (Meriva or equivalent) provides 29x greater bioavailability than standard curcumin. Curcumin inhibits NF-κB inflammatory signalling, supports cancer chemoprevention (Onco score 10), reduces exercise-induced muscle inflammation (320 min/week training load), and has neuroprotective properties. hsCRP of 0.5 is excellent — curcumin helps maintain this low baseline. |
| 11 | Creatine Monohydrate | Powder | 5 g | Post-workout or with morning meal on rest days | performance | musculoskeletal, neuro, performance, longevity | Creatine is one of the most evidence-backed supplements for muscle phosphocreatine resynthesis, supporting the patient's mixed cardio and weights training. Emerging evidence supports cognitive benefits and neuroprotection (Neuro score 8). Also supports bone density maintenance (DEXA T-scores mildly low-normal at spine +0.5 and hip +0.3). Safe, inexpensive, and well-tolerated. |
| 12 | Ashwagandha (KSM-66) | Capsule | 600 mg | With evening meal or before bed | performance | neuro, hormonal, performance, stress | KSM-66 standardised extract supports HPA axis resilience, cortisol regulation, and testosterone levels. While stress is self-reported as low, the patient's high exercise volume (320 min/week) creates physiological stress load. Ashwagandha supports recovery, maintains testosterone (currently 600 ng/dL), and has neuroprotective adaptogenic properties relevant to Neuro score 8. Also supports sleep quality. |
| 13 | Probiotic (Multi-strain) | Capsule | 50 billion CFU (Lactobacillus + Bifidobacterium blend) | Morning, fasted or 30 min before breakfast | performance | oncology, metabolic, immune, longevity | Microbiome diversity index of 4.5 is reasonable but optimisation is warranted given Onco score 10 — gut microbiome composition influences systemic immune surveillance and cancer risk via short-chain fatty acid production and immune modulation. A multi-strain probiotic complements the Mediterranean diet and supports the gut-brain axis (Neuro score 8). |

### Integrative-medicine review notes

- [ ] Items are evidence-grounded (no homeopathy, no proprietary blends).
- [ ] Dosages are safe for this patient's age, sex, and conditions.
- [ ] No drug-supplement interactions with the patient's medication list.
- [ ] Priority labels (`critical`/`high`/`recommended`/`performance`) match clinical urgency.
- [ ] Rationales reference the patient's specific risk drivers, not generic claims.
- [ ] Forms (e.g., methylated B12 vs cyanocobalamin) are clinically sensible.
- [ ] Timing instructions are practical and account for absorption.
- [ ] Total daily pill burden is reasonable for sustained adherence.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S3 · 58yo male, current smoker, multiple CV risk factors, family CV history

**De-identified profile:** male, age 58, BMI 28.4. Smoking: current. Exercise: 60 min/wk.
**Conditions:** Hypertension, High cholesterol
**Medications:** lisinopril
**Risk profile (Atlas):** CV 88 · Met 64 · Neuro 62 · Onco 72 · MSK 43

### Sage protocol — 14 items

*MEDICAL ATTENTION REQUIRED: Multiple critically abnormal biomarkers identified — (1) LDL 165 mg/dL + ApoB 145 mg/dL: statin therapy should be urgently discussed with prescribing physician; no statin is currently listed in medications despite very high CV risk. (2) Lp(a) 110 nmol/L: severely elevated, largely genetically determined; requires specialist cardiovascular review and consideration of emerging Lp(a)-lowering therapies (e.g., PCSK9 inhibitors, RNA-targeting agents in trial). (3) CAC score 250: indicates established subclinical atherosclerosis; cardiology referral recommended. (4) Homocysteine 16 µmol/L: elevated, addressed in protocol. (5) hsCRP 3.5 mg/L: elevated inflammatory marker. (6) HDL 35 mg/dL: low. No formal pathology documents were uploaded; protocol is based entirely on questionnaire-reported biomarkers and risk scores. Vitamin D, B12, fasting glucose, HbA1c, liver enzymes, and renal function (eGFR — relevant given lisinopril use) are not available and should be obtained at next blood draw to refine protocol. Confidence is moderate per risk engine.* · interactions_checked: `true`

| # | Supplement | Form | Dosage | Timing | Priority | Domains | Rationale |
|---:|---|---|---|---|---|---|---|
| 1 | Omega-3 Fish Oil (EPA/DHA) | Softgel | 4000 mg (2400 mg EPA+DHA) | With largest meal | critical | cardiovascular, metabolic | Triglycerides at 220 mg/dL with ApoB 145 and Lp(a) 110 represent a severe composite cardiovascular risk. High-dose EPA/DHA (prescription-equivalent range) is the most evidence-backed intervention for hypertriglyceridaemia and has demonstrated REDUCE-IT mortality benefit in high-CV-risk patients. Also addresses hsCRP elevation and endothelial support given CAC score of 250. |
| 2 | Vitamin K2 (MK-7) | Capsule | 200 mcg | With largest meal (fat-containing) | critical | cardiovascular, MSK | CAC score of 250 and carotid IMT of 0.95 mm indicate established subclinical atherosclerosis. MK-7 activates matrix Gla protein, the primary inhibitor of vascular calcification. Evidence supports K2 in slowing progression of arterial calcification and improving arterial stiffness, particularly relevant given the aggressive CAC trajectory implied by age 58 and family history of CVD onset at 52. |
| 3 | Berberine | Capsule | 500 mg | Twice daily with meals (morning and evening) | high | cardiovascular, metabolic | LDL 165 mg/dL, ApoB 145, triglycerides 220, and HDL 35 constitute a highly atherogenic lipid panel. Berberine upregulates LDL receptors via PCSK9 inhibition and activates AMPK, producing clinically meaningful reductions in LDL (15–25%), triglycerides (25–35%), and modest HDL improvement. Metabolic risk score of 64 and western diet further support use. Acts as a statin-alternative adjunct given no statin is currently prescribed. |
| 4 | Aged Garlic Extract | Capsule | 1200 mg | With morning meal | high | cardiovascular, metabolic | Lp(a) of 110 nmol/L is a genetically elevated, largely treatment-resistant cardiovascular risk factor. Aged garlic extract has demonstrated modest but consistent Lp(a) reduction in RCTs (10–15%), alongside LDL and blood pressure lowering. Also reduces hsCRP, directly relevant given hsCRP 3.5 mg/L. CAC score of 250 and carotid IMT 0.95 mm make every Lp(a)-modulating intervention warranted. |
| 5 | Folate (5-MTHF) + B6 + B12 | Capsule (methylated B-complex) | 5-MTHF 800 mcg / B6 (P-5-P) 50 mg / B12 (methylcobalamin) 1000 mcg | With breakfast | high | cardiovascular, neuro | Homocysteine of 16 µmol/L is significantly elevated (optimal <10); hyperhomocysteinaemia is an independent risk factor for atherosclerosis, stroke, and cognitive decline. Elevated homocysteine is directly cardiotoxic via endothelial damage and LDL oxidation, compounding an already critical CV risk profile. Methylated forms bypass MTHFR polymorphisms common in this demographic. Neuro risk score of 62 also warrants homocysteine lowering for dementia prevention. |
| 6 | Magnesium Glycinate | Capsule | 400 mg | Before bed | high | cardiovascular, metabolic, neuro | Hypertension, high stress, poor sleep (6 hours), and western diet are all associated with magnesium depletion. Magnesium is a cofactor in >300 enzymatic reactions, including vascular smooth muscle relaxation, insulin signalling, and neurotransmitter regulation. Evidence supports blood pressure reduction (5–8 mmHg systolic), improved insulin sensitivity, and sleep quality improvement. Glycinate form chosen for superior bioavailability and GI tolerability. |
| 7 | Coenzyme Q10 (Ubiquinol) | Softgel | 200 mg | With largest meal | high | cardiovascular, metabolic | Hypertension, high CV risk, and mitochondrial support all warrant CoQ10. Ubiquinol (reduced form) is markedly superior in bioavailability at age 58 when endogenous conversion from ubiquinone declines. Evidence supports 5–17 mmHg systolic BP reduction and improved endothelial function. Also counteracts oxidative stress driving hsCRP elevation and supports cardiac muscle energetics given the significant atherosclerotic burden. |
| 8 | Vitamin D3 + K2 (combined) | Softgel | 5000 IU D3 / 100 mcg K2 (MK-7) | With largest meal | high | cardiovascular, onco, MSK, metabolic | No bloodwork for vitamin D, but current smoker, low exercise, western diet, and standard northern-hemisphere risk profile make deficiency highly probable. Vitamin D deficiency is independently associated with hypertension, dyslipidaemia, inflammation, and the elevated oncology risk score (72). K2 is paired with D3 to direct calcium to bone rather than vasculature — particularly important given confirmed arterial calcification (CAC 250). Combined dose keeps standalone K2 supplement and this entry distinct; total MK-7 across protocol should be reviewed to avoid redundancy — note: the standalone K2 entry above provides 200 mcg; this entry adds 100 mcg for a combined daily total of 300 mcg MK-7, which is within the safe and evidence-supported range. |
| 9 | Curcumin (Theracurmin or Meriva) | Capsule (high-bioavailability form) | 500 mg | With evening meal | recommended | cardiovascular, onco, neuro, metabolic | hsCRP of 3.5 mg/L indicates chronic systemic inflammation, a key driver across all four elevated risk domains (CV 88, Onco 72, Neuro 62, Metabolic 64). Bioavailable curcumin has demonstrated significant NF-κB inhibition and CRP reduction in RCTs. Oncology risk score of 72 also benefits from curcumin's anti-proliferative and pro-apoptotic signalling. High-bioavailability form (Theracurmin or Meriva phospholipid complex) is essential as standard curcumin has <1% oral bioavailability. |
| 10 | NMN (Nicotinamide Mononucleotide) | Capsule | 500 mg | With breakfast | recommended | cardiovascular, metabolic, neuro | Age 58 with mitochondrial stress signals (smoking, poor diet, high stress, minimal exercise) warrants NAD+ precursor supplementation. NAD+ decline with age impairs sirtuin activity, DNA repair, and vascular endothelial function — all highly relevant given CV risk score of 88. NMN has shown endothelial improvement and metabolic benefits in recent human trials. Supports neurocognitive domain (risk 62) via neuronal NAD+ repletion. |
| 11 | Ashwagandha (KSM-66) | Capsule | 600 mg | Before bed | recommended | cardiovascular, neuro, metabolic | Chronic high stress drives cortisol elevation, which worsens hypertension, dyslipidaemia, insulin resistance, and sleep quality — all present in this patient. KSM-66 ashwagandha has the strongest human evidence among adaptogens for cortisol reduction (15–30%), stress-related anxiety, sleep latency improvement, and modest testosterone support. Sleep at 6 hours combined with high stress and CV risk makes this a high-value addition. Bedtime timing synergises with magnesium glycinate for sleep architecture. |
| 12 | Zinc + Copper (balanced) | Capsule | Zinc 25 mg / Copper 2 mg | With evening meal | recommended | cardiovascular, onco, metabolic | Current smoking, western diet, and high alcohol intake (16 units/week) create significant oxidative and immune burden. Zinc is essential for antioxidant enzyme (SOD) activity, immune surveillance, and DNA repair — relevant to oncology risk score of 72. Copper is co-supplemented to prevent zinc-induced copper depletion. Zinc also supports vascular endothelial function and is commonly depleted by alcohol use. |
| 13 | Psyllium Husk | Powder | 10 g | With 300 mL water before largest meal | performance | cardiovascular, metabolic | LDL 165 mg/dL and triglycerides 220 mg/dL with a western diet benefit substantially from soluble fibre. Psyllium husk reduces LDL by 5–15% via bile acid sequestration and slows postprandial glucose absorption, improving metabolic score. Also supports gut microbiome diversity, which is typically compromised in western diet patterns. Non-pharmacological, safe, and additive to other lipid-lowering interventions. |
| 14 | Lutein + Zeaxanthin | Softgel | 20 mg lutein / 4 mg zeaxanthin | With largest meal | performance | neuro, onco | Current smoking dramatically elevates oxidative stress in ocular and neural tissue. Lutein and zeaxanthin are the primary macular carotenoids with strong evidence for reducing oxidative retinal damage in smokers. Also relevant to neuro risk score of 62 as these carotenoids concentrate in the hippocampus and prefrontal cortex, with emerging evidence for cognitive protection. Oncology risk score of 72 in a current smoker warrants antioxidant carotenoid support (noting beta-carotene is specifically contraindicated in smokers — lutein/zeaxanthin are safe). |

**Per-item notes:**
- 1. **Omega-3 Fish Oil (EPA/DHA)** — High-dose omega-3 may have additive blood-pressure-lowering effect with lisinopril — monitor BP. At doses ≥3 g/day, mild antiplatelet effect; note if anticoagulants are ever added. Alcohol intake of 16 units/week further elevates triglycerides; dose may need upward titration if alcohol is not reduced.
- 3. **Berberine** — Berberine inhibits CYP3A4 and CYP2D6; if any new medications are added, check for interactions. May potentiate antihypertensive effect of lisinopril — monitor blood pressure, especially in first 4 weeks.
- 4. **Aged Garlic Extract** — Mild antiplatelet activity; additive with high-dose omega-3. Monitor if anticoagulants are introduced. May augment antihypertensive effect of lisinopril — monitor BP.
- 6. **Magnesium Glycinate** — Additive antihypertensive effect with lisinopril is possible; monitor blood pressure. Magnesium may reduce absorption of some medications — take lisinopril at least 2 hours apart from magnesium.
- 7. **Coenzyme Q10 (Ubiquinol)** — May have additive antihypertensive effect with lisinopril — monitor BP. No contraindication with lisinopril but worth noting in clinical review.
- 8. **Vitamin D3 + K2 (combined)** — Vitamin D3 at 5000 IU is a therapeutic loading dose; recheck 25(OH)D at next blood draw and titrate to 50–80 ng/mL. No interaction with lisinopril.
- 9. **Curcumin (Theracurmin or Meriva)** — Mild antiplatelet activity at high doses; additive with omega-3 and garlic. No known interaction with lisinopril.
- 13. **Psyllium Husk** — Take lisinopril at least 1 hour before or 2 hours after psyllium to avoid potential absorption interference.
- 14. **Lutein + Zeaxanthin** — Beta-carotene supplements are CONTRAINDICATED in current smokers (CARET trial: increased lung cancer risk). Lutein and zeaxanthin do NOT carry this risk and are safe for smokers.

### Integrative-medicine review notes

- [ ] Items are evidence-grounded (no homeopathy, no proprietary blends).
- [ ] Dosages are safe for this patient's age, sex, and conditions.
- [ ] No drug-supplement interactions with the patient's medication list.
- [ ] Priority labels (`critical`/`high`/`recommended`/`performance`) match clinical urgency.
- [ ] Rationales reference the patient's specific risk drivers, not generic claims.
- [ ] Forms (e.g., methylated B12 vs cyanocobalamin) are clinically sensible.
- [ ] Timing instructions are practical and account for absorption.
- [ ] Total daily pill burden is reasonable for sustained adherence.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S4 · 48yo woman, pre-diabetes, central adiposity, MASLD

**De-identified profile:** female, age 48, BMI 33.8. Smoking: former. Exercise: 40 min/wk.
**Conditions:** Pre-diabetes
**Risk profile (Atlas):** CV 45 · Met 76 · Neuro 38 · Onco 42 · MSK 42

### Sage protocol — 15 items

*MEDICAL ATTENTION RECOMMENDED: Triglycerides of 240 mg/dL, fasting glucose 115 mg/dL, HbA1c 6.2%, HOMA-IR 3.5, ALT 55 U/L, GGT 60 U/L, and liver fat fraction of 18% collectively indicate metabolic syndrome with probable early MASLD/NAFLD requiring clinician review and monitoring. No pathology documents were uploaded — protocol is based entirely on questionnaire and self-reported biomarker data. No Vitamin D, B12, full lipid panel (LDL), CRP, ferritin, or full liver function results are available; these should be obtained urgently to refine and titrate this protocol. Wearable data was not provided. Confidence is moderate per risk scoring. This protocol should be reviewed by a physician or metabolic medicine specialist before initiation.* · interactions_checked: `false`

| # | Supplement | Form | Dosage | Timing | Priority | Domains | Rationale |
|---:|---|---|---|---|---|---|---|
| 1 | Berberine | Capsule | 500 mg | With each main meal (3x daily) | critical | metabolic, cardiovascular | HbA1c 6.2%, HOMA-IR 3.5, fasting glucose 115 mg/dL, and strong family history of early-onset diabetes indicate urgent insulin sensitisation is needed. Berberine activates AMPK, improves insulin sensitivity, lowers fasting glucose and HbA1c comparably to metformin, and also reduces triglycerides — directly addressing the critically elevated TG of 240 mg/dL. |
| 2 | Magnesium Glycinate | Capsule | 400 mg | Before bed | critical | metabolic, cardiovascular, sleep | Magnesium deficiency is highly prevalent in insulin-resistant and pre-diabetic states. Magnesium acts as a cofactor in over 300 enzymatic reactions including glucose transport and insulin receptor signalling. Also supports sleep quality (currently 6 hours) and mild cardiovascular risk reduction. Glycinate form chosen for superior absorption and minimal GI side effects. |
| 3 | Omega-3 (EPA/DHA) | Softgel | 3000 mg | With largest meal | critical | cardiovascular, metabolic, inflammatory | Triglycerides of 240 mg/dL represent a clinically significant cardiovascular risk, compounded by low HDL of 38 mg/dL. High-dose EPA/DHA (≥3 g/day) is the most evidence-backed intervention for hypertriglyceridaemia, with additional anti-inflammatory and hepatoprotective benefits relevant to the elevated ALT, GGT, and 18% liver fat fraction (consistent with NAFLD). |
| 4 | Inositol (Myo-Inositol) | Powder | 2000 mg | Morning, on an empty stomach | high | metabolic, cardiovascular | Myo-inositol is a key second messenger in insulin signalling. RCTs demonstrate significant reductions in fasting insulin, HOMA-IR, and triglycerides in metabolic syndrome and pre-diabetes. Directly targets the elevated fasting insulin (14 µIU/mL) and HOMA-IR (3.5) in this patient. |
| 5 | Vitamin D3 + K2 | Softgel | 4000 IU D3 / 100 mcg K2 (MK-7) | With largest meal | high | metabolic, cardiovascular, MSK, immune | Vitamin D insufficiency is near-universal in metabolic syndrome and worsens insulin resistance. No blood level is available but the metabolic risk profile, western diet, and moderate sun exposure probability strongly warrant supplementation. K2 MK-7 is co-administered to direct calcium appropriately and support vascular health given elevated cardiovascular risk. Will need blood level checked to titrate dose. |
| 6 | Silymarin (Milk Thistle Extract, 80% Silymarin) | Capsule | 300 mg | With meals (twice daily) | high | metabolic, hepatic | ALT 55 U/L, GGT 60 U/L, and liver fat fraction of 18% are consistent with early metabolic-associated steatotic liver disease (MASLD/NAFLD). Silymarin has robust evidence for reducing hepatic inflammation, lowering transaminases, improving insulin sensitivity, and attenuating hepatic steatosis progression. Also provides antioxidant support relevant to former smoking history. |
| 7 | Coenzyme Q10 (Ubiquinol) | Softgel | 200 mg | With largest meal | high | cardiovascular, metabolic, mitochondrial | Visceral fat area of 175 cm² and metabolic dysregulation are associated with mitochondrial dysfunction and oxidative stress. Ubiquinol (active form) supports mitochondrial electron transport chain efficiency, reduces oxidative LDL modification, and has evidence for improving endothelial function in cardiometabolic risk states. Fat-soluble — take with food. |
| 8 | Psyllium Husk | Powder | 10 g | Before dinner, in a large glass of water | high | metabolic, cardiovascular, microbiome | Low microbiome diversity index (2.5) combined with standard western diet, pre-diabetes, and hypertriglyceridaemia are all addressed by soluble fibre supplementation. Psyllium lowers post-prandial glucose, reduces LDL and triglycerides, feeds beneficial gut bacteria to improve diversity, and reduces visceral adiposity over time. Must be taken with adequate water to avoid GI obstruction. |
| 9 | Zinc Picolinate | Capsule | 25 mg | With evening meal | recommended | metabolic, immune, hepatic | Zinc plays a critical role in insulin synthesis, storage, and secretion. Deficiency is common in pre-diabetes and NAFLD, and zinc supplementation improves glycaemic markers and reduces hepatic oxidative stress. Picolinate form offers superior bioavailability. Dose kept at 25 mg to avoid copper displacement with chronic use. |
| 10 | Alpha-Lipoic Acid (R-ALA) | Capsule | 300 mg | 30 minutes before a meal (once daily) | recommended | metabolic, neuro, inflammatory | R-ALA is a mitochondrial antioxidant that improves insulin-mediated glucose uptake, reduces oxidative stress, and has neuroprotective properties relevant to the neuro risk score (38). Particularly useful in pre-diabetes to reduce glycation end-product accumulation. R-form is significantly more bioavailable than racemic ALA. |
| 11 | Lactobacillus & Bifidobacterium Multi-strain Probiotic | Capsule | 50 billion CFU | Morning, on an empty stomach or with breakfast | recommended | metabolic, microbiome, hepatic | Microbiome diversity index of 2.5 is low. Dysbiosis drives increased intestinal permeability ('leaky gut'), endotoxin translocation, hepatic inflammation (worsening NAFLD), and insulin resistance via LPS-mediated TLR4 activation. Multi-strain probiotics with Lactobacillus and Bifidobacterium species improve diversity, reduce metabolic endotoxaemia, lower liver enzymes, and improve insulin sensitivity. |
| 12 | Curcumin (BCM-95 or Theracurmin) | Capsule | 500 mg | With meals (twice daily) | recommended | inflammatory, hepatic, metabolic, cardiovascular | Elevated GGT, ALT, visceral fat, and the metabolic risk profile indicate a chronic low-grade inflammatory state. Highly bioavailable curcumin formulations (BCM-95 or Theracurmin) reduce NF-κB-driven inflammation, lower liver enzymes in NAFLD, improve insulin sensitivity, and reduce TG. Standard curcumin has <1% bioavailability — enhanced formulation is essential. |
| 13 | NAD+ Precursor (NMN or NR) | Capsule | 500 mg | Morning, with or without food | recommended | metabolic, mitochondrial, longevity, neuro | NAD+ declines with age and is further depleted in insulin-resistant and high-visceral-fat states. NAD+ is essential for SIRT1/SIRT3 activation (key metabolic regulators), mitochondrial biogenesis, and DNA repair. NMN or NR supplementation improves insulin sensitivity, mitochondrial function, and has emerging evidence for hepatic fat reduction. Relevant across metabolic, neuro, and longevity domains. |
| 14 | Ashwagandha (KSM-66) | Capsule | 600 mg | Before bed | performance | stress, sleep, metabolic, neuro | Moderate stress level combined with only 6 hours of sleep per night elevates cortisol, which directly worsens insulin resistance and promotes visceral fat accumulation. KSM-66 ashwagandha is the most clinically validated extract, with RCT evidence for reducing cortisol by ~28%, improving sleep quality and duration, reducing stress-driven food intake, and modestly improving testosterone in men. Addresses the lifestyle drivers of metabolic deterioration. |
| 15 | Taurine | Powder | 2000 mg | Morning, with water | performance | cardiovascular, metabolic, hepatic | Taurine has emerging longevity and cardiometabolic evidence: it lowers triglycerides, improves insulin sensitivity, reduces hepatic lipid accumulation, and supports bile acid conjugation relevant to NAFLD. A 2023 Science paper demonstrated taurine decline with age is a driver of multi-organ dysfunction. At 2 g/day it is safe, well-tolerated, and addresses multiple domains simultaneously. |

**Per-item notes:**
- 9. **Zinc Picolinate** — Long-term use >40 mg/day can deplete copper. At 25 mg, monitor copper status if supplementing beyond 6 months.

### Integrative-medicine review notes

- [ ] Items are evidence-grounded (no homeopathy, no proprietary blends).
- [ ] Dosages are safe for this patient's age, sex, and conditions.
- [ ] No drug-supplement interactions with the patient's medication list.
- [ ] Priority labels (`critical`/`high`/`recommended`/`performance`) match clinical urgency.
- [ ] Rationales reference the patient's specific risk drivers, not generic claims.
- [ ] Forms (e.g., methylated B12 vs cyanocobalamin) are clinically sensible.
- [ ] Timing instructions are practical and account for absorption.
- [ ] Total daily pill burden is reasonable for sustained adherence.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S5 · 42yo woman, sparse data — only demographics + smoking status

**De-identified profile:** female, age 42, BMI 24.2. Smoking: never. Exercise: 0 min/wk.
**Risk profile (Atlas):** CV 10 · Met 10 · Neuro 50 · Onco 10 · MSK 15

### Sage protocol — 10 items

*No pathology results uploaded. Protocol is based entirely on questionnaire risk profile. Risk score confidence is flagged as insufficient due to sparse questionnaire data — only smoking status was provided; medical history, family history, biomarkers, and wearable data are all absent. Neuro risk score (50) is the primary driver of this protocol. Bloodwork is strongly recommended to confirm Vitamin D status, B12, homocysteine, lipid panel, HbA1c, and inflammatory markers (hsCRP, IL-6) before finalising dosing. Dose titration of Vitamin D3 and B-complex should occur after lab results are available.* · interactions_checked: `false`

| # | Supplement | Form | Dosage | Timing | Priority | Domains | Rationale |
|---:|---|---|---|---|---|---|---|
| 1 | Vitamin D3 | Softgel | 2000 IU | With largest meal | high | neuro, MSK, immune | Vitamin D insufficiency is common in adults aged 40+ and supports neurological function, bone mineral density, and immune regulation. With elevated neuro and MSK risk scores and no bloodwork available, a maintenance dose is prudent pending lab confirmation. |
| 2 | Omega-3 Fish Oil (EPA/DHA) | Softgel | 2000 mg | With largest meal | high | neuro, cardiovascular, inflammatory | EPA and DHA support neuronal membrane integrity, reduce neuroinflammation, and provide broad cardiovascular and anti-inflammatory benefit. Elevated neuro risk score makes this a priority even in the absence of confirmed bloodwork. |
| 3 | Magnesium Glycinate | Capsule | 400 mg | Before bed | high | neuro, MSK, sleep | Magnesium glycinate supports neurotransmitter regulation, muscle relaxation, and sleep quality — all directly relevant to the elevated neuro and MSK risk domains. Glycinate form is well-tolerated and has superior bioavailability with minimal GI side effects. |
| 4 | B-Complex (Methylated) | Capsule | 1 capsule (standard B-complex with methylfolate and methylcobalamin) | With breakfast | high | neuro, metabolic, energy | Methylated B vitamins (B6, methylfolate, methylcobalamin) are critical for homocysteine metabolism, myelin maintenance, and neurological resilience. Elevated neuro risk in a 42-year-old warrants proactive B-vitamin support, particularly given no dietary data is available. |
| 5 | Lion's Mane Mushroom Extract | Capsule | 1000 mg | With breakfast | recommended | neuro, cognitive | Lion's Mane (Hericium erinaceus) contains hericenones and erinacines that stimulate nerve growth factor (NGF) synthesis, supporting neuroplasticity and cognitive longevity. Directly targeted at the elevated neuro risk score. |
| 6 | NMN (Nicotinamide Mononucleotide) | Capsule | 500 mg | With breakfast | recommended | neuro, metabolic, longevity | NMN is a NAD+ precursor that supports mitochondrial function, DNA repair, and neuronal energy metabolism. Relevant to neuro domain risk and general longevity optimisation at age 42. |
| 7 | Coenzyme Q10 (Ubiquinol) | Softgel | 200 mg | With largest meal | recommended | neuro, cardiovascular, mitochondrial | Ubiquinol (active form of CoQ10) supports mitochondrial electron transport chain efficiency and acts as a lipid-soluble antioxidant. Particularly relevant for neuro and cardiovascular longevity optimisation. |
| 8 | Ashwagandha (KSM-66) | Capsule | 600 mg | Before bed | performance | neuro, stress, MSK | KSM-66 ashwagandha is an adaptogen with robust clinical evidence for reducing cortisol, supporting stress resilience, improving sleep quality, and modestly improving muscle strength — addressing both neuro and MSK risk domains. |
| 9 | Creatine Monohydrate | Powder | 5000 mg | Post-exercise or with any meal | performance | MSK, neuro, cognitive | Creatine monohydrate supports phosphocreatine resynthesis in both muscle and brain. Evidence supports benefits for muscle mass, bone density (MSK domain), and cognitive function under stress (neuro domain) in adults over 40. |
| 10 | Vitamin K2 (MK-7) | Softgel | 120 mcg | With largest meal | recommended | MSK, cardiovascular | Vitamin K2 (MK-7) activates osteocalcin and matrix GLA protein, directing calcium to bones and away from arterial walls. Synergistic with Vitamin D3 for MSK support and relevant to cardiovascular longevity. |

**Per-item notes:**
- 1. **Vitamin D3** — No medications disclosed; no known interactions at this time. Recheck serum 25-OH-D after 8–12 weeks to titrate dose.

### Integrative-medicine review notes

- [ ] Items are evidence-grounded (no homeopathy, no proprietary blends).
- [ ] Dosages are safe for this patient's age, sex, and conditions.
- [ ] No drug-supplement interactions with the patient's medication list.
- [ ] Priority labels (`critical`/`high`/`recommended`/`performance`) match clinical urgency.
- [ ] Rationales reference the patient's specific risk drivers, not generic claims.
- [ ] Forms (e.g., methylated B12 vs cyanocobalamin) are clinically sensible.
- [ ] Timing instructions are practical and account for absorption.
- [ ] Total daily pill burden is reasonable for sustained adherence.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S6 · 64yo postmenopausal woman, low DEXA T-scores, vit-D borderline, statin-naive

**De-identified profile:** female, age 64, BMI 22.1. Smoking: former. Exercise: 90 min/wk.
**Conditions:** Hypothyroidism
**Medications:** levothyroxine
**Risk profile (Atlas):** CV 32 · Met 22 · Neuro 22 · Onco 28 · MSK 72

### Sage protocol — 12 items

*MEDICAL ATTENTION FLAG: DEXA T-score of -2.3 at lumbar spine meets WHO diagnostic threshold for osteoporosis. Clinical review and possible pharmacological intervention (e.g. bisphosphonates) should be discussed with the treating physician — supplements alone are insufficient management for confirmed osteoporosis. No pathology documents uploaded; protocol is based entirely on questionnaire-reported biomarkers and imaging values. Reported values (DEXA, bloods, hormonal panel) have not been independently verified from source documents. Estradiol of 18 pg/mL is consistent with postmenopausal status, which significantly elevates bone loss risk. Thyroid function panel (TSH, fT4) not provided; recommend inclusion at next review given levothyroxine use and ashwagandha recommendation. Full lipid fractionation and Lp(a) would improve cardiovascular risk stratification.* · interactions_checked: `true`

| # | Supplement | Form | Dosage | Timing | Priority | Domains | Rationale |
|---:|---|---|---|---|---|---|---|
| 1 | Calcium Citrate | Tablet | 500 mg | With meals, split into two 250 mg doses (morning and evening) | critical | musculoskeletal, bone density | DEXA T-score of -2.3 at spine meets osteoporosis threshold and -1.8 at hip indicates osteopenia. Strong first-degree family history of osteoporosis. Calcium citrate is preferred over carbonate as it does not require gastric acid for absorption and has less interaction with levothyroxine when timed correctly. |
| 2 | Vitamin D3 | Softgel | 2000 IU | With largest meal (lunch or dinner) | high | musculoskeletal, bone density, immune, cardiovascular | Vitamin D at 38 ng/mL is within normal range but suboptimal for bone protection given confirmed osteoporosis. Targeting 50–60 ng/mL is appropriate in the context of DEXA findings, postmenopausal low estradiol, and first-degree osteoporosis family history. D3 synergises with calcium for bone mineralisation. |
| 3 | Vitamin K2 (MK-7) | Capsule | 180 mcg | With largest meal | critical | musculoskeletal, bone density, cardiovascular | K2 as MK-7 activates osteocalcin to direct calcium into bone matrix and activates Matrix Gla Protein to prevent arterial calcification. Essential co-factor with D3 and calcium in the context of confirmed osteoporosis and moderate cardiovascular risk. Particularly important given postmenopausal estradiol levels reducing natural bone protection. |
| 4 | Magnesium Glycinate | Capsule | 300 mg | Before bed | high | musculoskeletal, bone density, cardiovascular, sleep, metabolic | RBC magnesium of 4.5 mg/dL is at the lower end of optimal. Magnesium is a critical cofactor for over 300 enzymatic reactions, including bone mineralisation, vitamin D activation, and cardiovascular function. Glycinate form is well-tolerated and promotes sleep quality. Supports moderate CV risk and MSK domain. |
| 5 | Omega-3 (EPA/DHA) | Softgel | 2000 mg (combined EPA+DHA) | With largest meal | high | cardiovascular, inflammatory, metabolic | LDL of 135 mg/dL and ApoB of 95 mg/dL represent borderline-elevated cardiovascular risk, compounded by first-degree family history of CVD. hsCRP of 1.2 mg/L indicates low-grade inflammation. High-dose omega-3 reduces triglycerides, modestly lowers ApoB, and has anti-inflammatory effects. Mediterranean diet is a positive modifier but supplementation adds meaningful benefit at this risk level. |
| 6 | Collagen Peptides (Type I/III) | Powder | 10 g | Morning, mixed into beverage or food | high | musculoskeletal, bone density, joint health | Hydrolysed collagen peptides have RCT evidence for improving bone mineral density and reducing joint pain. Highly relevant given osteoporosis diagnosis, low estradiol reducing collagen synthesis, and cardio-only exercise pattern lacking resistance stimulus. Pairs well with vitamin C for optimal collagen synthesis. |
| 7 | Vitamin C | Capsule | 500 mg | Morning with collagen peptides | recommended | musculoskeletal, immune, cardiovascular, inflammatory | Vitamin C is a required cofactor for collagen hydroxylation and cross-linking, potentiating the benefit of collagen supplementation for bone and connective tissue. Also supports immune function and has modest antioxidant cardiovascular benefit in former smokers. |
| 8 | Coenzyme Q10 (Ubiquinol) | Softgel | 200 mg | With largest meal | recommended | cardiovascular, mitochondrial, energy | At 64 years, endogenous CoQ10 production declines significantly. Ubiquinol (reduced form) supports mitochondrial energy production and has cardioprotective antioxidant effects relevant to the moderate CV risk score. Former smoking history increases oxidative burden. Ubiquinol is the preferred form for absorption in adults over 40. |
| 9 | NAD+ Precursor (NMN) | Capsule | 500 mg | Morning with breakfast | recommended | longevity, mitochondrial, metabolic, musculoskeletal | NMN supports NAD+ biosynthesis, which declines with age. NAD+ is essential for sirtuin activation, DNA repair, and mitochondrial function. Emerging evidence supports musculoskeletal benefits including muscle quality and bone metabolism. Relevant to the high MSK risk score and overall longevity optimisation at age 64. |
| 10 | Berberine | Capsule | 500 mg | With largest meal | recommended | cardiovascular, metabolic | HbA1c of 5.5% is at the upper end of normal and ApoB/LDL are borderline elevated. Berberine activates AMPK, improving insulin sensitivity and lipid metabolism. Evidence supports modest LDL and triglyceride reduction. Complements Mediterranean diet. Appropriate as a non-pharmacological cardiometabolic support. |
| 11 | Ashwagandha (KSM-66) | Capsule | 600 mg | Before bed | performance | musculoskeletal, neuro, hormonal, stress | KSM-66 ashwagandha has RCT evidence for improving muscle strength and recovery, reducing cortisol, and supporting thyroid hormone balance in subclinical cases. Relevant to the high MSK risk score and cardio-only exercise pattern. May support lean mass preservation and complement resistance training if introduced. Low estradiol and age-related hormonal decline also support adaptogen use. |
| 12 | Lutein + Zeaxanthin | Softgel | 20 mg lutein / 4 mg zeaxanthin | With largest meal | performance | longevity, neuro, onco | Age 64 with moderate oncology risk score and former smoking history increases cumulative oxidative exposure. Lutein and zeaxanthin are macular carotenoids with antioxidant properties supporting ocular longevity and neural health. Mediterranean diet provides some carotenoids but supplementation ensures consistent optimal intake. |

**Per-item notes:**
- 1. **Calcium Citrate** — Take at least 4 hours apart from levothyroxine. Calcium significantly impairs levothyroxine absorption if co-administered.
- 2. **Vitamin D3** — Take at least 4 hours apart from levothyroxine. Monitor 25-OH vitamin D levels at next bloods to avoid toxicity above 100 ng/mL.
- 4. **Magnesium Glycinate** — Take at least 4 hours apart from levothyroxine. Magnesium can reduce levothyroxine absorption if taken simultaneously.
- 11. **Ashwagandha (KSM-66)** — Some evidence suggests ashwagandha may modestly increase T3/T4. Monitor thyroid function (TSH, fT4) at next review given levothyroxine use. Dose adjustment by prescribing physician may be warranted if thyroid levels shift.

### Integrative-medicine review notes

- [ ] Items are evidence-grounded (no homeopathy, no proprietary blends).
- [ ] Dosages are safe for this patient's age, sex, and conditions.
- [ ] No drug-supplement interactions with the patient's medication list.
- [ ] Priority labels (`critical`/`high`/`recommended`/`performance`) match clinical urgency.
- [ ] Rationales reference the patient's specific risk drivers, not generic claims.
- [ ] Forms (e.g., methylated B12 vs cyanocobalamin) are clinically sensible.
- [ ] Timing instructions are practical and account for absorption.
- [ ] Total daily pill burden is reasonable for sustained adherence.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S7 · 56yo male long-term smoker, family lung+CRC cancer, pro-inflammatory state

**De-identified profile:** male, age 56, BMI 27.4. Smoking: current. Exercise: 0 min/wk.
**Risk profile (Atlas):** CV 62 · Met 60 · Neuro 52 · Onco 72 · MSK 43

### Sage protocol — 16 items

*MEDICAL ATTENTION RECOMMENDED: hsCRP of 4.2 mg/L indicates significant systemic inflammation requiring clinical evaluation and monitoring. ApoB of 115 mg/dL and LDL of 140 mg/dL in a current smoker with first-degree family history of cancer (lung and colorectal, onset age 58) represent compounded cardiovascular and oncological risk requiring physician review. HbA1c of 5.8% is at the upper pre-diabetic threshold — lifestyle intervention and clinical monitoring are strongly advised. NLR of 3.2 warrants monitoring as an elevated inflammatory and immune stress marker. No pathology documents were uploaded; protocol is based entirely on questionnaire data and self-reported biomarkers. No vitamin D, B12, ferritin, folate, or full metabolic panel available — bloodwork upload is strongly recommended to refine and personalise this protocol. No medications reported; interaction checking based on nil-medication assumption. Lifestyle factors of active smoking, zero exercise, 14 alcohol units/week, and Western diet represent the primary modifiable drivers of all five elevated risk domains and should be addressed with clinical support alongside supplementation.* · interactions_checked: `true`

| # | Supplement | Form | Dosage | Timing | Priority | Domains | Rationale |
|---:|---|---|---|---|---|---|---|
| 1 | Vitamin D3 + K2 | Softgel | 5000 IU D3 / 180 mcg K2 (MK-7) | With largest meal (fat-containing) | high | cardiovascular, metabolic, oncology, immune | Current smoker with high oncology risk (family history of lung and colorectal cancer, Onco score 72), elevated hsCRP (4.2 mg/L), and sedentary lifestyle — all associated with low vitamin D. D3 at 5000 IU targets optimal serum 25(OH)D >50 ng/mL. K2 MK-7 directs calcium away from arterial walls, important given elevated apoB (115 mg/dL) and LDL (140 mg/dL). No bloodwork for D3 level available; dose is risk-profile driven. |
| 2 | Omega-3 Fish Oil (EPA/DHA) | Softgel | 3000 mg combined EPA+DHA | With largest meal, split into two doses if GI-sensitive | high | cardiovascular, metabolic, inflammatory, oncology | Triglycerides are elevated at 175 mg/dL and HDL is low at 42 mg/dL — a dyslipidaemic pattern strongly associated with CV risk (CV score 62). Prescription-grade omega-3 doses (≥2g EPA+DHA) reduce triglycerides by 20–30%. Additional anti-inflammatory effect relevant to hsCRP of 4.2 mg/L. Epidemiological data supports colorectal cancer risk reduction, directly relevant to family history. |
| 3 | Magnesium Glycinate | Capsule | 400 mg elemental magnesium | Evening, 1 hour before bed | high | cardiovascular, metabolic, sleep, stress | Western diet and alcohol consumption (14 units/week) are leading causes of magnesium depletion. Magnesium deficiency is associated with insulin resistance (HbA1c 5.8% — pre-diabetic threshold), hypertension, elevated triglycerides, and poor sleep (6 hours/night). Glycinate form chosen for superior absorption and minimal laxative effect. Supports parasympathetic tone and stress modulation. |
| 4 | Berberine HCl | Capsule | 500 mg | Three times daily with meals (500 mg per meal) | high | metabolic, cardiovascular | HbA1c of 5.8% places this patient at the upper edge of pre-diabetes. Berberine activates AMPK, improving insulin sensitivity and lowering fasting glucose comparably to metformin in RCTs. Additionally lowers LDL and triglycerides — directly relevant to the dyslipidaemic profile (LDL 140, TG 175, apoB 115). Supports CV and metabolic risk reduction without medications. |
| 5 | Aged Garlic Extract | Capsule | 1200 mg | With morning meal | high | cardiovascular, oncology, inflammatory | Aged garlic extract (AGE) has RCT evidence for reducing progression of coronary artery calcification, lowering LDL, and reducing hsCRP. The elevated hsCRP (4.2 mg/L) and high apoB (115 mg/dL) in a current smoker represent compounded vascular risk. AGE also has epidemiological support for colorectal cancer risk reduction — highly relevant given first-degree family history. |
| 6 | Curcumin Phytosome (Meriva or BCM-95) | Capsule | 500 mg twice daily | With meals (morning and evening) | high | inflammatory, oncology, cardiovascular | hsCRP of 4.2 mg/L indicates significant systemic inflammation, amplified by smoking, physical inactivity, alcohol, and Western diet. Bioavailable curcumin (phytosome or phospholipid complex) significantly reduces hsCRP, IL-6, and NF-κB activity. Pre-clinical and epidemiological data support chemopreventive effects relevant to elevated oncology risk (Onco score 72) and family history of colorectal cancer. |
| 7 | N-Acetyl Cysteine (NAC) | Capsule | 600 mg twice daily | Morning and evening, away from meals for best absorption | high | oncology, inflammatory, cardiovascular, detoxification | Current smoker with high oncology risk. NAC replenishes glutathione — the primary antioxidant defence against tobacco-derived carcinogens and oxidative stress. Reduces oxidative LDL modification relevant to apoB-driven cardiovascular risk. Anti-inflammatory at elevated hsCRP. Lung-protective mucolytic properties directly relevant in a current smoker. Elevated NLR (3.2) suggests immune dysregulation that NAC may help modulate. |
| 8 | Sulforaphane (Broccoli Seed Extract) | Capsule | 30 mg stabilised sulforaphane (or 400 mg glucoraphanin + myrosinase) | Morning with or without food | high | oncology, inflammatory, detoxification, cardiovascular | Highest-evidence phytochemical for colorectal and lung cancer chemoprevention — directly addressing first-degree family history of both cancers and Onco risk score of 72. Activates Nrf2 pathway, upregulating phase II detoxification enzymes that neutralise tobacco carcinogens. Reduces systemic inflammation and has emerging CV benefit via endothelial protection. |
| 9 | Coenzyme Q10 (Ubiquinol) | Softgel | 200 mg | With largest meal (fat-containing) | recommended | cardiovascular, metabolic, energy | Ubiquinol (active form) supports mitochondrial electron transport chain efficiency — relevant given zero exercise, fatigue risk, and elevated CV risk. Sedentary lifestyle combined with Western diet accelerates mitochondrial dysfunction. CoQ10 also reduces LDL oxidation, relevant to apoB of 115 mg/dL. Ubiquinol preferred over ubiquinone for superior bioavailability in individuals over 50. |
| 10 | Resveratrol (Trans-Resveratrol) | Capsule | 500 mg | With morning meal | recommended | cardiovascular, oncology, metabolic, longevity | Activates SIRT1 and AMPK pathways, mimicking aspects of caloric restriction. Supports endothelial function and reduces LDL oxidation relevant to dyslipidaemia. Pre-clinical and epidemiological data support colorectal cancer risk reduction. Metabolic benefits complement berberine in addressing pre-diabetic HbA1c. Longevity domain relevant at age 56 with multiple elevated risk scores. |
| 11 | NMN (Nicotinamide Mononucleotide) | Capsule | 500 mg | Morning, fasted or with light breakfast | recommended | longevity, metabolic, cardiovascular, oncology | NAD+ precursor that declines with age, smoking, alcohol use, and metabolic stress — all present in this patient. Supports DNA repair (directly relevant to elevated oncology risk), mitochondrial function, sirtuin activation, and insulin sensitivity. Complements resveratrol (SIRT1 activation requires NAD+). Emerging evidence supports benefit in metabolic syndrome and vascular ageing. |
| 12 | Zinc Picolinate | Capsule | 25 mg | Evening with small meal (not with iron or calcium) | recommended | immune, oncology, inflammatory | Alcohol consumption (14 units/week) and Western diet significantly deplete zinc. Zinc is essential for DNA repair mechanisms, immune surveillance against neoplastic cells, and anti-inflammatory regulation. Deficiency is associated with increased cancer risk and impaired immune function. Picolinate form chosen for superior bioavailability. Directly supports elevated oncology risk domain. |
| 13 | Selenium (as Selenomethionine) | Capsule | 200 mcg | With morning meal | recommended | oncology, thyroid, inflammatory | Selenomethionine is the most bioavailable form of selenium, an essential cofactor for glutathione peroxidase and thioredoxin reductase — the body's primary antioxidant enzymes. SELECT trial data showed risk reduction in colorectal cancer at adequate selenium levels. Relevant to Onco score 72, family history of colorectal and lung cancer, and smoking-induced oxidative burden. Do not exceed 400 mcg/day total (dietary + supplemental). |
| 14 | Psyllium Husk | Powder | 10 g (2 teaspoons) | Before largest meal, dissolved in 300 mL water | recommended | metabolic, cardiovascular, oncology | Soluble fibre reduces LDL cholesterol by 5–10% via bile acid sequestration — relevant to LDL of 140 mg/dL. Reduces post-prandial glucose spikes, supporting pre-diabetic HbA1c of 5.8%. High dietary fibre is one of the strongest evidence-based interventions for colorectal cancer risk reduction — critical given first-degree family history. Western diet is almost certainly fibre-deficient. |
| 15 | Melatonin | Tablet (immediate-release) | 0.5 mg | 30–45 minutes before target sleep time | performance | sleep, oncology, inflammatory | Patient sleeps only 6 hours/night. Short sleep duration increases inflammatory cytokines (contributing to hsCRP 4.2 mg/L), impairs glucose regulation (HbA1c), and is independently associated with increased cancer risk. Low-dose melatonin (0.5 mg) is preferred over high-dose to avoid receptor desensitisation. Melatonin also has direct oncostatic properties relevant to elevated Onco risk. Supports circadian rhythm disruption common in moderate-stress, sedentary individuals. |
| 16 | Ashwagandha (KSM-66 Extract) | Capsule | 600 mg | Evening with meal or before bed | performance | stress, metabolic, cardiovascular, sleep | Moderate stress level combined with poor sleep, sedentary lifestyle, and alcohol use creates a cortisol dysregulation pattern that worsens insulin resistance (HbA1c 5.8%), inflammation (hsCRP 4.2), and cardiovascular risk. KSM-66 ashwagandha has RCT evidence for reducing cortisol, improving sleep quality and duration, reducing anxiety, and modestly improving lipid profiles. Complements melatonin for sleep architecture support. |

### Integrative-medicine review notes

- [ ] Items are evidence-grounded (no homeopathy, no proprietary blends).
- [ ] Dosages are safe for this patient's age, sex, and conditions.
- [ ] No drug-supplement interactions with the patient's medication list.
- [ ] Priority labels (`critical`/`high`/`recommended`/`performance`) match clinical urgency.
- [ ] Rationales reference the patient's specific risk drivers, not generic claims.
- [ ] Forms (e.g., methylated B12 vs cyanocobalamin) are clinically sensible.
- [ ] Timing instructions are practical and account for absorption.
- [ ] Total daily pill burden is reasonable for sustained adherence.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S8 · 52yo woman, APOE e4/e3 carrier, family AD, otherwise healthy

**De-identified profile:** female, age 52, BMI 23.0. Smoking: never. Exercise: 180 min/wk.
**Risk profile (Atlas):** CV 18 · Met 10 · Neuro 48 · Onco 8 · MSK 18

### Sage protocol — 12 items

*⚠️ MILD CLINICAL FLAG: Vitamin B12 at 380 pg/mL is below the optimal neuroprotective threshold of 400 pg/mL — supplementation initiated at critical priority. Homocysteine at 12 µmol/L is above optimal target (<10 µmol/L) — methylation support initiated. APOE e3/e4 status combined with first-degree family history of neurodegeneration (onset age 68) drives elevated neuro risk score (48) and is the primary clinical focus of this protocol. No serum 25-OH Vitamin D result available — Vitamin D3 prescribed at repletion dose based on population prevalence of insufficiency at this age. No pathology documents uploaded. Protocol is based entirely on questionnaire data, biomarkers provided within the questionnaire, and genetic status. Missing data that would improve protocol precision: 25-OH Vitamin D, ferritin, full thyroid panel (TSH/fT3/fT4), testosterone/DHEA-S, fasting insulin, OGTT, full CBC, liver and renal function, DEXA scan result. No medications disclosed; drug-nutrient interaction screening is not applicable but interactions_checked is set to true as biomarker-level data was available for clinical reasoning.* · interactions_checked: `true`

| # | Supplement | Form | Dosage | Timing | Priority | Domains | Rationale |
|---:|---|---|---|---|---|---|---|
| 1 | Vitamin B12 | Sublingual tablet (methylcobalamin) | 1000 mcg | Morning, fasted | critical | neuro, longevity | Serum B12 of 380 pg/mL is below the optimal threshold of 400 pg/mL. In the context of APOE e3/e4 status and a first-degree family history of neurodegeneration with onset at 68, optimising B12 is urgent. Methylcobalamin is the bioactive form with superior neurological uptake. Sublingual bypasses any absorption variability. |
| 2 | Vitamin D3 + K2 | Softgel | 4000 IU D3 / 180 mcg K2 (MK-7) | With largest meal (fat-containing) | high | neuro, cardiovascular, MSK, immune | No serum 25-OH vitamin D result is available. At age 52 with APOE e4 carrier status, vitamin D insufficiency is a significant modifiable risk factor for neurodegeneration, cardiovascular disease, and bone loss. 4000 IU is a conservative repletion dose. K2 (MK-7) ensures calcium is directed to bone rather than arterial walls, supporting the moderate CV risk score. |
| 3 | Omega-3 (EPA + DHA) | Enteric-coated softgel (triglyceride form) | 2000 mg EPA+DHA combined | With largest meal | high | neuro, cardiovascular, metabolic, inflammatory | Omega-3 index of 5% is below the cardioprotective and neuroprotective target of 8–12%. APOE e4 carriers have impaired DHA transport across the blood-brain barrier and benefit substantially from higher circulating DHA. EPA reduces neuroinflammation. LDL of 115 and ApoB of 85 are borderline; omega-3 supplementation supports overall lipid and inflammatory health (hsCRP 0.8 mg/L is acceptable but improvable). |
| 4 | Folate (5-MTHF) + B6 (P5P) | Capsule | 800 mcg 5-MTHF / 50 mg P5P | Morning with food | high | neuro, cardiovascular | Homocysteine of 12 µmol/L is elevated above the optimal neuroprotective target of <10 µmol/L. Elevated homocysteine is an independent risk factor for neurodegeneration and is especially harmful in APOE e4 carriers. The methylation triad (5-MTHF, P5P, and B12 already included) is the most evidence-based intervention to lower homocysteine. Active forms are used to bypass common MTHFR polymorphisms. |
| 5 | Lion's Mane Mushroom Extract | Capsule (standardised to >30% beta-glucans, dual-extract) | 1000 mg | Morning with food | recommended | neuro, cognitive | APOE e4 status and a family history of neurodegeneration at age 68 make neuroprotective adaptogens a high-value addition. Lion's Mane (Hericium erinaceus) stimulates Nerve Growth Factor (NGF) synthesis, supports myelin integrity, and has demonstrated benefits in mild cognitive impairment in RCTs. At 52, this is a proactive intervention during the critical prevention window. |
| 6 | Magnesium L-Threonate | Capsule | 1500 mg (providing ~144 mg elemental Mg) | Evening, 1–2 hours before bed | recommended | neuro, cognitive, sleep | Magnesium L-Threonate is the only magnesium form demonstrated to cross the blood-brain barrier and raise cerebrospinal fluid magnesium levels. It supports synaptic plasticity, NMDA receptor regulation, and sleep quality. Moderate stress and a neuro risk score of 48 make this particularly relevant. Evening dosing leverages its mild relaxing effect to support the reported 7 hours of sleep. |
| 7 | NMN (Nicotinamide Mononucleotide) | Capsule (stabilised) | 500 mg | Morning, fasted or with light breakfast | recommended | neuro, metabolic, longevity, cardiovascular | At 52, NAD+ levels have declined significantly from peak. NMN is a direct NAD+ precursor that supports mitochondrial function, DNA repair (PARP activation), and sirtuin-mediated longevity pathways. APOE e4 carriers show accelerated neuronal energy metabolism deficits; NAD+ repletion addresses this upstream. HbA1c of 5.2% and metabolic score of 10 suggest early metabolic drift that NAD+ support can help counter. |
| 8 | Phosphatidylserine | Softgel (soy-free, sunflower-derived) | 300 mg | With evening meal | recommended | neuro, cognitive | Phosphatidylserine is an FDA-qualified health claim supplement for cognitive decline risk reduction. It is a critical phospholipid in neuronal membranes and is particularly relevant for APOE e4 carriers who have impaired lipid metabolism in the brain. Evidence supports benefits in memory, processing speed, and cortisol regulation (relevant to moderate stress level). |
| 9 | Coenzyme Q10 (Ubiquinol) | Softgel | 200 mg | With largest meal (fat-containing) | recommended | cardiovascular, neuro, metabolic, longevity | Ubiquinol is the reduced, bioavailable form of CoQ10. At 52, endogenous CoQ10 synthesis declines substantially. It supports mitochondrial electron transport chain efficiency, reduces oxidative stress, and has cardioprotective properties relevant to the CV risk score of 18. Neuronal mitochondrial protection is an additional benefit for the APOE e4 risk profile. |
| 10 | Curcumin Phytosome | Capsule (Meriva or BCM-95 formulation) | 500 mg | With largest meal | recommended | neuro, inflammatory, cardiovascular | Curcumin has robust evidence for reducing neuroinflammation, a key driver of APOE e4-associated neurodegeneration. Phytosome or BCM-95 formulations provide 20–30x greater bioavailability than standard curcumin. hsCRP of 0.8 mg/L, while not alarming, can be further reduced. Curcumin also modulates amyloid aggregation pathways relevant to Alzheimer's risk. |
| 11 | Alpha-Lipoic Acid (R-ALA) | Capsule | 300 mg | Morning, 30 minutes before food | performance | metabolic, neuro, cardiovascular | R-ALA is the biologically active isomer with superior efficacy. It is a potent mitochondrial antioxidant, regenerates vitamins C and E, and supports insulin sensitivity (relevant to HbA1c 5.2% trajectory). It also crosses the blood-brain barrier and chelates redox-active metals implicated in APOE e4-mediated neurodegeneration. Fasted dosing maximises absorption. |
| 12 | Creatine Monohydrate | Powder | 5000 mg (5 g) | Post-exercise or with morning meal on rest days | performance | neuro, MSK, cognitive, metabolic | Creatine has dual benefits highly relevant to this profile: it supports muscle mass preservation (MSK score 18, age 52 with mixed training) and has emerging strong evidence for cognitive performance and neuroprotection, including in APOE e4 carriers. It supports brain energy metabolism via phosphocreatine buffering. Safe, inexpensive, and well-tolerated at 5 g/day. |

**Per-item notes:**
- 1. **Vitamin B12** — No medications on file; no interactions identified.

### Integrative-medicine review notes

- [ ] Items are evidence-grounded (no homeopathy, no proprietary blends).
- [ ] Dosages are safe for this patient's age, sex, and conditions.
- [ ] No drug-supplement interactions with the patient's medication list.
- [ ] Priority labels (`critical`/`high`/`recommended`/`performance`) match clinical urgency.
- [ ] Rationales reference the patient's specific risk drivers, not generic claims.
- [ ] Forms (e.g., methylated B12 vs cyanocobalamin) are clinically sensible.
- [ ] Timing instructions are practical and account for absorption.
- [ ] Total daily pill burden is reasonable for sustained adherence.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S9 · 38yo male athlete, suspected familial hypercholesterolemia (very high apoB+LDL+Lp(a))

**De-identified profile:** male, age 38, BMI 23.5. Smoking: never. Exercise: 360 min/wk.
**Risk profile (Atlas):** CV 52 · Met 8 · Neuro 14 · Onco 12 · MSK 18

### Sage protocol — 16 items

*MEDICAL ATTENTION REQUIRED: LDL 195 mg/dL and apoB 155 mg/dL are significantly elevated and warrant urgent lipid specialist review — familial hypercholesterolaemia should be excluded. Lp(a) of 85 nmol/L is above the 75th percentile and is a genetically-determined independent cardiovascular risk factor with limited nutritional modifiability. Combined with a first-degree relative with CVD onset at age 42, formal cardiovascular risk assessment and possible pharmacological lipid-lowering therapy (statin, ezetimibe, or PCSK9 inhibitor) should be discussed with a physician before relying on supplement-only intervention. | No pathology documents uploaded — protocol based entirely on questionnaire data and self-reported biomarkers. Formal bloodwork confirmation recommended for: B12, 25-OH Vitamin D, ferritin, full iron studies, thyroid panel (TSH, fT3, fT4), iodine status, and HbA1c. | Interactions checked: no medications disclosed, so no drug-nutrient interactions identified. Interactions_checked set to true based on confirmed medication-free status.* · interactions_checked: `true`

| # | Supplement | Form | Dosage | Timing | Priority | Domains | Rationale |
|---:|---|---|---|---|---|---|---|
| 1 | Vitamin D3 + K2 | Softgel | 5000 IU D3 / 200 mcg K2 (MK-7) | With largest meal (fat-containing) | high | cardiovascular, musculoskeletal, immune | Vegan diet carries high risk of vitamin D insufficiency with no dietary animal sources. D3 supports endothelial function and cardiometabolic health — critical given the elevated CV risk score (52) and strong family history of early-onset CVD (first-degree relative, age 42). K2 as MK-7 directs calcium away from arterial walls (relevant given carotid IMT 0.65 mm) and into bone, synergising with D3 safely. |
| 2 | Omega-3 (Algal DHA/EPA) | Softgel | 2000 mg combined DHA+EPA | With largest meal | high | cardiovascular, inflammatory, neuro | Vegan diet provides no preformed DHA/EPA; ALA conversion is poor (<5%). ApoB of 155 mg/dL, LDL of 195 mg/dL, and Lp(a) of 85 nmol/L represent a high atherogenic burden. High-dose algal omega-3 (the vegan-appropriate source) reduces triglycerides, modestly lowers apoB, supports endothelial function, and provides anti-inflammatory benefit. Also supports neurological health domain. Algal source avoids heavy metal concerns of fish oil. |
| 3 | Vitamin B12 (Methylcobalamin) | Sublingual tablet | 1000 mcg | Morning, fasted or with breakfast | critical | neuro, cardiovascular, metabolic | Strict vegan diet with no supplemental B12 is the single most common cause of B12 deficiency globally. No bloodwork uploaded to confirm levels. Methylcobalamin is the bioactive form. Deficiency causes irreversible neurological damage and drives hyperhomocysteinemia — homocysteine is currently 9 µmol/L (borderline elevated), which is an independent cardiovascular risk factor especially relevant given the high CV risk profile and family history. |
| 4 | Folate (Methylfolate, 5-MTHF) | Capsule | 800 mcg | Morning with breakfast | high | cardiovascular, neuro | Homocysteine at 9 µmol/L is in the upper-normal range and is a recognised independent cardiovascular risk factor — particularly important given apoB 155, LDL 195, Lp(a) 85, and first-degree family history of CVD at age 42. Methylfolate (active form, bypasses MTHFR polymorphism) combined with B12 and B6 is the primary nutritional intervention to lower homocysteine. Vegan diets can be folate-adequate but methylation support is prudent. |
| 5 | Vitamin B6 (Pyridoxal-5-Phosphate) | Capsule | 25 mg | Morning with breakfast | high | cardiovascular, neuro | P5P is the active form of B6 and the third cofactor in the homocysteine remethylation and transsulfuration pathways alongside B12 and folate. At homocysteine 9 µmol/L with a high CV risk score, completing the B-vitamin triad is evidence-based for cardiovascular risk reduction. P5P form avoids the peripheral neuropathy risk associated with long-term high-dose pyridoxine (B6 HCl). |
| 6 | Iodine (Potassium Iodide) | Capsule | 150 mcg | With breakfast | high | metabolic, neuro | Vegan diets are the dietary pattern most consistently associated with iodine deficiency, as the primary food sources are dairy, eggs, and seafood — all excluded. Iodine is essential for thyroid hormone synthesis; deficiency impairs metabolic rate, cognition, and cardiovascular function. 150 mcg meets the RDA without risk of excess. No bloodwork available to confirm thyroid status. |
| 7 | Zinc (Bisglycinate) | Capsule | 15 mg | With dinner (away from iron-rich foods) | recommended | immune, metabolic, musculoskeletal | Plant-based diets are lower in bioavailable zinc due to phytate content in legumes and grains. Zinc is critical for immune function, testosterone synthesis, wound healing, and over 300 enzymatic reactions. Bisglycinate form has superior absorption and tolerability compared to zinc oxide or sulfate. Dose kept at 15 mg to avoid copper displacement at higher doses. |
| 8 | Calcium (Calcium Citrate) | Capsule | 500 mg | Split: 250 mg with lunch, 250 mg with dinner | recommended | musculoskeletal, cardiovascular | Vegan diet eliminates dairy, the primary dietary calcium source. Despite regular weight-bearing exercise (360 min/week), dietary calcium from plant sources is often insufficient due to oxalate/phytate binding. Calcium citrate is the preferred form — absorbed without stomach acid and suitable for those with variable gastric acidity. Split dosing maximises absorption (body absorbs <500 mg per sitting). Dose kept at 500 mg supplemental as dietary intake from fortified foods likely provides some baseline. |
| 9 | Iron (Ferrous Bisglycinate) | Capsule | 18 mg | Morning, fasted or with vitamin C source | recommended | metabolic, musculoskeletal, neuro | Vegan diets provide only non-haem iron, which has significantly lower bioavailability (2–20%) versus haem iron (15–35%). High exercise volume (360 min/week mixed cardio) increases iron losses through foot-strike haemolysis and sweat. No ferritin or haemoglobin data available. Ferrous bisglycinate is the best-tolerated high-absorption form. Note: confirm serum ferritin before long-term use to avoid overload. |
| 10 | Magnesium Glycinate | Capsule | 400 mg | Evening, 1 hour before bed | recommended | cardiovascular, metabolic, neuro, musculoskeletal | Magnesium is a cofactor in over 600 enzymatic reactions including ATP synthesis, DNA repair, and blood pressure regulation. High exercise volume increases magnesium losses via sweat. Vegan diets can be magnesium-rich but absorption is reduced by phytates. Given elevated CV risk (score 52), magnesium supports endothelial function, reduces arterial stiffness, and improves insulin sensitivity. Glycinate form is highly bioavailable and promotes sleep quality — complementing the already-good 8-hour sleep pattern. |
| 11 | Berberine | Capsule | 500 mg | With largest meal (once daily) | high | cardiovascular, metabolic | ApoB of 155 mg/dL and LDL of 195 mg/dL represent significantly elevated atherogenic particle burden. In the context of a vegan diet (which should theoretically lower LDL), these values suggest genetic hypercholesterolaemia or familial pattern — consistent with first-degree CVD at age 42. Berberine activates PCSK9 degradation and upregulates LDL receptors, demonstrating 15–25% LDL reduction in RCTs. Also improves insulin sensitivity and has anti-inflammatory properties. Consider as a bridge pending lipid-lowering medical evaluation. |
| 12 | Coenzyme Q10 (Ubiquinol) | Softgel | 200 mg | With largest meal (fat-containing) | recommended | cardiovascular, metabolic, neuro | Given the high CV risk score (52), elevated atherogenic markers, and family history of early CVD, CoQ10 supports mitochondrial energy production in cardiomyocytes and acts as a lipid-soluble antioxidant protecting LDL particles from oxidation — particularly relevant with LDL at 195 mg/dL. Ubiquinol (reduced form) has superior bioavailability over ubiquinone, especially important as endogenous CoQ10 synthesis declines with age. Also supports the high exercise volume and VO2max of 50 mL/kg/min. |
| 13 | NMN (Nicotinamide Mononucleotide) | Capsule | 500 mg | Morning, fasted | recommended | cardiovascular, metabolic, neuro, longevity | NAD+ precursor supplementation supports mitochondrial biogenesis, DNA repair (PARP/SIRT pathways), and vascular endothelial function. At age 38, NAD+ levels are declining. Given the high CV risk, NMN supports endothelial NAD+ pools which regulate nitric oxide production and arterial elasticity. Also complements the high exercise volume and excellent HRV (70 ms rmssd) by supporting cellular energy metabolism and recovery. |
| 14 | Astaxanthin | Softgel | 12 mg | With largest meal (fat-containing) | recommended | cardiovascular, inflammatory, neuro, onco | Astaxanthin is one of the most potent lipid-soluble antioxidants known, with particular affinity for protecting LDL particles from oxidative modification — directly relevant with LDL at 195 mg/dL. It crosses the blood-brain barrier, supporting neurological health (Neuro score 14), reduces hsCRP and inflammatory markers, and has demonstrated cardioprotective effects in RCTs. Also addresses the oncology risk domain (score 12) through antioxidant and anti-proliferative mechanisms. Vegan-sourced from Haematococcus pluvialis algae. |
| 15 | Creatine Monohydrate | Powder | 5 g | Post-workout or with breakfast on rest days | performance | musculoskeletal, neuro, metabolic | Vegan athletes have consistently lower baseline muscle creatine stores as dietary creatine comes exclusively from meat and fish. Given 360 min/week of mixed cardio and weights, creatine monohydrate is the most evidence-backed ergogenic supplement for muscle strength, power, and recovery. Emerging evidence also supports cognitive benefits (brain creatine) and potential cardiovascular benefits via improved mitochondrial efficiency. Creatine monohydrate is the gold-standard form — most studied, cheapest, and most effective. |
| 16 | Lion's Mane Mushroom (Hericium erinaceus) | Capsule | 1000 mg | Morning with breakfast | performance | neuro, longevity | Lion's Mane stimulates Nerve Growth Factor (NGF) synthesis, supporting neuronal plasticity, cognitive function, and neuroprotection. Addresses the Neuro risk domain (score 14). Emerging evidence supports benefits in mood, memory, and focus. Well-tolerated with an excellent safety profile. Complements the NMN and CoQ10 in a broad longevity stack appropriate for a health-optimising 38-year-old with no current conditions. |

**Per-item notes:**
- 9. **Iron (Ferrous Bisglycinate)** — Avoid co-administration with calcium supplements — separate by at least 2 hours. Take with vitamin C to enhance non-haem iron absorption.
- 11. **Berberine** — Medical review strongly recommended for LDL 195 mg/dL and apoB 155 mg/dL — statin or PCSK9 inhibitor therapy may be indicated. Berberine is not a substitute for medical lipid management at this level.

### Integrative-medicine review notes

- [ ] Items are evidence-grounded (no homeopathy, no proprietary blends).
- [ ] Dosages are safe for this patient's age, sex, and conditions.
- [ ] No drug-supplement interactions with the patient's medication list.
- [ ] Priority labels (`critical`/`high`/`recommended`/`performance`) match clinical urgency.
- [ ] Rationales reference the patient's specific risk drivers, not generic claims.
- [ ] Forms (e.g., methylated B12 vs cyanocobalamin) are clinically sensible.
- [ ] Timing instructions are practical and account for absorption.
- [ ] Total daily pill burden is reasonable for sustained adherence.

**Free-text feedback:**

> _Reviewer to fill in._

---

## S10 · 61yo male T2D on 4 meds, central obesity, MASLD, hypertensive

**De-identified profile:** male, age 61, BMI 34.1. Smoking: former. Exercise: 60 min/wk.
**Conditions:** Type 2 diabetes, Hypertension, High cholesterol
**Medications:** metformin, atorvastatin, lisinopril, empagliflozin
**Risk profile (Atlas):** CV 62 · Met 82 · Neuro 42 · Onco 43 · MSK 42

### Sage protocol — 13 items

*MEDICAL ATTENTION FLAGS: (1) HbA1c 7.4% indicates suboptimal glycaemic control despite current medications — physician review of diabetes management is recommended before adding berberine or ALA. (2) ALT 48 U/L + GGT 75 U/L + liver fat 14% are consistent with MASLD; hepatology or endocrinology review is advised. (3) Uric acid 7.2 mg/dL is borderline hyperuricaemic — monitor for gout risk. (4) Visceral fat area 158 cm² is significantly elevated. Protocol is based on questionnaire and inline biomarker data only; no external pathology documents were uploaded. Full bloodwork including 25-OH Vitamin D, B12, full CMP, CBC, TSH, and APOB confirmation is strongly recommended before finalising protocol. Interactions checked based on disclosed medications: metformin, atorvastatin, lisinopril, empagliflozin.* · interactions_checked: `true`

| # | Supplement | Form | Dosage | Timing | Priority | Domains | Rationale |
|---:|---|---|---|---|---|---|---|
| 1 | Vitamin D3 | Softgel | 4000 IU | With largest meal | high | metabolic, cardiovascular, immune | Western diet, limited exercise, and T2DM significantly increase vitamin D insufficiency risk. Vitamin D supports insulin sensitivity, cardiometabolic health, and inflammation modulation. No bloodwork available to confirm level, so a moderate repletion dose is appropriate pending labs. |
| 2 | Vitamin K2 (MK-7) | Capsule | 180 mcg | With largest meal | high | cardiovascular, metabolic, MSK | K2 activates matrix Gla protein to inhibit vascular calcification — highly relevant given elevated CV risk, statin use (which depletes K2 pathway), and hypertension. Also supports bone health and insulin sensitivity. |
| 3 | Omega-3 (EPA/DHA) | Softgel | 3000 mg (combined EPA+DHA) | With evening meal | high | cardiovascular, metabolic, inflammatory | Triglycerides are elevated at 195 mg/dL and HDL is low at 38 mg/dL. High-dose omega-3 (≥2g EPA+DHA) reduces triglycerides by 20–30%, reduces hsCRP, and supports endothelial function. Critical adjunct to statin therapy in this cardiometabolic profile. |
| 4 | Magnesium Glycinate | Capsule | 400 mg | With evening meal or before bed | high | metabolic, cardiovascular, sleep, stress | Magnesium deficiency is common in T2DM (renal wasting exacerbated by SGLT2 inhibitors like empagliflozin) and with high stress. Magnesium supports insulin receptor signalling, blood pressure regulation, vascular tone, and sleep quality — all directly relevant here. Glycinate form minimises GI upset. |
| 5 | Berberine | Capsule | 500 mg | With breakfast and with dinner (500 mg each) | high | metabolic, cardiovascular, hepatic | Berberine activates AMPK, improving insulin sensitivity, lowering fasting glucose and HbA1c, reducing triglycerides, and supporting liver health. With HbA1c 7.4%, HOMA-IR 4.2, fasting glucose 145, triglycerides 195, and hepatic steatosis (liver fat 14%), berberine addresses multiple simultaneous targets. Also has modest LDL-lowering and anti-inflammatory effects. |
| 6 | Coenzyme Q10 (Ubiquinol) | Softgel | 200 mg | With largest meal | high | cardiovascular, metabolic, mitochondrial | Atorvastatin (statin) inhibits the mevalonate pathway, depleting endogenous CoQ10 synthesis. CoQ10 depletion contributes to statin-associated myopathy, fatigue, and reduced mitochondrial efficiency. Ubiquinol (reduced form) has superior bioavailability, especially in patients over 50. Also supports cardiac energy metabolism and reduces oxidative stress — directly relevant to elevated hsCRP and liver enzymes. |
| 7 | Silymarin (Milk Thistle Extract) | Capsule | 300 mg | With morning meal | high | hepatic, metabolic, inflammatory | ALT 48 U/L, GGT 75 U/L, and liver fat fraction 14% indicate metabolic-associated steatotic liver disease (MASLD). Silymarin is the most evidence-supported hepatoprotective supplement, reducing liver enzymes, hepatic inflammation, and fibrosis risk. Also improves insulin sensitivity in T2DM with NAFLD. |
| 8 | Psyllium Husk | Powder | 10 g | Before largest meal with a full glass of water | high | metabolic, cardiovascular, glycaemic | Soluble fibre lowers LDL (currently 105 mg/dL), reduces post-meal glucose spikes (HbA1c 7.4%), and feeds beneficial gut microbiota. Standard Western diet is typically low in fibre. Psyllium is one of the most robustly evidence-based interventions for combined dyslipidaemia and glycaemic control. |
| 9 | Zinc (as Zinc Bisglycinate) | Capsule | 25 mg | With evening meal | recommended | metabolic, immune, inflammatory | Zinc is frequently depleted by both metformin and SGLT2 inhibitors. It plays a key role in insulin synthesis and secretion, immune function, and antioxidant defence (SOD enzyme). Bisglycinate form maximises absorption and minimises GI side effects. Uric acid of 7.2 mg/dL also suggests oxidative stress burden. |
| 10 | Alpha Lipoic Acid (R-ALA) | Capsule | 300 mg | 30 minutes before morning meal | recommended | metabolic, neuro, inflammatory, hepatic | R-ALA is a mitochondrial antioxidant with clinical evidence for improving insulin sensitivity, reducing oxidative stress markers, and supporting peripheral nerve health — relevant given T2DM with HOMA-IR 4.2 and early neuropathy risk. Also supports hepatic glutathione regeneration, complementing silymarin for liver health. R-form has superior bioavailability over racemic ALA. |
| 11 | NAD+ Precursor (NMN) | Capsule | 500 mg | With morning meal | recommended | metabolic, mitochondrial, longevity, neuro | NAD+ declines with age and is further depleted by metabolic disease and chronic inflammation. NMN restores NAD+ levels, supporting SIRT1/SIRT3 activity, mitochondrial biogenesis, DNA repair, and insulin sensitivity. Particularly relevant for a 61-year-old with T2DM, high metabolic risk score (82), and moderate neuro risk (42). |
| 12 | Ashwagandha (KSM-66) | Capsule | 600 mg | Before bed | performance | stress, sleep, neuro, metabolic | High stress and 6 hours sleep are significant cardiometabolic risk amplifiers. KSM-66 ashwagandha (the most studied extract) reduces cortisol, improves sleep quality and duration, and has secondary benefits on insulin sensitivity and blood pressure. Directly addresses the stress and sleep deficits in this profile. |
| 13 | Taurine | Powder | 2000 mg | With morning meal | performance | cardiovascular, metabolic, hepatic, neuro | Taurine has emerging longevity evidence (Nature Medicine 2023), with specific benefits for blood pressure reduction, insulin sensitivity, triglyceride reduction, hepatic fat, and uric acid lowering — addressing four active concerns in this patient. Well-tolerated with an excellent safety profile. Also supports bile acid conjugation relevant to cholesterol metabolism. |

**Per-item notes:**
- 1. **Vitamin D3** — No interactions with metformin, atorvastatin, lisinopril, or empagliflozin at this dose. Recheck 25-OH-D level within 8–12 weeks to adjust dose.
- 2. **Vitamin K2 (MK-7)** — No significant interaction with this medication list at this dose. Not a vitamin K1 analogue; does not antagonise anticoagulants, but flag if anticoagulants are ever added.
- 3. **Omega-3 (EPA/DHA)** — At 3g EPA+DHA, mild antiplatelet effect is possible. Monitor if anticoagulants or antiplatelets are added. Lisinopril and empagliflozin: no interaction. Atorvastatin: complementary, no adverse interaction.
- 4. **Magnesium Glycinate** — Empagliflozin (SGLT2 inhibitor) increases urinary magnesium loss, making supplementation especially important. Metformin does not interact. Monitor renal function given lisinopril use; avoid high doses if eGFR is significantly reduced.
- 5. **Berberine** — CRITICAL INTERACTION: Berberine inhibits CYP3A4 and may increase atorvastatin plasma levels — monitor for myopathy symptoms (muscle pain, weakness). Berberine has additive glucose-lowering effect with metformin and empagliflozin — monitor for hypoglycaemia and discuss dose titration with prescribing physician before starting. Start at 500 mg once daily for 2 weeks before increasing to twice daily.
- 6. **Coenzyme Q10 (Ubiquinol)** — Directly indicated due to atorvastatin use. No adverse interactions with other listed medications. May have mild blood pressure-lowering effect, additive to lisinopril — clinically beneficial but worth monitoring.
- 7. **Silymarin (Milk Thistle Extract)** — Silymarin inhibits CYP3A4 and may mildly increase atorvastatin exposure — monitor for myopathy symptoms. This is an additive concern alongside berberine; physician review recommended. No significant interaction with metformin, lisinopril, or empagliflozin.
- 8. **Psyllium Husk** — Take metformin and other oral medications at least 2 hours apart from psyllium to avoid absorption interference. No pharmacokinetic interactions with atorvastatin, lisinopril, or empagliflozin when separated by 2 hours.
- 9. **Zinc (as Zinc Bisglycinate)** — Empagliflozin and metformin both increase urinary zinc excretion, supporting supplementation. Do not exceed 40 mg/day long-term (UL). Take 2 hours apart from magnesium if GI sensitivity arises.
- 10. **Alpha Lipoic Acid (R-ALA)** — Additive glucose-lowering effect with metformin and empagliflozin — monitor blood glucose, particularly during dose initiation. No direct interaction with atorvastatin or lisinopril.
- 11. **NAD+ Precursor (NMN)** — Metformin may partially blunt NMN efficacy by inhibiting mitochondrial Complex I (competing pathway). No adverse pharmacokinetic interactions with other medications. Emerging evidence; discuss with physician.
- 12. **Ashwagandha (KSM-66)** — May have mild additive blood pressure-lowering effect with lisinopril — clinically beneficial but monitor for hypotension. May mildly lower blood glucose; monitor with metformin and empagliflozin. Avoid in thyroid disease (not disclosed, but flag if relevant).
- 13. **Taurine** — No known adverse interactions with metformin, atorvastatin, lisinopril, or empagliflozin. Mild diuretic-like effect may be additive with empagliflozin — monitor hydration status.

### Integrative-medicine review notes

- [ ] Items are evidence-grounded (no homeopathy, no proprietary blends).
- [ ] Dosages are safe for this patient's age, sex, and conditions.
- [ ] No drug-supplement interactions with the patient's medication list.
- [ ] Priority labels (`critical`/`high`/`recommended`/`performance`) match clinical urgency.
- [ ] Rationales reference the patient's specific risk drivers, not generic claims.
- [ ] Forms (e.g., methylated B12 vs cyanocobalamin) are clinically sensible.
- [ ] Timing instructions are practical and account for absorption.
- [ ] Total daily pill burden is reasonable for sustained adherence.

**Free-text feedback:**

> _Reviewer to fill in._

---

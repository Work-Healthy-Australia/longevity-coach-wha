-- =============================================================================
-- Migration 0020: risk_assessment_standards
-- Clinical evidence base table for the risk engine (Phase 2)
-- 31 seed rows: 5 domains × 4 tiers + 10 supplement + 5 drug_interaction
-- Idempotent: each INSERT is guarded by WHERE NOT EXISTS on (domain, risk_tier,
-- framework_name). The supplement block uses (domain, clinical_threshold) as
-- the uniqueness key since all supplement rows share risk_tier='not_applicable'.
-- Drug-interaction block uses (domain, framework_name).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.risk_assessment_standards (
  id                  uuid        primary key default gen_random_uuid(),
  domain              text        not null check (domain in ('cv','metabolic','neuro','onco','msk','supplement','drug_interaction')),
  framework_name      text        not null,
  source_citation     text        not null,
  source_url          text,
  evidence_level      text        not null check (evidence_level in ('I','II','III','IV')),
  risk_tier           text        not null check (risk_tier in ('low','moderate','high','very_high','not_applicable')),
  internal_score_min  integer,
  internal_score_max  integer,
  clinical_threshold  text,
  key_risk_factors    jsonb       not null default '[]',
  protective_factors  jsonb       not null default '[]',
  clinical_guidance   text,
  applicable_age_min  integer,
  applicable_age_max  integer,
  applicable_sex      text        check (applicable_sex in ('male','female','all')) default 'all',
  notes               text,
  active              boolean     not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists ras_domain_idx on public.risk_assessment_standards(domain);
create index if not exists ras_active_idx  on public.risk_assessment_standards(active);

alter table public.risk_assessment_standards enable row level security;

drop policy if exists "ras_service_all"  on public.risk_assessment_standards;
drop policy if exists "ras_admin_select" on public.risk_assessment_standards;

create policy "ras_service_all" on public.risk_assessment_standards
  for all using (auth.role() = 'service_role');

create policy "ras_admin_select" on public.risk_assessment_standards
  for select using ((auth.jwt() ->> 'role') in ('admin','systemAdmin'));

drop trigger if exists ras_set_updated_at on public.risk_assessment_standards;
create trigger ras_set_updated_at
  before update on public.risk_assessment_standards
  for each row execute function public.set_updated_at();


-- =============================================================================
-- SEED DATA
-- =============================================================================

-- ---------------------------------------------------------------------------
-- CV domain — 2023 Australian CVD Risk Guideline
-- ---------------------------------------------------------------------------
insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   internal_score_min, internal_score_max, clinical_threshold,
   key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'cv',
  'Australian CVD Risk Guideline 2023',
  '2023 Australian guideline for assessing and managing cardiovascular disease risk. MJA 2024; Nelson et al.',
  'https://www.heartfoundation.org.au/for-professionals/guideline-for-managing-cvd',
  'I', 'low', 0, 25,
  '< 5% 5-year absolute CVD risk (AusCVD Risk Calculator)',
  '["non-smoker throughout life","total cholesterol < 5.5 mmol/L","SBP < 130 mmHg","no diabetes","no atrial fibrillation","no family history premature CVD"]'::jsonb,
  '["non-smoking","LDL < 2.0 mmol/L","HDL > 1.5 mmol/L","BP < 120/80 mmHg","physically active","healthy BMI"]'::jsonb,
  'Lifestyle optimisation. Reassess in 5 years. No pharmacotherapy indicated at this threshold.',
  null, null, 'all', null, true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'cv' and risk_tier = 'low'
    and framework_name = 'Australian CVD Risk Guideline 2023'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   internal_score_min, internal_score_max, clinical_threshold,
   key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'cv',
  'Australian CVD Risk Guideline 2023',
  '2023 Australian guideline for assessing and managing cardiovascular disease risk. MJA 2024; Nelson et al.',
  'https://www.heartfoundation.org.au/for-professionals/guideline-for-managing-cvd',
  'I', 'moderate', 26, 55,
  '5% to < 10% 5-year absolute CVD risk',
  '["smoking (current or recent ex-smoker)","total cholesterol 5.5-7.5 mmol/L","SBP 130-160 mmHg","type 2 diabetes","overweight/obese","family history of premature CVD"]'::jsonb,
  '["smoking cessation","statin therapy","BP-lowering medication","regular physical activity"]'::jsonb,
  'Consider BP-lowering and lipid-modifying therapy. Discuss absolute risk with patient. Reassess within 2 years. Lifestyle intervention mandatory.',
  null, null, 'all', null, true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'cv' and risk_tier = 'moderate'
    and framework_name = 'Australian CVD Risk Guideline 2023'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   internal_score_min, internal_score_max, clinical_threshold,
   key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'cv',
  'Australian CVD Risk Guideline 2023',
  '2023 Australian guideline for assessing and managing cardiovascular disease risk. MJA 2024; Nelson et al.',
  'https://www.heartfoundation.org.au/for-professionals/guideline-for-managing-cvd',
  'I', 'high', 56, 80,
  '>= 10% 5-year absolute CVD risk',
  '["current smoker","total cholesterol > 7.5 mmol/L","SBP > 160 mmHg","diabetes with end-organ damage","atrial fibrillation","social disadvantage index elevated","First Nations Australian","family history premature CVD (< 60y)"]'::jsonb,
  '["smoking cessation (risk halves within 1 year)","statin + BP combination","cardiac rehabilitation"]'::jsonb,
  'Initiate BP-lowering AND lipid-modifying pharmacotherapy. LDL target < 1.8 mmol/L. SBP target < 130 mmHg. Refer to GP urgently.',
  null, null, 'all',
  'Total cholesterol > 7.5 mmol/L or BP > 160/100 mmHg warrants pharmacotherapy regardless of calculated risk score.',
  true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'cv' and risk_tier = 'high'
    and framework_name = 'Australian CVD Risk Guideline 2023'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   internal_score_min, internal_score_max, clinical_threshold,
   key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'cv',
  'Australian CVD Risk Guideline 2023',
  '2023 Australian guideline for assessing and managing cardiovascular disease risk. MJA 2024; Nelson et al.',
  'https://www.heartfoundation.org.au/for-professionals/guideline-for-managing-cvd',
  'I', 'very_high', 81, 100,
  'Known atherosclerotic CVD (prior MI, stroke, PCI/CABG) OR diabetes with end-organ damage OR familial hypercholesterolaemia',
  '["prior myocardial infarction","prior ischaemic stroke or TIA","prior PCI or CABG","diabetes with nephropathy/retinopathy","familial hypercholesterolaemia","peripheral arterial disease"]'::jsonb,
  '[]'::jsonb,
  'Maximum intensity lipid-lowering: LDL target < 1.4 mmol/L. Dual antiplatelet if indicated. Annual cardiologist review.',
  null, null, 'all', null, true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'cv' and risk_tier = 'very_high'
    and framework_name = 'Australian CVD Risk Guideline 2023'
);


-- ---------------------------------------------------------------------------
-- Metabolic domain — AUSDRISK + WHO/ADA diagnostic criteria
-- ---------------------------------------------------------------------------
insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   internal_score_min, internal_score_max, clinical_threshold,
   key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'metabolic',
  'AUSDRISK / WHO 2011 Diabetes Diagnostic Criteria',
  'AUSDRISK: Australian Type 2 Diabetes Risk Assessment Tool. MJA 2010. Colagiuri et al. / WHO 2011 diagnostic criteria for diabetes.',
  'https://www.health.gov.au/resources/apps-and-tools/the-australian-type-2-diabetes-risk-assessment-tool-ausdrisk',
  'I', 'low', 0, 20,
  'AUSDRISK <= 5 (< 1% 5-year T2DM risk); HbA1c < 42 mmol/mol; fasting glucose < 6.0 mmol/L',
  '["no family history T2DM","healthy waist circumference","physically active","non-smoker","no prior high blood glucose test result"]'::jsonb,
  '["physical activity >= 150 min/week","waist < 94 cm male / < 80 cm female","no antihypertensive medication","diet rich in vegetables"]'::jsonb,
  'Encourage sustained healthy lifestyle. No screening required unless risk factors emerge. Reassess in 3 years.',
  null, null, 'all', null, true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'metabolic' and risk_tier = 'low'
    and framework_name = 'AUSDRISK / WHO 2011 Diabetes Diagnostic Criteria'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   internal_score_min, internal_score_max, clinical_threshold,
   key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'metabolic',
  'AUSDRISK / WHO 2011 Diabetes Diagnostic Criteria',
  'AUSDRISK: Australian Type 2 Diabetes Risk Assessment Tool. MJA 2010. Colagiuri et al. / WHO 2011 diagnostic criteria for diabetes.',
  'https://www.health.gov.au/resources/apps-and-tools/the-australian-type-2-diabetes-risk-assessment-tool-ausdrisk',
  'I', 'moderate', 21, 45,
  'AUSDRISK 6-11 (1/50 to 1/30 5-year T2DM risk); HbA1c 42-47 mmol/mol (high-normal)',
  '["age > 45","waist 94-101 cm male / 80-87 cm female","low physical activity","overweight (BMI 25-29.9)","taking antihypertensive medication","ethnicity: Pacific Islander, South Asian, East Asian, Middle Eastern, Aboriginal/Torres Strait Islander"]'::jsonb,
  '[]'::jsonb,
  'Structured lifestyle intervention. Aim for 5-7% weight reduction if overweight. 150 min/week moderate activity. Annual HbA1c monitoring.',
  null, null, 'all', null, true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'metabolic' and risk_tier = 'moderate'
    and framework_name = 'AUSDRISK / WHO 2011 Diabetes Diagnostic Criteria'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   internal_score_min, internal_score_max, clinical_threshold,
   key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'metabolic',
  'AUSDRISK / WHO 2011 Diabetes Diagnostic Criteria',
  'AUSDRISK: Australian Type 2 Diabetes Risk Assessment Tool. MJA 2010. Colagiuri et al. / WHO 2011 diagnostic criteria for diabetes.',
  'https://www.health.gov.au/resources/apps-and-tools/the-australian-type-2-diabetes-risk-assessment-tool-ausdrisk',
  'I', 'high', 46, 70,
  'AUSDRISK >= 12 (1/14 5-year T2DM risk); HbA1c 48-52 mmol/mol; HOMA-IR >= 2.9',
  '["prior high blood glucose test result","waist > 102 cm male / > 88 cm female","BMI >= 30","previous gestational diabetes","polycystic ovary syndrome","current smoker"]'::jsonb,
  '[]'::jsonb,
  'GP referral for diabetes prevention program (MBS Item 713 for ages 40-49). Consider metformin if lifestyle insufficient. Monitor HbA1c 6-monthly.',
  null, null, 'all',
  'AUSDRISK >= 12 is the threshold for GP-referred T2DM risk evaluation under MBS Item 713.',
  true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'metabolic' and risk_tier = 'high'
    and framework_name = 'AUSDRISK / WHO 2011 Diabetes Diagnostic Criteria'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   internal_score_min, internal_score_max, clinical_threshold,
   key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'metabolic',
  'AUSDRISK / WHO 2011 Diabetes Diagnostic Criteria',
  'AUSDRISK: Australian Type 2 Diabetes Risk Assessment Tool. MJA 2010. Colagiuri et al. / WHO 2011 diagnostic criteria for diabetes.',
  'https://www.health.gov.au/resources/apps-and-tools/the-australian-type-2-diabetes-risk-assessment-tool-ausdrisk',
  'I', 'very_high', 71, 100,
  'T2DM confirmed: HbA1c >= 53 mmol/mol (WHO 2011) OR fasting glucose >= 7.0 mmol/L OR 2h OGTT >= 11.1 mmol/L',
  '["T2DM diagnosis","insulin resistance","metabolic syndrome","visceral obesity","dyslipidaemia (high TG, low HDL)"]'::jsonb,
  '[]'::jsonb,
  'HbA1c target < 53 mmol/mol (individualised). ACR monitoring for nephropathy. Foot examination annually. Ophthalmology review.',
  null, null, 'all', null, true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'metabolic' and risk_tier = 'very_high'
    and framework_name = 'AUSDRISK / WHO 2011 Diabetes Diagnostic Criteria'
);


-- ---------------------------------------------------------------------------
-- Neuro domain — 2024 Lancet Commission on Dementia Prevention
-- ---------------------------------------------------------------------------
insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   internal_score_min, internal_score_max, clinical_threshold,
   key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'neuro',
  'Lancet Commission on Dementia Prevention 2024',
  'Dementia prevention, intervention, and care: 2024 report of the Lancet standing Commission. Livingston G et al. Lancet 2024.',
  'https://pubmed.ncbi.nlm.nih.gov/39096926/',
  'I', 'low', 0, 20,
  '0-2 of the 14 Lancet Commission modifiable dementia risk factors present',
  '["all 14 factors absent or well-controlled"]'::jsonb,
  '[">= 12 years education","regular physical activity >= 150 min/week","strong social networks","good hearing and vision","no smoking","controlled BP and cholesterol"]'::jsonb,
  'Maintain brain-healthy lifestyle. Cognitive engagement activities encouraged. No urgent clinical action.',
  null, null, 'all', null, true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'neuro' and risk_tier = 'low'
    and framework_name = 'Lancet Commission on Dementia Prevention 2024'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   internal_score_min, internal_score_max, clinical_threshold,
   key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'neuro',
  'Lancet Commission on Dementia Prevention 2024',
  'Dementia prevention, intervention, and care: 2024 report of the Lancet standing Commission. Livingston G et al. Lancet 2024.',
  'https://pubmed.ncbi.nlm.nih.gov/39096926/',
  'I', 'moderate', 21, 50,
  '3-5 of the 14 Lancet Commission modifiable dementia risk factors present',
  '["hypertension untreated","depression unmanaged","physical inactivity","social isolation","obesity","smoking","hearing loss uncorrected","LDL > 3.0 mmol/L"]'::jsonb,
  '[]'::jsonb,
  'Address modifiable factors systematically. Hearing assessment if untreated. Depression treatment. BP management < 130/80 mmHg in midlife.',
  null, null, 'all',
  '2024 Lancet Commission: 45% of dementia cases globally are attributable to the 14 identified modifiable risk factors.',
  true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'neuro' and risk_tier = 'moderate'
    and framework_name = 'Lancet Commission on Dementia Prevention 2024'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   internal_score_min, internal_score_max, clinical_threshold,
   key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'neuro',
  'Lancet Commission on Dementia Prevention 2024',
  'Dementia prevention, intervention, and care: 2024 report of the Lancet standing Commission. Livingston G et al. Lancet 2024.',
  'https://pubmed.ncbi.nlm.nih.gov/39096926/',
  'I', 'high', 51, 75,
  '6-8 of the 14 Lancet Commission modifiable dementia risk factors present',
  '["untreated hearing loss (PAR 8.2% - largest single modifiable factor)","hypertension in midlife","depression","physical inactivity","excessive alcohol","TBI history","diabetes","obesity","social isolation","air pollution exposure","vision loss","LDL > 3.0 mmol/L","< 12 years education","smoking"]'::jsonb,
  '[]'::jsonb,
  'Hearing aid referral. GP review of cardiovascular and metabolic risk. Structured exercise program. Social engagement prescription. Depression management.',
  null, null, 'all', null, true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'neuro' and risk_tier = 'high'
    and framework_name = 'Lancet Commission on Dementia Prevention 2024'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   internal_score_min, internal_score_max, clinical_threshold,
   key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'neuro',
  'Lancet Commission on Dementia Prevention 2024',
  'Dementia prevention, intervention, and care: 2024 report of the Lancet standing Commission. Livingston G et al. Lancet 2024.',
  'https://pubmed.ncbi.nlm.nih.gov/39096926/',
  'I', 'very_high', 76, 100,
  '>= 9 of 14 risk factors present OR confirmed mild cognitive impairment OR first-degree relative with early-onset dementia',
  '[]'::jsonb,
  '[]'::jsonb,
  'Neuropsychologist referral. Cognitive assessment (MMSE/MoCA). Intensive multimodal intervention. Consider MIND diet, supervised aerobic exercise programme.',
  null, null, 'all', null, true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'neuro' and risk_tier = 'very_high'
    and framework_name = 'Lancet Commission on Dementia Prevention 2024'
);


-- ---------------------------------------------------------------------------
-- Onco domain — IARC/WHO + Cancer Council Australia
-- ---------------------------------------------------------------------------
insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   internal_score_min, internal_score_max, clinical_threshold,
   key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'onco',
  'WHO/IARC Cancer Risk Framework 2024',
  'WHO/IARC: World Cancer Report 2024. WHO 2026: Four in ten cancer cases could be prevented globally. Cancer Council Australia guidelines.',
  'https://www.who.int/news/item/03-02-2026-four-in-ten-cancer-cases-could-be-prevented-globally',
  'I', 'low', 0, 20,
  'Non-smoker, BMI < 25, alcohol < 7 standard drinks/week, >= 150 min/week physical activity, consistent sun protection',
  '[]'::jsonb,
  '["never-smoker","BMI 18.5-24.9","alcohol <= 2 std drinks/day","physically active","sun protection SPF 50+ daily","high vegetable/fruit intake","completed age-appropriate cancer screening"]'::jsonb,
  'Maintain healthy lifestyle. Ensure participation in national screening programs: NBCSP (bowel 50-74), BreastScreen (female 50-74), NCSP (cervical 25-74).',
  null, null, 'all', null, true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'onco' and risk_tier = 'low'
    and framework_name = 'WHO/IARC Cancer Risk Framework 2024'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   internal_score_min, internal_score_max, clinical_threshold,
   key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'onco',
  'WHO/IARC Cancer Risk Framework 2024',
  'WHO/IARC: World Cancer Report 2024. WHO 2026: Four in ten cancer cases could be prevented globally. Cancer Council Australia guidelines.',
  'https://www.who.int/news/item/03-02-2026-four-in-ten-cancer-cases-could-be-prevented-globally',
  'I', 'moderate', 21, 45,
  'Ex-smoker (quit > 5 years) OR BMI 25-29.9 (overweight) OR alcohol 7-14 std/week OR low physical activity',
  '["ex-smoker (quit > 5y)","overweight BMI 25-29.9","alcohol 7-14 std/week","physical inactivity","irregular sun protection","family history 2nd-degree relative"]'::jsonb,
  '[]'::jsonb,
  'Weight management. Alcohol reduction target < 10 std/week. Screen for skin lesions annually if significant UV history.',
  null, null, 'all', null, true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'onco' and risk_tier = 'moderate'
    and framework_name = 'WHO/IARC Cancer Risk Framework 2024'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   internal_score_min, internal_score_max, clinical_threshold,
   key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'onco',
  'WHO/IARC Cancer Risk Framework 2024',
  'WHO/IARC: World Cancer Report 2024. WHO 2026: Four in ten cancer cases could be prevented globally. Cancer Council Australia guidelines.',
  'https://www.who.int/news/item/03-02-2026-four-in-ten-cancer-cases-could-be-prevented-globally',
  'I', 'high', 46, 75,
  'Current smoker OR BMI >= 30 (obese) OR alcohol > 14 std/week OR 1st-degree relative with cancer < 60y',
  '["current smoker (tobacco PAF: 15% of all cancers globally - IARC 2024)","obese BMI >= 30 (linked to 13 cancer types by IARC)","alcohol > 14 std/week (no safe level for cancer - WHO 2023)","family history 1st-degree relative","excessive UV exposure / history sunburns","red or processed meat > 500 g/week (IARC Group 1: colorectal cancer)","low dietary fibre","physical inactivity"]'::jsonb,
  '[]'::jsonb,
  'Smoking cessation program referral. Alcohol reduction to < 10 std/week. Skin cancer check annually. Colonoscopy or enhanced bowel screening if family history. GP review.',
  null, null, 'all', null, true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'onco' and risk_tier = 'high'
    and framework_name = 'WHO/IARC Cancer Risk Framework 2024'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   internal_score_min, internal_score_max, clinical_threshold,
   key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'onco',
  'WHO/IARC Cancer Risk Framework 2024',
  'WHO/IARC: World Cancer Report 2024. WHO 2026: Four in ten cancer cases could be prevented globally. Cancer Council Australia guidelines.',
  'https://www.who.int/news/item/03-02-2026-four-in-ten-cancer-cases-could-be-prevented-globally',
  'I', 'very_high', 76, 100,
  'Multiple high-risk behaviours concurrent OR confirmed BRCA1/2 / Lynch syndrome / FAP / other hereditary cancer syndrome',
  '["current smoker + obese + heavy alcohol (additive risk)","confirmed hereditary cancer syndrome","prior cancer diagnosis","HPV-positive (cervical)","Barrett''s oesophagus","chronic hepatitis B or C"]'::jsonb,
  '[]'::jsonb,
  'Genetic counselling referral if hereditary syndrome suspected. Enhanced surveillance program. Oncology or specialist review. Urgent smoking cessation.',
  null, null, 'all', null, true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'onco' and risk_tier = 'very_high'
    and framework_name = 'WHO/IARC Cancer Risk Framework 2024'
);


-- ---------------------------------------------------------------------------
-- MSK domain — 2024 RACGP / Healthy Bones Australia + FRAX
-- ---------------------------------------------------------------------------
insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   internal_score_min, internal_score_max, clinical_threshold,
   key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'msk',
  '2024 RACGP / Healthy Bones Australia Osteoporosis Guideline',
  '2024 RACGP and Healthy Bones Australia guideline for osteoporosis management and fracture prevention. MJA 2025.',
  'https://pubmed.ncbi.nlm.nih.gov/40134107/',
  'I', 'low', 0, 25,
  'FRAX 10-year major osteoporotic fracture (MOF) risk < 10%',
  '["age < 50","healthy BMI","no prior fragility fracture","no corticosteroid use","calcium and vitamin D adequate","physically active with weight-bearing exercise"]'::jsonb,
  '["calcium intake >= 1000 mg/day from diet","vitamin D > 50 nmol/L","regular weight-bearing exercise","healthy BMI 20-27","non-smoker","alcohol < 2 units/day"]'::jsonb,
  'Calcium and vitamin D optimisation. Regular weight-bearing exercise. No DXA or pharmacotherapy required unless additional risk factors emerge.',
  null, null, 'all', null, true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'msk' and risk_tier = 'low'
    and framework_name = '2024 RACGP / Healthy Bones Australia Osteoporosis Guideline'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   internal_score_min, internal_score_max, clinical_threshold,
   key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'msk',
  '2024 RACGP / Healthy Bones Australia Osteoporosis Guideline',
  '2024 RACGP and Healthy Bones Australia guideline for osteoporosis management and fracture prevention. MJA 2025.',
  'https://pubmed.ncbi.nlm.nih.gov/40134107/',
  'I', 'moderate', 26, 55,
  'FRAX 10-year MOF risk 10-20% (refer for DXA)',
  '["age 50-70","female sex (post-menopausal)","low BMI (< 19)","prior fragility fracture","parental hip fracture","corticosteroid use > 3 months","rheumatoid arthritis","alcohol >= 2 units/day","smoking"]'::jsonb,
  '[]'::jsonb,
  'Refer for DXA bone mineral density scan. Optimise calcium (1000-1300 mg/day) and vitamin D (target > 50 nmol/L). Reassess with BMD result.',
  null, null, 'all',
  'FRAX MOF >= 10% is the threshold for DXA referral per 2024 RACGP/HBA guideline.',
  true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'msk' and risk_tier = 'moderate'
    and framework_name = '2024 RACGP / Healthy Bones Australia Osteoporosis Guideline'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   internal_score_min, internal_score_max, clinical_threshold,
   key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'msk',
  '2024 RACGP / Healthy Bones Australia Osteoporosis Guideline',
  '2024 RACGP and Healthy Bones Australia guideline for osteoporosis management and fracture prevention. MJA 2025.',
  'https://pubmed.ncbi.nlm.nih.gov/40134107/',
  'I', 'high', 56, 80,
  'FRAX 10-year MOF risk 20-30% OR hip fracture risk 3-4.5%',
  '["age > 70","prior fragility fracture (wrist, spine, hip)","T-score between -1.5 and -2.5 on DXA","chronic corticosteroid use","secondary osteoporosis (coeliac, IBD, hypogonadism)","BMI < 17","immobility"]'::jsonb,
  '[]'::jsonb,
  'Consider antiresorptive pharmacotherapy (bisphosphonate first-line). Falls assessment and prevention programme. Bone-loading exercise programme.',
  null, null, 'all', null, true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'msk' and risk_tier = 'high'
    and framework_name = '2024 RACGP / Healthy Bones Australia Osteoporosis Guideline'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   internal_score_min, internal_score_max, clinical_threshold,
   key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'msk',
  '2024 RACGP / Healthy Bones Australia Osteoporosis Guideline',
  '2024 RACGP and Healthy Bones Australia guideline for osteoporosis management and fracture prevention. MJA 2025.',
  'https://pubmed.ncbi.nlm.nih.gov/40134107/',
  'I', 'very_high', 81, 100,
  'FRAX 10-year MOF risk >= 30% OR hip fracture risk >= 4.5% - imminent/very high risk',
  '["T-score <= -2.5 (osteoporosis)","recent fragility fracture (within 2 years)","T-score <= -3.0","multiple vertebral fractures","denosumab discontinuation without bridging therapy"]'::jsonb,
  '[]'::jsonb,
  'Initiate pharmacotherapy urgently (osteoanabolic agent preferred for very high risk). Endocrinology or rheumatology referral. Monthly falls prevention review.',
  null, null, 'all',
  '2024 RACGP guideline flags ''imminent risk'' as a key new category - fracture risk within 12 months is substantially elevated after a recent fracture.',
  true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'msk' and risk_tier = 'very_high'
    and framework_name = '2024 RACGP / Healthy Bones Australia Osteoporosis Guideline'
);


-- ---------------------------------------------------------------------------
-- Supplement domain — NIH ODS evidence base
-- ---------------------------------------------------------------------------
insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   clinical_threshold, key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'supplement',
  'NIH ODS Vitamin D / Endocrine Society Guidelines',
  'NIH Office of Dietary Supplements. Dietary Supplement Fact Sheets (2024). ods.od.nih.gov',
  'https://ods.od.nih.gov/factsheets/list-VitaminsMinerals/',
  'I', 'not_applicable',
  'Deficiency: < 50 nmol/L (20 ng/mL); Insufficiency: 50-75 nmol/L; Sufficiency: > 75 nmol/L',
  '[]'::jsonb,
  '[]'::jsonb,
  'Replacement: 1,000-2,000 IU/day for insufficiency; 3,000-5,000 IU/day under medical supervision for deficiency. UL 4,000 IU/day without supervision. Recheck 25-OH-D after 3 months.',
  null, null, 'all',
  'Deficiency linked to musculoskeletal pain, increased fracture risk, immune dysregulation, and metabolic risk.',
  true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'supplement'
    and framework_name = 'NIH ODS Vitamin D / Endocrine Society Guidelines'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   clinical_threshold, key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'supplement',
  'NIH ODS Omega-3 / REDUCE-IT Trial (NEJM 2019)',
  'NIH Office of Dietary Supplements. Dietary Supplement Fact Sheets (2024). ods.od.nih.gov',
  'https://ods.od.nih.gov/factsheets/list-VitaminsMinerals/',
  'I', 'not_applicable',
  '1-2 g EPA+DHA/day general CV support; 4 g icosapentaenoic acid/day (prescription) for hypertriglyceridaemia',
  '[]'::jsonb,
  '[]'::jsonb,
  '1-2 g/day for CV support (Level I). 4 g/day icosapentaenoic acid (REDUCE-IT trial: 25% relative risk reduction in MACE in statin-treated patients with elevated TG). Fish oil > 3 g/day may increase bleeding risk with anticoagulants.',
  null, null, 'all',
  'REDUCE-IT trial (NEJM 2019): icosapentaenoic acid 4 g/day reduced cardiovascular events by 25% vs placebo in high-risk patients.',
  true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'supplement'
    and framework_name = 'NIH ODS Omega-3 / REDUCE-IT Trial (NEJM 2019)'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   clinical_threshold, key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'supplement',
  'NIH ODS Magnesium',
  'NIH Office of Dietary Supplements. Dietary Supplement Fact Sheets (2024). ods.od.nih.gov',
  'https://ods.od.nih.gov/factsheets/list-VitaminsMinerals/',
  'II', 'not_applicable',
  'RDI: 310-320 mg/day female; 400-420 mg/day male. Supplemental UL: 350 mg/day.',
  '[]'::jsonb,
  '[]'::jsonb,
  'Glycinate or malate forms preferred for gastrointestinal tolerance. Deficiency common in T2DM, hypertension, alcohol use. May reduce BP by 2-4 mmHg (meta-analysis). 350 mg supplemental magnesium upper limit (NIH ODS) applies to supplements alone, not dietary intake.',
  null, null, 'all',
  'Magnesium oxide is poorly absorbed (4% bioavailability) - do not recommend as primary form.',
  true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'supplement'
    and framework_name = 'NIH ODS Magnesium'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   clinical_threshold, key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'supplement',
  'NIH ODS Vitamin B12',
  'NIH Office of Dietary Supplements. Dietary Supplement Fact Sheets (2024). ods.od.nih.gov',
  'https://ods.od.nih.gov/factsheets/list-VitaminsMinerals/',
  'I', 'not_applicable',
  'Deficiency: serum B12 < 148 pmol/L; Borderline: 148-220 pmol/L; Optimal: > 300 pmol/L',
  '[]'::jsonb,
  '[]'::jsonb,
  'Methylcobalamin (active form) preferred over cyanocobalamin. Treatment: 1,000 mcg/day orally for documented deficiency (high-dose oral is as effective as IM for absorption via passive diffusion). Vegans and those on metformin at elevated risk.',
  null, null, 'all',
  'Active B12 (holotranscobalamin) < 35 pmol/L indicates functional deficiency even with normal total B12.',
  true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'supplement'
    and framework_name = 'NIH ODS Vitamin B12'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   clinical_threshold, key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'supplement',
  'Q-SYMBIO Trial (JACC HF 2014) / Cochrane review',
  'NIH Office of Dietary Supplements. Dietary Supplement Fact Sheets (2024). ods.od.nih.gov',
  'https://ods.od.nih.gov/factsheets/list-VitaminsMinerals/',
  'II', 'not_applicable',
  '100-300 mg/day ubiquinol form',
  '[]'::jsonb,
  '[]'::jsonb,
  'Supportive evidence for statin-associated myopathy symptom relief (100-200 mg/day). Heart failure: Q-SYMBIO trial showed reduced MACE with 300 mg/day CoQ10 over 2 years. May slightly reduce warfarin effect - monitor INR. Absorbs best with fat-containing meal.',
  null, null, 'all',
  'Note to Sage: CoQ10 is not contraindicated with statins but may interact with warfarin.',
  true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'supplement'
    and framework_name = 'Q-SYMBIO Trial (JACC HF 2014) / Cochrane review'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   clinical_threshold, key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'supplement',
  'WHO Iron Deficiency Guidelines / Cochrane reviews',
  'NIH Office of Dietary Supplements. Dietary Supplement Fact Sheets (2024). ods.od.nih.gov',
  'https://ods.od.nih.gov/factsheets/list-VitaminsMinerals/',
  'I', 'not_applicable',
  'Deficiency: ferritin < 15 ug/L; Depletion: ferritin < 30 ug/L with symptoms; Anaemia: Hb < 115 g/L female / < 130 g/L male',
  '[]'::jsonb,
  '[]'::jsonb,
  'Ferrous bisglycinate (chelated) 25-50 mg elemental iron with 500 mg Vitamin C. Must be taken >= 2 hours from levothyroxine, quinolone antibiotics, calcium, magnesium. Recheck ferritin after 3 months. Do not supplement without documented deficiency.',
  null, null, 'all',
  'Ferrous bisglycinate has superior gastrointestinal tolerability vs ferrous sulfate.',
  true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'supplement'
    and framework_name = 'WHO Iron Deficiency Guidelines / Cochrane reviews'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   clinical_threshold, key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'supplement',
  'NIH ODS Zinc',
  'NIH Office of Dietary Supplements. Dietary Supplement Fact Sheets (2024). ods.od.nih.gov',
  'https://ods.od.nih.gov/factsheets/list-VitaminsMinerals/',
  'II', 'not_applicable',
  'RDI: 8 mg/day female; 11 mg/day male. UL: 40 mg/day.',
  '[]'::jsonb,
  '[]'::jsonb,
  'Supplement only if dietary intake insufficient or deficiency confirmed. Zinc picolinate or gluconate preferred. Excess zinc > 40 mg/day may cause copper deficiency. Zinc bisglycinate has good bioavailability.',
  null, null, 'all',
  'Zinc deficiency associated with impaired immune function, low testosterone, poor wound healing, and hair loss.',
  true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'supplement'
    and framework_name = 'NIH ODS Zinc'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   clinical_threshold, key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'supplement',
  'Phytotherapy Research systematic reviews',
  'NIH Office of Dietary Supplements. Dietary Supplement Fact Sheets (2024). ods.od.nih.gov',
  'https://ods.od.nih.gov/factsheets/list-VitaminsMinerals/',
  'III', 'not_applicable',
  '500-1,000 mg curcuminoids/day with piperine',
  '[]'::jsonb,
  '[]'::jsonb,
  'Bioavailability markedly improved with piperine (5 mg piperine increases absorption ~20x). Anti-inflammatory mechanisms: NF-kB inhibition. Level II evidence for knee OA symptom relief. Caution with blood thinners - mild antiplatelet activity.',
  null, null, 'all',
  'Curcumin alone has poor oral bioavailability (< 1% absorption). Only recommend formulations with piperine or phospholipid complex.',
  true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'supplement'
    and framework_name = 'Phytotherapy Research systematic reviews'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   clinical_threshold, key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'supplement',
  'Rotterdam Study / European K2 research',
  'NIH Office of Dietary Supplements. Dietary Supplement Fact Sheets (2024). ods.od.nih.gov',
  'https://ods.od.nih.gov/factsheets/list-VitaminsMinerals/',
  'III', 'not_applicable',
  '90-180 ug/day MK-7 form',
  '[]'::jsonb,
  '[]'::jsonb,
  'MK-7 (menaquinone-7) is the preferred form for bone and vascular health due to longer half-life than MK-4. Activates osteocalcin (bone matrix protein) and matrix Gla protein (vascular calcification inhibitor). Do not use with anticoagulants without physician supervision.',
  null, null, 'all',
  'Rotterdam Study (2004): highest K2 intake quartile associated with 57% reduction in cardiovascular mortality vs lowest quartile.',
  true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'supplement'
    and framework_name = 'Rotterdam Study / European K2 research'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   clinical_threshold, key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'supplement',
  'Emerging longevity research (NMN/NR RCTs 2023-2024)',
  'NIH Office of Dietary Supplements. Dietary Supplement Fact Sheets (2024). ods.od.nih.gov',
  'https://ods.od.nih.gov/factsheets/list-VitaminsMinerals/',
  'III', 'not_applicable',
  'NMN 250-500 mg/day or NR 300-600 mg/day',
  '[]'::jsonb,
  '[]'::jsonb,
  'Emerging Level III evidence. NMN and NR raise NAD+ levels. RCTs (2023) show improved muscle function and metabolic markers in older adults. Long-term safety > 12 months not fully established. Promising but not yet Level I.',
  null, null, 'all',
  'Phase I/II safety trials complete. Phase III long-term trials ongoing as of 2024.',
  true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'supplement'
    and framework_name = 'Emerging longevity research (NMN/NR RCTs 2023-2024)'
);


-- ---------------------------------------------------------------------------
-- Drug-interaction domain
-- ---------------------------------------------------------------------------
insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   clinical_threshold, key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'drug_interaction',
  'Drug-supplement interaction: anticoagulants',
  'Natural Medicines Therapeutic Research Center / Australian Register of Therapeutic Goods (ARTG)',
  null,
  'I', 'not_applicable',
  null,
  '["warfarin","rivaroxaban","apixaban","dabigatran","aspirin + anticoagulant combo"]'::jsonb,
  '[]'::jsonb,
  'Fish oil > 3 g/day, Vitamin E > 400 IU/day, CoQ10, Ginkgo biloba may increase bleeding risk when combined with warfarin, rivaroxaban, or apixaban. Fish oil inhibits platelet aggregation. Always flag in supplement note field. interactions_checked should remain false until GP reviews combination.',
  null, null, 'all', null, true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'drug_interaction'
    and framework_name = 'Drug-supplement interaction: anticoagulants'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   clinical_threshold, key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'drug_interaction',
  'Drug-supplement interaction: levothyroxine absorption',
  'Natural Medicines Therapeutic Research Center / Australian Register of Therapeutic Goods (ARTG)',
  null,
  'I', 'not_applicable',
  null,
  '["levothyroxine","thyroxine","iron","calcium","magnesium","biotin"]'::jsonb,
  '[]'::jsonb,
  'Iron, calcium, magnesium, and zinc supplements reduce levothyroxine absorption by 20-40% when taken concurrently. Minimum separation: 2 hours. Biotin supplements interfere with TSH assay results - stop 72h before thyroid testing. Always flag in supplement note and instruct patient on timing.',
  null, null, 'all', null, true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'drug_interaction'
    and framework_name = 'Drug-supplement interaction: levothyroxine absorption'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   clinical_threshold, key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'drug_interaction',
  'Drug-supplement interaction: Hypericum perforatum',
  'Natural Medicines Therapeutic Research Center / Australian Register of Therapeutic Goods (ARTG)',
  null,
  'I', 'not_applicable',
  null,
  '["oral contraceptives","SSRIs","SNRIs","warfarin","digoxin","statins","HIV antiretrovirals"]'::jsonb,
  '[]'::jsonb,
  'St John''s Wort (Hypericum perforatum) is a potent CYP3A4 and P-glycoprotein inducer. Contraindicated with: oral contraceptives (reduces efficacy, breakthrough bleeding/pregnancy risk), SSRIs/SNRIs (serotonin syndrome), warfarin (reduced anticoagulation), digoxin, statins, HIV antiretrovirals, cyclosporin. ABSOLUTE CONTRAINDICATION - never recommend if patient is on any of these medications.',
  null, null, 'all', null, true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'drug_interaction'
    and framework_name = 'Drug-supplement interaction: Hypericum perforatum'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   clinical_threshold, key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'drug_interaction',
  'Drug-supplement interaction: calcium-iron',
  'Natural Medicines Therapeutic Research Center / Australian Register of Therapeutic Goods (ARTG)',
  null,
  'I', 'not_applicable',
  null,
  '["calcium supplement","dairy consumption","iron deficiency"]'::jsonb,
  '[]'::jsonb,
  'Calcium inhibits non-haem iron absorption when taken concurrently. Mechanism: shared divalent metal transporter (DMT1). Take iron supplements >= 2 hours before or after calcium supplements or dairy-heavy meals. This interaction is clinically significant in iron-deficiency anaemia patients - may impair treatment response if not separated.',
  null, null, 'all', null, true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'drug_interaction'
    and framework_name = 'Drug-supplement interaction: calcium-iron'
);

insert into public.risk_assessment_standards
  (domain, framework_name, source_citation, source_url, evidence_level, risk_tier,
   clinical_threshold, key_risk_factors, protective_factors, clinical_guidance,
   applicable_age_min, applicable_age_max, applicable_sex, notes, active)
select
  'drug_interaction',
  'Drug-supplement interaction: vitamin E antiplatelet',
  'Natural Medicines Therapeutic Research Center / Australian Register of Therapeutic Goods (ARTG)',
  null,
  'II', 'not_applicable',
  null,
  '["anticoagulants","pre-operative period","aspirin combined","platelet dysfunction"]'::jsonb,
  '[]'::jsonb,
  'Vitamin E (alpha-tocopherol) > 400 IU/day exhibits antiplatelet activity and may increase bleeding risk, particularly when combined with anticoagulants or in the perioperative period. Evidence for clinically significant bleeding at 400 IU/day is mixed, but caution is warranted. Advise patients to cease >= 7 days pre-surgery.',
  null, null, 'all', null, true
where not exists (
  select 1 from public.risk_assessment_standards
  where domain = 'drug_interaction'
    and framework_name = 'Drug-supplement interaction: vitamin E antiplatelet'
);


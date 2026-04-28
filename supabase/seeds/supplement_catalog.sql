-- Seed: deterministic supplement catalog.
-- Idempotent — re-running upserts on (sku).
-- 40+ items covering the six risk domains.

begin;

insert into public.supplement_catalog
  (sku, display_name, canonical_dose, timing_default, evidence_tag, domain, triggers_when, contraindicates, cost_aud_month, notes)
values
  -- Cardiovascular
  ('OMEGA3-2G',          'Omega-3 EPA/DHA',          '2000 mg/day',   'with breakfast', 'A', 'cardiovascular',     '{"apoB_gt": 100, "triglycerides_gt": 1.7, "hsCRP_gt": 1.0, "omega3_index_lt": 8}'::jsonb, '["warfarin"]'::jsonb,                 35.00, 'Lipid + inflammation support'),
  ('COQ10-200',          'Coenzyme Q10 (Ubiquinol)', '200 mg/day',    'with breakfast', 'B', 'cardiovascular',     '{"cv_score_gt": 50, "age_gt": 50}'::jsonb,                              '["warfarin"]'::jsonb,                 28.00, 'Mitochondrial / statin co-therapy'),
  ('NIACIN-500',         'Niacin (Nicotinic acid)',  '500 mg/day',    'with dinner',    'B', 'cardiovascular',     '{"lp_a_gt": 75, "hdl_lt": 1.0}'::jsonb,                                 '["statins"]'::jsonb,                  18.00, 'Lp(a) and HDL modulation'),
  ('VITK2-MK7-200',      'Vitamin K2 MK-7',          '200 mcg/day',   'with breakfast', 'B', 'cardiovascular',     '{"cv_score_gt": 40, "age_gt": 50}'::jsonb,                              '["warfarin","heparin"]'::jsonb,       22.00, 'Arterial calcification + bone'),
  ('GARLIC-AGED-1200',   'Aged Garlic Extract',      '1200 mg/day',   'with dinner',    'B', 'cardiovascular',     '{"cv_score_gt": 50}'::jsonb,                                            '["warfarin","clopidogrel"]'::jsonb,   25.00, 'BP and endothelial support'),
  ('HAWTHORN-900',       'Hawthorn Extract',         '900 mg/day',    'with breakfast', 'C', 'cardiovascular',     '{"cv_score_gt": 60}'::jsonb,                                            '["digoxin","beta-blockers"]'::jsonb,  20.00, 'Mild heart-failure adjunct'),
  ('TAURINE-3G',         'Taurine',                  '3000 mg/day',   'with breakfast', 'B', 'cardiovascular',     '{"cv_score_gt": 50, "homocysteine_gt": 12}'::jsonb,                     '[]'::jsonb,                           24.00, 'BP, lipids, longevity'),

  -- Metabolic
  ('BERBERINE-1500',     'Berberine HCl',            '1500 mg/day',   'with meals',     'A', 'metabolic',          '{"hba1c_gt": 5.7, "fasting_glucose_gt": 5.5, "homa_ir_gt": 2}'::jsonb,  '["cyclosporine","metformin"]'::jsonb, 32.00, 'Glucose / insulin sensitivity'),
  ('ALA-600',            'Alpha-Lipoic Acid',        '600 mg/day',    'fasted morning', 'B', 'metabolic',          '{"hba1c_gt": 5.7, "fasting_insulin_gt": 10}'::jsonb,                    '["insulin"]'::jsonb,                  24.00, 'Insulin sensitivity, neuropathy'),
  ('CHROMIUM-PIC-200',   'Chromium Picolinate',      '200 mcg/day',   'with breakfast', 'C', 'metabolic',          '{"hba1c_gt": 5.7}'::jsonb,                                              '[]'::jsonb,                           14.00, 'Glycemic adjunct'),
  ('MAG-GLY-400',        'Magnesium Glycinate',      '400 mg/day',    'with dinner',    'A', 'metabolic',          '{"hba1c_gt": 5.7, "metabolic_score_gt": 40}'::jsonb,                    '[]'::jsonb,                           20.00, 'Insulin sensitivity, sleep'),
  ('MYO-INOSITOL-2G',    'Myo-Inositol',             '2000 mg/day',   'with breakfast', 'B', 'metabolic',          '{"fasting_insulin_gt": 10, "homa_ir_gt": 2}'::jsonb,                    '[]'::jsonb,                           26.00, 'PCOS / insulin resistance'),
  ('CINNAMON-1G',        'Cinnamon Extract',         '1000 mg/day',   'with meals',     'C', 'metabolic',          '{"fasting_glucose_gt": 5.5}'::jsonb,                                    '[]'::jsonb,                           12.00, 'Postprandial glucose'),
  ('GYMNEMA-400',        'Gymnema Sylvestre',        '400 mg/day',    'before meals',   'C', 'metabolic',          '{"hba1c_gt": 5.7}'::jsonb,                                              '["insulin"]'::jsonb,                  18.00, 'Sugar craving / glucose'),

  -- Neurodegenerative
  ('LIONS-MANE-1G',      'Lion''s Mane',             '1000 mg/day',   'with breakfast', 'B', 'neurodegenerative',  '{"neuro_score_gt": 40, "age_gt": 50}'::jsonb,                           '[]'::jsonb,                           34.00, 'NGF, cognition'),
  ('CURCUMIN-PIP-1G',    'Curcumin + Piperine',      '1000 mg/day',   'with breakfast', 'B', 'neurodegenerative',  '{"hsCRP_gt": 1.0, "neuro_score_gt": 40}'::jsonb,                        '["warfarin"]'::jsonb,                 28.00, 'Neuroinflammation'),
  ('B-COMPLEX',          'B-Complex (activated)',    '1 capsule/day', 'with breakfast', 'A', 'neurodegenerative',  '{"homocysteine_gt": 10, "neuro_score_gt": 30}'::jsonb,                  '[]'::jsonb,                           22.00, 'Homocysteine / methylation'),
  ('CITICOLINE-500',     'Citicoline (CDP-choline)', '500 mg/day',    'with breakfast', 'B', 'neurodegenerative',  '{"neuro_score_gt": 50, "age_gt": 55}'::jsonb,                           '[]'::jsonb,                           38.00, 'Acetylcholine, executive function'),
  ('CREATINE-5G',        'Creatine Monohydrate',     '5000 mg/day',   'any time',       'A', 'neurodegenerative',  '{"neuro_score_gt": 30, "age_gt": 40}'::jsonb,                           '[]'::jsonb,                           18.00, 'Cognition + muscle'),
  ('PS-300',             'Phosphatidylserine',       '300 mg/day',    'with dinner',    'B', 'neurodegenerative',  '{"neuro_score_gt": 50, "age_gt": 55}'::jsonb,                           '["anticholinergics"]'::jsonb,         32.00, 'Memory, cortisol'),

  -- Oncological
  ('SULFORAPHANE-30',    'Sulforaphane (Broccoli)',  '30 mg/day',     'with breakfast', 'B', 'oncological',        '{"onco_score_gt": 40}'::jsonb,                                          '[]'::jsonb,                           36.00, 'NRF2 / detox pathway'),
  ('VITD3-5000',         'Vitamin D3',               '5000 IU/day',   'with breakfast', 'A', 'oncological',        '{"vitamin_d_lt": 75, "onco_score_gt": 40, "msk_score_gt": 50}'::jsonb,  '[]'::jsonb,                           14.00, 'Cancer + bone + immune'),
  ('SELENIUM-200',       'Selenium (Selenomethionine)','200 mcg/day', 'with breakfast', 'B', 'oncological',        '{"onco_score_gt": 40}'::jsonb,                                          '[]'::jsonb,                           16.00, 'Antioxidant / thyroid'),
  ('EGCG-400',           'Green-Tea Extract (EGCG)', '400 mg/day',    'fasted morning', 'B', 'oncological',        '{"onco_score_gt": 40, "metabolic_score_gt": 40}'::jsonb,                '["nadolol"]'::jsonb,                  22.00, 'Polyphenol, metabolic'),
  ('FISETIN-500',        'Fisetin',                  '500 mg/day',    'with breakfast', 'C', 'oncological',        '{"onco_score_gt": 40, "age_gt": 50}'::jsonb,                            '[]'::jsonb,                           40.00, 'Senolytic candidate'),

  -- Musculoskeletal
  ('CALCIUM-CIT-600',    'Calcium Citrate',          '600 mg/day',    'with dinner',    'B', 'musculoskeletal',    '{"msk_score_gt": 50, "age_gt": 50}'::jsonb,                             '["levothyroxine"]'::jsonb,            16.00, 'Bone density'),
  ('COLLAGEN-PEP-15G',   'Collagen Peptides',        '15 g/day',      'with breakfast', 'B', 'musculoskeletal',    '{"msk_score_gt": 40}'::jsonb,                                           '[]'::jsonb,                           28.00, 'Joint, skin, tendon'),
  ('BORON-3',            'Boron',                    '3 mg/day',      'with breakfast', 'C', 'musculoskeletal',    '{"msk_score_gt": 50}'::jsonb,                                           '[]'::jsonb,                           10.00, 'Bone mineralisation'),
  ('GLUCOSAMINE-1500',   'Glucosamine Sulfate',      '1500 mg/day',   'with meals',     'B', 'musculoskeletal',    '{"msk_score_gt": 40, "age_gt": 50}'::jsonb,                             '["warfarin"]'::jsonb,                 24.00, 'Joint cartilage support'),

  -- General longevity
  ('NAC-600',            'N-Acetyl Cysteine',        '600 mg/day',    'fasted morning', 'B', 'general',            '{"hsCRP_gt": 1.0, "age_gt": 40}'::jsonb,                                '["nitroglycerin"]'::jsonb,            18.00, 'Glutathione precursor'),
  ('GLYCINE-3G',         'Glycine',                  '3000 mg/day',   'before bed',     'B', 'general',            '{"age_gt": 40}'::jsonb,                                                 '["clozapine"]'::jsonb,                14.00, 'Sleep, glutathione synthesis'),
  ('GLUTATHIONE-LIPO-500','Liposomal Glutathione',   '500 mg/day',    'fasted morning', 'C', 'general',            '{"hsCRP_gt": 2.0, "age_gt": 50}'::jsonb,                                '[]'::jsonb,                           48.00, 'Master antioxidant'),
  ('ASHWA-KSM66-600',    'Ashwagandha KSM-66',       '600 mg/day',    'with dinner',    'B', 'general',            '{"age_gt": 30}'::jsonb,                                                 '["thyroid_hormones","sedatives"]'::jsonb, 26.00, 'Stress, cortisol, sleep'),
  ('RHODIOLA-400',       'Rhodiola Rosea',           '400 mg/day',    'with breakfast', 'C', 'general',            '{"age_gt": 30}'::jsonb,                                                 '["antidepressants"]'::jsonb,          22.00, 'Adaptogen, fatigue'),
  ('MELATONIN-1',        'Melatonin (low-dose)',     '1 mg/night',    'before bed',     'A', 'general',            '{"age_gt": 50}'::jsonb,                                                 '["sedatives","immunosuppressants"]'::jsonb, 12.00, 'Circadian / sleep'),
  ('FISETIN-GEN-500',    'Fisetin (general use)',    '500 mg/day',    'with breakfast', 'C', 'general',            '{"age_gt": 60}'::jsonb,                                                 '[]'::jsonb,                           40.00, 'Senolytic, general anti-aging'),
  ('TAURINE-GEN-2G',     'Taurine (general)',        '2000 mg/day',   'with breakfast', 'B', 'general',            '{"age_gt": 50}'::jsonb,                                                 '[]'::jsonb,                           20.00, 'Longevity, cardiometabolic'),
  ('CREATINE-GEN-5G',    'Creatine (general)',       '5000 mg/day',   'any time',       'A', 'general',            '{"age_gt": 40}'::jsonb,                                                 '[]'::jsonb,                           18.00, 'Muscle, brain, longevity'),
  ('VITD3-GEN-2000',     'Vitamin D3 (maintenance)', '2000 IU/day',   'with breakfast', 'A', 'general',            '{"vitamin_d_lt": 100}'::jsonb,                                          '[]'::jsonb,                           10.00, 'Maintenance dosing'),
  ('MAG-GLY-GEN-300',    'Magnesium Glycinate (gen)','300 mg/day',    'before bed',     'A', 'general',            '{"age_gt": 30}'::jsonb,                                                 '[]'::jsonb,                           18.00, 'Sleep, stress, general'),
  ('B12-METHYL-1000',    'Methylcobalamin B12',      '1000 mcg/day',  'with breakfast', 'A', 'general',            '{"homocysteine_gt": 10, "age_gt": 50}'::jsonb,                          '[]'::jsonb,                           14.00, 'B12 status, methylation'),
  ('ZINC-PIC-15',        'Zinc Picolinate',          '15 mg/day',     'with dinner',    'B', 'general',            '{"age_gt": 40}'::jsonb,                                                 '["tetracyclines","quinolones"]'::jsonb, 12.00, 'Immune, skin, hormones')

on conflict (sku) do update set
  display_name    = excluded.display_name,
  canonical_dose  = excluded.canonical_dose,
  timing_default  = excluded.timing_default,
  evidence_tag    = excluded.evidence_tag,
  domain          = excluded.domain,
  triggers_when   = excluded.triggers_when,
  contraindicates = excluded.contraindicates,
  cost_aud_month  = excluded.cost_aud_month,
  notes           = excluded.notes;

commit;

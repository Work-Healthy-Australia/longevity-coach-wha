import type { SupplementItem } from '@/lib/ai/patient-context';

export const SEED_SUPPLEMENT_PLAN: SupplementItem[] = [
  {
    name: 'Omega-3 Fish Oil',
    form: 'softgel',
    dosage: '2g EPA+DHA daily',
    timing: 'with dinner',
    priority: 'critical',
    domains: ['cv', 'metabolic'],
    rationale: 'Reduces elevated triglycerides (2.3 mmol/L) and lowers cardiovascular risk in patients with LDL 4.8 mmol/L and family history of MI. EPA+DHA at therapeutic dose reduces MACE risk by 18% in high-risk profiles.',
  },
  {
    name: 'CoQ10 (Ubiquinol)',
    form: 'softgel',
    dosage: '200mg daily',
    timing: 'with largest meal',
    priority: 'high',
    domains: ['cv'],
    rationale: 'Supports mitochondrial energy production and endothelial function in patients with elevated CV risk score (72/100) and sedentary lifestyle; ubiquinol form has superior bioavailability.',
  },
  {
    name: 'Berberine HCl',
    form: 'capsule',
    dosage: '500mg twice daily with meals',
    timing: 'with breakfast and dinner',
    priority: 'critical',
    domains: ['metabolic'],
    rationale: 'Addresses early insulin resistance evidenced by HbA1c 5.9% and fasting glucose 5.8 mmol/L via AMPK pathway activation; reduces hepatic glucose production and improves peripheral insulin sensitivity.',
  },
  {
    name: 'Magnesium Glycinate',
    form: 'capsule',
    dosage: '400mg nightly',
    timing: 'before bed',
    priority: 'recommended',
    domains: ['metabolic', 'neuro'],
    rationale: 'Addresses magnesium insufficiency common in metabolic syndrome; improves sleep quality (currently 6.5h) which directly impacts cortisol-driven metabolic dysregulation.',
  },
  {
    name: 'Vitamin D3+K2',
    form: 'softgel',
    dosage: 'D3 5000 IU + K2 MK-7 200mcg daily',
    timing: 'with breakfast',
    priority: 'recommended',
    domains: ['onco', 'metabolic'],
    rationale: 'Corrects likely vitamin D insufficiency (common in sedentary indoor lifestyle); K2 directs calcium to bone rather than arterial walls, reducing arterial calcification risk in the context of elevated CV score.',
  },
];

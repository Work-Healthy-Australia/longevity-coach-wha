import type { PatientContext } from '@/lib/ai/patient-context';

export const SEED_PATIENT_CONTEXT: PatientContext = {
  userId: 'seed-patient-001',

  profile: {
    fullName: 'James Holloway',
    // DOB giving age ~42 as of 2026
    dateOfBirth: '1984-03-15',
    phone: null,
    role: 'user',
  },

  riskScores: {
    cvRisk: 72,
    metabolicRisk: 68,
    neuroRisk: 28,
    oncoRisk: 22,
    mskRisk: 45,
    biologicalAge: 47,
    narrative:
      'James presents with elevated cardiovascular and metabolic risk driven primarily by dyslipidaemia and a sedentary lifestyle. Family history of early MI adds significant heritable risk. Metabolic markers suggest early insulin resistance that warrants lifestyle and nutritional intervention.',
    topRiskDrivers: ['elevated LDL', 'sedentary lifestyle', 'family history MI'],
    topProtectiveLevers: ['non-smoker', 'low alcohol intake'],
    recommendedScreenings: ['coronary calcium score', 'OGTT', 'sleep study'],
    confidenceLevel: 'moderate',
    dataGaps: ['DEXA scan', 'continuous glucose monitor'],
    createdAt: '2026-04-01T00:00:00.000Z',
  },

  healthProfile: {
    responses: {
      smoking: 'no',
      alcohol: 'occasional',
      exercise_frequency: '1_per_week',
      diet_quality: 'average',
      sleep_hours: 6.5,
      stress_level: 'moderate',
    },
    completedAt: '2026-04-01T00:00:00.000Z',
  },

  uploads: [
    {
      id: 'upload-001',
      originalFilename: 'blood-panel-march-2026.pdf',
      janetCategory: 'pathology',
      janetSummary: 'LDL 4.8 mmol/L, HDL 1.1 mmol/L, TG 2.3 mmol/L, HbA1c 5.9%, fasting glucose 5.8 mmol/L',
      janetFindings: {
        ldl: 4.8,
        hdl: 1.1,
        triglycerides: 2.3,
        hba1c: 5.9,
        fasting_glucose: 5.8,
      },
      createdAt: '2026-03-20T00:00:00.000Z',
    },
  ],

  supplementPlan: {
    items: [
      {
        name: 'Omega-3 Fish Oil',
        form: 'softgel',
        dosage: '2g EPA+DHA daily',
        timing: 'with dinner',
        priority: 'critical',
        domains: ['cv', 'metabolic'],
        rationale: 'Reduces triglycerides (currently 2.3 mmol/L) and supports cardiovascular risk reduction in the context of elevated LDL and family MI history.',
      },
      {
        name: 'CoQ10 (Ubiquinol)',
        form: 'softgel',
        dosage: '200mg daily',
        timing: 'with largest meal',
        priority: 'high',
        domains: ['cv'],
        rationale: 'Supports mitochondrial function and endothelial health; relevant given elevated CV risk score of 72 and sedentary lifestyle.',
      },
      {
        name: 'Berberine HCl',
        form: 'capsule',
        dosage: '500mg twice daily with meals',
        timing: 'with breakfast and dinner',
        priority: 'critical',
        domains: ['metabolic'],
        rationale: 'Addresses early insulin resistance (HbA1c 5.9%, fasting glucose 5.8) via AMPK activation; evidence-based alternative to metformin for pre-diabetic range.',
      },
      {
        name: 'Magnesium Glycinate',
        form: 'capsule',
        dosage: '400mg nightly',
        timing: 'before bed',
        priority: 'recommended',
        domains: ['metabolic', 'neuro'],
        rationale: 'Addresses common deficiency in metabolic syndrome; supports sleep quality (currently 6.5h) and insulin sensitivity.',
      },
      {
        name: 'Vitamin D3+K2',
        form: 'softgel',
        dosage: 'D3 5000 IU + K2 MK-7 200mcg daily',
        timing: 'with breakfast',
        priority: 'recommended',
        domains: ['onco', 'metabolic'],
        rationale: 'Corrects likely vitamin D insufficiency; K2 ensures calcium directs to bone not arteries, relevant given CV risk profile.',
      },
    ],
    createdAt: '2026-04-05T00:00:00.000Z',
  },

  recentConversation: [
    {
      role: 'user',
      content: 'What is my cardiovascular risk score and what does it mean?',
      created_at: '2026-04-10T09:00:00.000Z',
    },
    {
      role: 'assistant',
      content:
        'Your cardiovascular risk score is 72 out of 100, which places you in the elevated risk category. The main drivers are your LDL cholesterol of 4.8 mmol/L, a sedentary lifestyle (exercise once a week), and your family history of heart attack. This does not mean a heart attack is inevitable — it means these are the levers we can act on.',
      created_at: '2026-04-10T09:01:00.000Z',
    },
    {
      role: 'user',
      content: 'My LDL is high — should I be worried about it?',
      created_at: '2026-04-10T09:03:00.000Z',
    },
  ],

  knowledgeChunks: [
    'LDL cholesterol above 4.0 mmol/L is associated with significantly increased atherosclerotic risk. Lifestyle interventions including increased aerobic activity, reduced saturated fat intake, and omega-3 supplementation can reduce LDL by 10–20%. Statin therapy should be considered when LDL remains elevated after 3–6 months of lifestyle intervention, particularly in patients with additional risk factors such as family history of cardiovascular disease.',
    'Cardiovascular risk reduction requires a multi-modal approach. Exercise (150+ min/week moderate intensity) reduces CV events by 35%. Mediterranean diet reduces LDL oxidation. Fish oil (2g EPA+DHA) reduces triglycerides by 25–30%. Stress management addresses cortisol-driven dyslipidaemia. Screening with coronary calcium score provides prognostic information beyond traditional risk calculators.',
  ],

  recentDigests: [
    {
      title: 'Omega-3 supplementation reduces major adverse cardiovascular events in high-risk patients',
      content:
        'A 2025 meta-analysis of 12 RCTs (n=84,000) confirmed that high-dose EPA supplementation (4g/day) reduces MACE by 18% in patients with elevated triglycerides and established or high-risk cardiovascular disease. Benefits were strongest in patients with TG >1.5 mmol/L.',
      category: 'cv',
      evidence_level: 'high',
      created_at: '2026-04-20T00:00:00.000Z',
    },
  ],

  conversationSummary: null,
};

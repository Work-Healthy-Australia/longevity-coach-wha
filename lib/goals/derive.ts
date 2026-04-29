export interface DailyGoals {
  steps: number;
  sleepHours: number;
  waterGlasses: number;
  meditationMin: number | null;
}

export interface RiskInputs {
  cvRisk: number | null;
  metabolicRisk: number | null;
  neuroRisk: number | null;
  mskRisk: number | null;
  weightKg: number | null;
  stressAnxietyIndicator: boolean;
}

export function deriveGoals(inputs: RiskInputs): DailyGoals {
  // Steps: MSK high → 6000, CV high → 10000, default 8000
  let steps = 8000;
  if (inputs.mskRisk != null && inputs.mskRisk >= 60) steps = 6000;
  else if (inputs.cvRisk != null && inputs.cvRisk >= 60) steps = 10000;

  // Sleep: neuro high → 8h, default 7.5h
  const sleepHours = (inputs.neuroRisk != null && inputs.neuroRisk >= 60) ? 8 : 7.5;

  // Water: body weight × 0.033L → glasses (250ml each); default 8 glasses
  const waterGlasses = inputs.weightKg != null
    ? Math.round((inputs.weightKg * 0.033) / 0.25)
    : 8;

  // Meditation: stress/anxiety indicator → 10 min; else null
  const meditationMin = inputs.stressAnxietyIndicator ? 10 : null;

  return { steps, sleepHours, waterGlasses, meditationMin };
}

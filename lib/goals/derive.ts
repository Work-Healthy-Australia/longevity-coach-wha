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
  oncoRisk: number | null;
  weightKg: number | null;
  stressLevel: string | null;   // "Low" | "Moderate" | "High" | "Chronic/severe" from questionnaire
}

/**
 * Derive personalised daily goals from the patient's risk profile.
 *
 * Steps:
 *   - MSK high (≥60)  → lower to 6,000 (joint protection)
 *   - CV high (≥60)    → raise to 10,000 (cardiovascular benefit)
 *   - CV moderate (≥40)→ 9,000
 *   - default 8,000
 *
 * Sleep:
 *   - Neuro high (≥60)      → 8.5h (sleep is neuroprotective)
 *   - Neuro moderate (≥40)  → 8h
 *   - Metabolic high (≥60)  → 8h (insulin sensitivity improves with sleep)
 *   - default 7.5h
 *
 * Water:
 *   - Body weight formula if known: weight × 0.033L ÷ 0.25L per glass
 *   - Metabolic high → +1 glass (hydration supports glucose regulation)
 *   - default 8 glasses
 *
 * Meditation:
 *   - Stress High/Chronic   → 15 min
 *   - Stress Moderate        → 10 min
 *   - Neuro high (≥60)      → 10 min (cortisol ↔ neurodegeneration link)
 *   - else null (not prescribed)
 */
export function deriveGoals(inputs: RiskInputs): DailyGoals {
  // --- Steps ---
  let steps = 8000;
  if (inputs.mskRisk != null && inputs.mskRisk >= 60) {
    steps = 6000;
  } else if (inputs.cvRisk != null && inputs.cvRisk >= 60) {
    steps = 10000;
  } else if (inputs.cvRisk != null && inputs.cvRisk >= 40) {
    steps = 9000;
  }

  // --- Sleep ---
  let sleepHours = 7.5;
  if (inputs.neuroRisk != null && inputs.neuroRisk >= 60) {
    sleepHours = 8.5;
  } else if (inputs.neuroRisk != null && inputs.neuroRisk >= 40) {
    sleepHours = 8;
  } else if (inputs.metabolicRisk != null && inputs.metabolicRisk >= 60) {
    sleepHours = 8;
  }

  // --- Water ---
  let waterGlasses = inputs.weightKg != null
    ? Math.round((inputs.weightKg * 0.033) / 0.25)
    : 8;
  if (inputs.metabolicRisk != null && inputs.metabolicRisk >= 60) {
    waterGlasses += 1;
  }

  // --- Meditation ---
  const stress = inputs.stressLevel?.toLowerCase() ?? "";
  let meditationMin: number | null = null;
  if (stress === "chronic/severe" || stress === "high") {
    meditationMin = 15;
  } else if (stress === "moderate") {
    meditationMin = 10;
  } else if (inputs.neuroRisk != null && inputs.neuroRisk >= 60) {
    meditationMin = 10;
  }

  return { steps, sleepHours, waterGlasses, meditationMin };
}

/**
 * Extract goal-relevant fields from questionnaire responses JSONB.
 *
 * Call this once after reading `health_profiles.responses`, then pass the
 * result alongside risk scores to `deriveGoals()`.
 */
export function extractGoalInputs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  responses: Record<string, any> | null,
): { weightKg: number | null; stressLevel: string | null } {
  if (!responses) return { weightKg: null, stressLevel: null };

  const basics = (responses.basics ?? {}) as Record<string, unknown>;
  const lifestyle = (responses.lifestyle ?? {}) as Record<string, unknown>;

  const rawWeight = basics.weight_kg;
  const weightKg = typeof rawWeight === "number" && rawWeight > 0 ? rawWeight : null;

  const rawStress = lifestyle.stress;
  const stressLevel = typeof rawStress === "string" ? rawStress : null;

  return { weightKg, stressLevel };
}

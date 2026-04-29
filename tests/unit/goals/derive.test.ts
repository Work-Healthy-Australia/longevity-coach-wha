import { describe, it, expect } from 'vitest';
import { deriveGoals, extractGoalInputs } from '@/lib/goals/derive';

const base = {
  cvRisk: null,
  metabolicRisk: null,
  neuroRisk: null,
  mskRisk: null,
  oncoRisk: null,
  weightKg: null,
  stressLevel: null,
};

describe('deriveGoals', () => {
  // --- Steps ---
  it('defaults to 8000 steps', () => {
    expect(deriveGoals(base).steps).toBe(8000);
  });

  it('reduces to 6000 steps when MSK risk >= 60', () => {
    expect(deriveGoals({ ...base, mskRisk: 60 }).steps).toBe(6000);
    expect(deriveGoals({ ...base, mskRisk: 80 }).steps).toBe(6000);
  });

  it('increases to 10000 steps when CV risk >= 60', () => {
    expect(deriveGoals({ ...base, cvRisk: 60 }).steps).toBe(10000);
    expect(deriveGoals({ ...base, cvRisk: 75 }).steps).toBe(10000);
  });

  it('sets 9000 steps when CV risk is moderate (40–59)', () => {
    expect(deriveGoals({ ...base, cvRisk: 40 }).steps).toBe(9000);
    expect(deriveGoals({ ...base, cvRisk: 59 }).steps).toBe(9000);
  });

  it('MSK >= 60 overrides CV >= 60 (MSK wins)', () => {
    expect(deriveGoals({ ...base, mskRisk: 65, cvRisk: 70 }).steps).toBe(6000);
  });

  // --- Sleep ---
  it('defaults to 7.5h sleep', () => {
    expect(deriveGoals(base).sleepHours).toBe(7.5);
  });

  it('increases sleep to 8.5h when neuro risk >= 60', () => {
    expect(deriveGoals({ ...base, neuroRisk: 60 }).sleepHours).toBe(8.5);
    expect(deriveGoals({ ...base, neuroRisk: 90 }).sleepHours).toBe(8.5);
  });

  it('increases sleep to 8h when neuro risk is moderate (40–59)', () => {
    expect(deriveGoals({ ...base, neuroRisk: 40 }).sleepHours).toBe(8);
    expect(deriveGoals({ ...base, neuroRisk: 59 }).sleepHours).toBe(8);
  });

  it('increases sleep to 8h when metabolic risk >= 60', () => {
    expect(deriveGoals({ ...base, metabolicRisk: 60 }).sleepHours).toBe(8);
  });

  it('neuro risk takes priority over metabolic risk for sleep', () => {
    // neuro >= 60 → 8.5h, even though metabolic >= 60 would give 8h
    expect(deriveGoals({ ...base, neuroRisk: 65, metabolicRisk: 70 }).sleepHours).toBe(8.5);
  });

  // --- Water ---
  it('defaults water to 8 glasses when no weight', () => {
    expect(deriveGoals(base).waterGlasses).toBe(8);
  });

  it('calculates water from weight (80kg)', () => {
    // 80 * 0.033 = 2.64L / 0.25L = 10.56 → rounds to 11
    expect(deriveGoals({ ...base, weightKg: 80 }).waterGlasses).toBe(11);
  });

  it('adds 1 glass when metabolic risk >= 60', () => {
    expect(deriveGoals({ ...base, metabolicRisk: 60 }).waterGlasses).toBe(9); // 8 + 1
  });

  it('adds 1 glass on top of weight-derived water', () => {
    // 80kg → 11, + metabolic bonus → 12
    expect(deriveGoals({ ...base, weightKg: 80, metabolicRisk: 65 }).waterGlasses).toBe(12);
  });

  // --- Meditation ---
  it('no meditation by default', () => {
    expect(deriveGoals(base).meditationMin).toBeNull();
  });

  it('prescribes 15 min meditation when stress is High', () => {
    expect(deriveGoals({ ...base, stressLevel: 'High' }).meditationMin).toBe(15);
  });

  it('prescribes 15 min meditation when stress is Chronic/severe', () => {
    expect(deriveGoals({ ...base, stressLevel: 'Chronic/severe' }).meditationMin).toBe(15);
  });

  it('prescribes 10 min meditation when stress is Moderate', () => {
    expect(deriveGoals({ ...base, stressLevel: 'Moderate' }).meditationMin).toBe(10);
  });

  it('prescribes 10 min meditation when neuro risk >= 60 (even without stress)', () => {
    expect(deriveGoals({ ...base, neuroRisk: 60 }).meditationMin).toBe(10);
  });

  it('stress level takes priority over neuro risk for meditation', () => {
    // Stress High → 15, not neuro's 10
    expect(deriveGoals({ ...base, stressLevel: 'High', neuroRisk: 65 }).meditationMin).toBe(15);
  });

  it('no meditation for Low stress with no neuro risk', () => {
    expect(deriveGoals({ ...base, stressLevel: 'Low' }).meditationMin).toBeNull();
  });
});

describe('extractGoalInputs', () => {
  it('returns nulls for null responses', () => {
    expect(extractGoalInputs(null)).toEqual({ weightKg: null, stressLevel: null });
  });

  it('returns nulls for empty responses', () => {
    expect(extractGoalInputs({})).toEqual({ weightKg: null, stressLevel: null });
  });

  it('extracts weight from basics.weight_kg', () => {
    const result = extractGoalInputs({ basics: { weight_kg: 82 } });
    expect(result.weightKg).toBe(82);
  });

  it('extracts stress from lifestyle.stress', () => {
    const result = extractGoalInputs({ lifestyle: { stress: 'High' } });
    expect(result.stressLevel).toBe('High');
  });

  it('ignores zero weight', () => {
    const result = extractGoalInputs({ basics: { weight_kg: 0 } });
    expect(result.weightKg).toBeNull();
  });

  it('ignores non-numeric weight', () => {
    const result = extractGoalInputs({ basics: { weight_kg: 'heavy' } });
    expect(result.weightKg).toBeNull();
  });

  it('extracts both fields together', () => {
    const result = extractGoalInputs({
      basics: { weight_kg: 75 },
      lifestyle: { stress: 'Moderate' },
    });
    expect(result).toEqual({ weightKg: 75, stressLevel: 'Moderate' });
  });
});

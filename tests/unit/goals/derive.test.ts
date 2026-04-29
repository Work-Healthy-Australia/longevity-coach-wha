import { describe, it, expect } from 'vitest';
import { deriveGoals } from '@/lib/goals/derive';

const base = {
  cvRisk: null,
  metabolicRisk: null,
  neuroRisk: null,
  mskRisk: null,
  weightKg: null,
  stressAnxietyIndicator: false,
};

describe('deriveGoals', () => {
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

  it('MSK >= 60 overrides CV >= 60 (MSK wins)', () => {
    expect(deriveGoals({ ...base, mskRisk: 65, cvRisk: 70 }).steps).toBe(6000);
  });

  it('defaults to 7.5h sleep', () => {
    expect(deriveGoals(base).sleepHours).toBe(7.5);
  });

  it('increases sleep to 8h when neuro risk >= 60', () => {
    expect(deriveGoals({ ...base, neuroRisk: 60 }).sleepHours).toBe(8);
    expect(deriveGoals({ ...base, neuroRisk: 90 }).sleepHours).toBe(8);
  });

  it('defaults water to 8 glasses when no weight', () => {
    expect(deriveGoals(base).waterGlasses).toBe(8);
  });

  it('calculates water from weight (80kg)', () => {
    // 80 * 0.033 = 2.64L / 0.25L = 10.56 → rounds to 11
    expect(deriveGoals({ ...base, weightKg: 80 }).waterGlasses).toBe(11);
  });

  it('no meditation by default', () => {
    expect(deriveGoals(base).meditationMin).toBeNull();
  });

  it('adds 10 min meditation when stress indicator true', () => {
    expect(deriveGoals({ ...base, stressAnxietyIndicator: true }).meditationMin).toBe(10);
  });
});

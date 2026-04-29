import type { DailyGoals } from "@/lib/goals/derive";

export type WellnessInput = {
  sleepHours: number | null;
  energy: number | null;
  mood: number | null;
  steps: number | null;
  waterMl: number | null;
  exerciseMin: number | null;
  hrv: number | null;
  restingHr: number | null;
  deepSleepPct: number | null;
  supplementsTaken: number;
  totalSupplements: number;
};

export type WellnessBreakdown = {
  total: number;
  sleep: number;
  movement: number;
  vitality: number;
  nutrition: number;
  recovery: number;
};

/**
 * Compute a 0–100 daily wellness score from check-in data vs personalised goals.
 *
 * Five equally-weighted pillars (20 pts each):
 *   Sleep     — hours vs target, bonus for deep sleep %
 *   Movement  — steps vs target + exercise minutes
 *   Vitality  — energy + mood (subjective wellbeing)
 *   Nutrition — water vs target + supplement adherence
 *   Recovery  — HRV quality + resting HR quality (or flat 10 if no wearable data)
 */
export function computeWellnessScore(
  input: WellnessInput,
  goals: DailyGoals,
): WellnessBreakdown {
  const sleep = scoreSleep(input, goals);
  const movement = scoreMovement(input, goals);
  const vitality = scoreVitality(input);
  const nutrition = scoreNutrition(input, goals);
  const recovery = scoreRecovery(input);
  const total = Math.round(sleep + movement + vitality + nutrition + recovery);

  return { total, sleep, movement, vitality, nutrition, recovery };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function ratio(value: number | null, target: number): number {
  if (value == null || target <= 0) return 0;
  return clamp(value / target, 0, 1);
}

function scoreSleep(input: WellnessInput, goals: DailyGoals): number {
  const hoursRatio = ratio(input.sleepHours, goals.sleepHours);
  let score = hoursRatio * 16;
  if (input.deepSleepPct != null) {
    // 20%+ deep sleep is excellent
    score += clamp(input.deepSleepPct / 20, 0, 1) * 4;
  } else {
    score += hoursRatio * 4;
  }
  return Math.round(score * 10) / 10;
}

function scoreMovement(input: WellnessInput, goals: DailyGoals): number {
  const stepsRatio = ratio(input.steps, goals.steps);
  const exerciseRatio = ratio(input.exerciseMin, 30);
  return Math.round((stepsRatio * 12 + exerciseRatio * 8) * 10) / 10;
}

function scoreVitality(input: WellnessInput): number {
  const energyRatio = ratio(input.energy, 10);
  const moodRatio = ratio(input.mood, 10);
  return Math.round((energyRatio * 10 + moodRatio * 10) * 10) / 10;
}

function scoreNutrition(input: WellnessInput, goals: DailyGoals): number {
  const waterTarget = goals.waterGlasses * 250;
  const waterRatio = ratio(input.waterMl, waterTarget);
  const suppRatio =
    input.totalSupplements > 0
      ? clamp(input.supplementsTaken / input.totalSupplements, 0, 1)
      : 0.5;
  return Math.round((waterRatio * 10 + suppRatio * 10) * 10) / 10;
}

function scoreRecovery(input: WellnessInput): number {
  if (input.hrv == null && input.restingHr == null) return 10;

  let score = 0;
  if (input.hrv != null) {
    // HRV 20–100+ ms range; 60+ is good for most adults
    score += clamp(input.hrv / 80, 0, 1) * 10;
  } else {
    score += 5;
  }
  if (input.restingHr != null) {
    // Lower is better: 50 bpm excellent, 80+ poor
    const hrQuality = clamp((90 - input.restingHr) / 40, 0, 1);
    score += hrQuality * 10;
  } else {
    score += 5;
  }
  return Math.round(score * 10) / 10;
}

export function scoreLabel(total: number): string {
  if (total >= 85) return "Excellent";
  if (total >= 70) return "Good";
  if (total >= 50) return "Fair";
  if (total >= 30) return "Needs attention";
  return "Low";
}

export function scoreColor(total: number): string {
  if (total >= 85) return "#2A7A5C";
  if (total >= 70) return "#3D8B6E";
  if (total >= 50) return "#B5722F";
  if (total >= 30) return "#C4632A";
  return "#B5452F";
}

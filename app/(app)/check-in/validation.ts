export type CheckInInput = {
  mood: number;
  energy: number;
  sleep_hours: number;
  exercise_minutes: number;
  steps: number;
  water_ml: number;
  notes: string | null;
};

export type ParseResult =
  | { ok: true; data: CheckInInput }
  | { ok: false; error: string };

export function parseCheckInForm(formData: FormData): ParseResult {
  const mood = Number(formData.get("mood"));
  const energy = Number(formData.get("energy"));
  const sleepHours = Number(formData.get("sleep_hours"));
  const exerciseMinutes = Number(formData.get("exercise_minutes"));
  const steps = Number(formData.get("steps"));
  const waterGlasses = Number(formData.get("water_glasses"));
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  if (!Number.isFinite(mood) || mood < 1 || mood > 10) {
    return { ok: false, error: "Mood must be between 1 and 10" };
  }
  if (!Number.isFinite(energy) || energy < 1 || energy > 10) {
    return { ok: false, error: "Energy must be between 1 and 10" };
  }
  if (!Number.isFinite(sleepHours) || sleepHours < 0 || sleepHours > 24) {
    return { ok: false, error: "Sleep hours must be between 0 and 24" };
  }
  if (
    !Number.isFinite(exerciseMinutes) ||
    exerciseMinutes < 0 ||
    exerciseMinutes > 600
  ) {
    return { ok: false, error: "Exercise minutes must be between 0 and 600" };
  }
  if (!Number.isFinite(steps) || steps < 0 || steps > 60000) {
    return { ok: false, error: "Steps must be between 0 and 60000" };
  }
  if (
    !Number.isFinite(waterGlasses) ||
    waterGlasses < 0 ||
    waterGlasses > 20
  ) {
    return { ok: false, error: "Water glasses must be between 0 and 20" };
  }

  return {
    ok: true,
    data: {
      mood,
      energy,
      sleep_hours: sleepHours,
      exercise_minutes: exerciseMinutes,
      steps: Math.round(steps),
      water_ml: Math.round(waterGlasses) * 250,
      notes,
    },
  };
}

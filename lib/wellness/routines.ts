export type RoutineCategory =
  | "morning"
  | "exercise"
  | "nutrition"
  | "recovery"
  | "evening";

export type RoutineItem = {
  id: string;
  label: string;
  category: RoutineCategory;
};

export const ROUTINE_CATEGORIES: {
  key: RoutineCategory;
  label: string;
  color: string;
}[] = [
  { key: "morning", label: "Morning", color: "#D97706" },
  { key: "exercise", label: "Exercise", color: "#DC2626" },
  { key: "nutrition", label: "Nutrition", color: "#059669" },
  { key: "recovery", label: "Recovery", color: "#E11D48" },
  { key: "evening", label: "Evening", color: "#6366F1" },
];

export const DEFAULT_ROUTINES: RoutineItem[] = [
  // Morning
  { id: "morning_hydration", label: "Morning hydration (500 ml)", category: "morning" },
  { id: "morning_supplements", label: "Morning supplements", category: "morning" },
  { id: "morning_meditation", label: "Meditation (10 min)", category: "morning" },
  { id: "morning_sunlight", label: "Sunlight exposure", category: "morning" },

  // Exercise
  { id: "workout", label: "Workout session", category: "exercise" },
  { id: "mobility", label: "Mobility / stretching (15 min)", category: "exercise" },

  // Nutrition
  { id: "breakfast", label: "Breakfast (high protein)", category: "nutrition" },
  { id: "lunch", label: "Lunch (balanced)", category: "nutrition" },
  { id: "dinner_early", label: "Dinner (early)", category: "nutrition" },
  { id: "hydration_goal", label: "Hit hydration goal (2.5 L)", category: "nutrition" },
  { id: "protein_goal", label: "Hit protein goal", category: "nutrition" },

  // Recovery
  { id: "sauna", label: "Sauna session", category: "recovery" },
  { id: "cold_plunge", label: "Cold plunge", category: "recovery" },

  // Evening
  { id: "wind_down", label: "Evening wind-down routine", category: "evening" },
  { id: "evening_supplements", label: "Evening supplements", category: "evening" },
  { id: "screen_off", label: "Screen off 1 hr before bed", category: "evening" },
  { id: "bedtime", label: "In bed by 10 pm", category: "evening" },
];

export function routinesByCategory(
  items: RoutineItem[],
): Map<RoutineCategory, RoutineItem[]> {
  const map = new Map<RoutineCategory, RoutineItem[]>();
  for (const cat of ROUTINE_CATEGORIES) {
    map.set(cat.key, items.filter((i) => i.category === cat.key));
  }
  return map;
}

export function completionPct(
  completed: Set<string>,
  items: RoutineItem[],
): number {
  if (items.length === 0) return 0;
  const done = items.filter((i) => completed.has(i.id)).length;
  return Math.round((done / items.length) * 100);
}

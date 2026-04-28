"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { parseCheckInForm } from "./validation";
import { triggerPipeline } from "@/lib/ai/trigger";

export type CheckInState = {
  error?: string;
  success?: boolean;
};

export async function saveCheckIn(
  _prev: CheckInState,
  formData: FormData,
): Promise<CheckInState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const parsed = parseCheckInForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const input = parsed.data;

  const today = new Date().toISOString().slice(0, 10);

  const { error } = await supabase
    .schema("biomarkers" as never)
    .from("daily_logs")
    .upsert(
      {
        user_uuid: user.id,
        log_date: today,
        mood: input.mood,
        energy_level: input.energy,
        sleep_hours: input.sleep_hours,
        workout_duration_min: input.exercise_minutes,
        workout_completed: input.exercise_minutes > 0,
        steps: input.steps,
        water_ml: input.water_ml,
        notes: input.notes,
      },
      { onConflict: "user_uuid,log_date" },
    );

  if (error) return { error: error.message };

  revalidatePath("/check-in");
  triggerPipeline("risk-narrative", user.id);
  return { success: true };
}

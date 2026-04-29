"use server";

import { createClient } from "@/lib/supabase/server";

export async function toggleRoutineItem(completedIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const todayStr = new Date().toISOString().slice(0, 10);

  await (supabase.schema("biomarkers" as never) as unknown as ReturnType<typeof supabase.schema>)
    .from("daily_logs")
    .upsert(
      {
        user_uuid: user.id,
        log_date: todayStr,
        routines_completed: completedIds,
      },
      { onConflict: "user_uuid,log_date" },
    );
}

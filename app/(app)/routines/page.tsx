import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ROUTINES, ROUTINE_CATEGORIES } from "@/lib/wellness/routines";
import { RoutineChecklist } from "./_components/routine-checklist";
import "./routines.css";

export const metadata = { title: "Daily Routines · Longevity Coach" };

export default async function RoutinesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const todayStr = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .schema("biomarkers" as never)
    .from("daily_logs")
    .select("routines_completed")
    .eq("user_uuid", user.id)
    .eq("log_date", todayStr)
    .maybeSingle() as { data: { routines_completed: string[] | null } | null };

  const completed = new Set<string>(existing?.routines_completed ?? []);

  return (
    <div className="lc-routines">
      <header className="lc-routines-header">
        <h1>Daily Routines</h1>
        <p>
          Track your morning-to-evening longevity habits. Consistency compounds —
          aim for 80%+ completion daily.
        </p>
      </header>

      <RoutineChecklist
        items={DEFAULT_ROUTINES}
        categories={ROUTINE_CATEGORIES}
        initialCompleted={Array.from(completed)}
      />
    </div>
  );
}

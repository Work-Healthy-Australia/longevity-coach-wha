import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { ScheduleClient, type AppointmentRow } from "./_client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ view?: "upcoming" | "past" }>;

export default async function SchedulePage({ searchParams }: { searchParams: SearchParams }) {
  const { view = "upcoming" } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();

  // Use the existing scheduled_at column (0014) rather than the
  // appointment_date + start_time pair that 0048 originally specced —
  // appointments was created upstream and we did not break that schema.
  const { data } = await admin
    .from("appointments")
    .select("id, patient_uuid, scheduled_at, duration_minutes, status, notes")
    .eq("clinician_uuid", user.id)
    .order("scheduled_at", { ascending: view === "upcoming" });

  const now = new Date().toISOString();
  const all = ((data ?? []) as Array<{
    id: string;
    patient_uuid: string;
    scheduled_at: string;
    duration_minutes: number;
    status: string;
    notes: string | null;
  }>).map<AppointmentRow>((a) => ({
    id: a.id,
    patient_uuid: a.patient_uuid,
    scheduled_at: a.scheduled_at,
    duration_minutes: a.duration_minutes,
    status: a.status,
    notes: a.notes,
  }));

  const rows = all.filter((a) => {
    const isFuture = a.scheduled_at >= now;
    if (view === "upcoming") return isFuture && a.status !== "completed" && a.status !== "cancelled" && a.status !== "no_show";
    return !isFuture || a.status === "completed" || a.status === "cancelled" || a.status === "no_show";
  });

  return (
    <div>
      <h1>Schedule</h1>
      <div className="sched-toggle">
        <Link href="/clinician/schedule?view=upcoming" className={view === "upcoming" ? "active" : ""}>Upcoming</Link>
        <Link href="/clinician/schedule?view=past" className={view === "past" ? "active" : ""}>Past</Link>
      </div>
      <ScheduleClient rows={rows} />
    </div>
  );
}

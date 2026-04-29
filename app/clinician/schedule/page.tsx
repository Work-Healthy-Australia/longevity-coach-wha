import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { ScheduleClient, type AppointmentRow } from "./_client";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { BookingRequests, type PendingRequest } from "./BookingRequests";

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

  // ── Appointments list (existing) ──────────────────────────────────────────

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

  // ── Clinician availability ────────────────────────────────────────────────

  const { data: availabilityData } = await admin
    .from("clinician_availability")
    .select("id, day_of_week, start_time, end_time")
    .eq("clinician_uuid", user.id)
    .eq("is_active", true)
    .order("day_of_week", { ascending: true });

  const slots = (availabilityData ?? []) as Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;

  // ── Pending booking requests ──────────────────────────────────────────────

  const { data: pendingRaw } = await admin
    .from("appointments")
    .select("id, scheduled_at, duration_minutes, patient_notes, patient_uuid")
    .eq("clinician_uuid", user.id)
    .eq("status", "pending")
    .order("scheduled_at", { ascending: true });

  const pendingAppointments = (pendingRaw ?? []) as Array<{
    id: string;
    scheduled_at: string;
    duration_minutes: number;
    patient_notes: string | null;
    patient_uuid: string;
  }>;

  // Fetch patient profiles for pending requests
  const patientUuids = [...new Set(pendingAppointments.map((a) => a.patient_uuid))];
  const profileMap: Record<string, string> = {};

  if (patientUuids.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", patientUuids);

    for (const p of profiles ?? []) {
      const profile = p as { id: string; full_name: string | null };
      profileMap[profile.id] = profile.full_name ?? `Patient ${profile.id.slice(0, 8)}`;
    }
  }

  const pendingRequests: PendingRequest[] = pendingAppointments.map((a) => ({
    id: a.id,
    patient_name: profileMap[a.patient_uuid] ?? `Patient ${a.patient_uuid.slice(0, 8)}`,
    scheduled_at: a.scheduled_at,
    duration_minutes: a.duration_minutes,
    patient_notes: a.patient_notes,
  }));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <h1>Schedule</h1>
      <div className="sched-toggle">
        <Link href="/clinician/schedule?view=upcoming" className={view === "upcoming" ? "active" : ""}>Upcoming</Link>
        <Link href="/clinician/schedule?view=past" className={view === "past" ? "active" : ""}>Past</Link>
      </div>
      <ScheduleClient rows={rows} />

      <section className="sched-section">
        <h2 className="sched-section__heading">Weekly availability</h2>
        <AvailabilityGrid initialSlots={slots} />
      </section>

      <section className="sched-section">
        <h2 className="sched-section__heading">Pending session requests</h2>
        <BookingRequests initialRequests={pendingRequests} />
      </section>
    </div>
  );
}

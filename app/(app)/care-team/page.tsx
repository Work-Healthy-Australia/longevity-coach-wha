import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { loose } from "@/lib/supabase/loose-table";
import SlotCalendar from "@/app/(app)/care-team/SlotCalendar";
import CancelSessionButton from "@/app/(app)/care-team/CancelSessionButton";
import "./care-team.css";

export const dynamic = "force-dynamic";

const CANCEL_CUTOFF_HOURS = 24;

// Generate concrete available slots for the next 28 days, capped at 20.
function generateAvailableSlots(
  availability: Array<{ day_of_week: number; start_time: string; end_time: string }>,
  booked: Array<{ scheduled_at: string; duration_minutes: number }>,
  sessionDurationMinutes: number
): Array<{ dateTime: string; label: string }> {
  const now = new Date();
  const minStart = new Date(now.getTime() + 2 * 60 * 60 * 1000); // now + 2h
  const maxDate = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);
  const slots: Array<{ dateTime: string; label: string }> = [];

  for (let d = 0; d < 28 && slots.length < 20; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    date.setHours(0, 0, 0, 0);
    const dayOfWeek = date.getDay(); // 0=Sun

    for (const avail of availability) {
      if (avail.day_of_week !== dayOfWeek) continue;

      const [sh, sm] = avail.start_time.split(":").map(Number);
      const [eh, em] = avail.end_time.split(":").map(Number);
      const slotStart = new Date(date);
      slotStart.setHours(sh, sm, 0, 0);
      const slotEnd = new Date(date);
      slotEnd.setHours(eh, em, 0, 0);

      if (slotStart < minStart || slotStart >= maxDate) continue;
      // Ensure slot fits within the availability window
      if (
        new Date(slotStart.getTime() + sessionDurationMinutes * 60 * 1000) >
        slotEnd
      )
        continue;

      // Check overlap with booked appointments
      const overlaps = booked.some((b) => {
        const bs = new Date(b.scheduled_at);
        const be = new Date(bs.getTime() + b.duration_minutes * 60 * 1000);
        const ss = slotStart;
        const se = new Date(slotStart.getTime() + sessionDurationMinutes * 60 * 1000);
        return ss < be && se > bs;
      });
      if (overlaps) continue;

      const label = slotStart.toLocaleString("en-AU", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      slots.push({ dateTime: slotStart.toISOString(), label });
      if (slots.length >= 20) break;
    }
  }
  return slots;
}

function getInitials(fullName: string | null | undefined): string {
  if (!fullName) return "?";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (
    (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
  );
}

type ClinicianProfileRow = {
  specialties?: string[] | null;
  bio?: string | null;
  session_duration_minutes?: number | null;
  timezone?: string | null;
  is_active?: boolean | null;
};

export default async function CareTeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Find the patient's active clinician assignment
  const { data: assignment } = await supabase
    .from("patient_assignments")
    .select("clinician_uuid")
    .eq("patient_uuid", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!assignment?.clinician_uuid) {
    return (
      <div className="lc-care">
        <h1>Care team</h1>
        <p className="lc-care__empty">
          No care team assigned yet. Contact support to be matched with a
          clinician.
        </p>
      </div>
    );
  }

  const clinicianUuid = assignment.clinician_uuid;
  const admin = createAdminClient();

  // Load clinician profile + auth profile in parallel
  const [profileRes, clinicianProfileRes] = await Promise.all([
    admin
      .from("profiles")
      .select("full_name")
      .eq("id", clinicianUuid)
      .maybeSingle(),
    loose(admin)
      .from("clinician_profiles")
      .select("specialties, bio, session_duration_minutes, timezone, is_active")
      .eq("user_uuid", clinicianUuid)
      .maybeSingle(),
  ]);

  const clinicianName = (profileRes.data?.full_name as string | null) ?? "Clinician";
  const clinicianProfile = (clinicianProfileRes.data as ClinicianProfileRow | null) ?? {};
  const isActive = clinicianProfile.is_active !== false; // default true if null
  const sessionDuration = clinicianProfile.session_duration_minutes ?? 30;
  const specialties: string[] = Array.isArray(clinicianProfile.specialties)
    ? (clinicianProfile.specialties as string[])
    : [];

  // Load availability + booked appointments + patient's upcoming appointments in parallel
  const [availabilityRes, bookedRes, upcomingAppts] = await Promise.all([
    admin
      .from("clinician_availability")
      .select("day_of_week, start_time, end_time")
      .eq("clinician_uuid", clinicianUuid)
      .eq("is_active", true)
      .order("day_of_week")
      .order("start_time"),
    admin
      .from("appointments")
      .select("scheduled_at, duration_minutes")
      .eq("clinician_uuid", clinicianUuid)
      .in("status", ["pending", "confirmed"])
      .gte("scheduled_at", new Date().toISOString()),
    supabase
      .from("appointments")
      .select("id, scheduled_at, duration_minutes, status")
      .eq("patient_uuid", user.id)
      .in("status", ["pending", "confirmed"])
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(5),
  ]);

  const availableSlots = isActive
    ? generateAvailableSlots(
        availabilityRes.data ?? [],
        bookedRes.data ?? [],
        sessionDuration
      )
    : [];

  const upcomingList = upcomingAppts.data ?? [];

  return (
    <div className="lc-care">
      <h1>Care team</h1>

      {/* Clinician card */}
      <div className="lc-care__clinician-card">
        <div className="lc-care__clinician-header">
          <div className="lc-care__avatar" aria-hidden="true">
            {getInitials(clinicianName)}
          </div>
          <div>
            <p className="lc-care__clinician-name">{clinicianName}</p>
            <p className="lc-care__clinician-duration">
              Session duration: {sessionDuration}min
            </p>
          </div>
        </div>

        {specialties.length > 0 && (
          <div className="lc-care__specialties">
            {specialties.map((s) => (
              <span key={s} className="lc-care__specialty-tag">
                {s}
              </span>
            ))}
          </div>
        )}

        {clinicianProfile.bio && (
          <p className="lc-care__bio">{clinicianProfile.bio}</p>
        )}

        {!isActive && (
          <div className="lc-care__unavailable">
            Clinician unavailable — bookings are paused for this clinician.
            Please contact support.
          </div>
        )}
      </div>

      {/* Booking calendar — only when clinician is active */}
      {isActive && (
        <section>
          <h2 className="lc-care__section-heading">Book a session</h2>
          <SlotCalendar
            availableSlots={availableSlots}
            clinicianUuid={clinicianUuid}
          />
        </section>
      )}

      {/* Upcoming sessions */}
      {upcomingList.length > 0 && (
        <section>
          <h2 className="lc-care__section-heading">Upcoming sessions</h2>
          <ul className="lc-care__upcoming" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {upcomingList.map((appt) => {
              const dt = new Date(appt.scheduled_at as string);
              const dateLabel = dt.toLocaleString("en-AU", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              });
              // Server component — runs once per request, so impure-function
              // rule's re-render instability concern doesn't apply.
              // eslint-disable-next-line react-hooks/purity
              const hoursUntilStart = (dt.getTime() - Date.now()) / (1000 * 60 * 60);
              const cancellable = hoursUntilStart >= CANCEL_CUTOFF_HOURS;
              return (
                <li key={appt.id as string} className="lc-care__upcoming-item">
                  <div className="lc-care__upcoming-info">
                    <div className="lc-care__upcoming-date">{dateLabel}</div>
                    <div className="lc-care__upcoming-duration">
                      {appt.duration_minutes as number}min session
                    </div>
                  </div>
                  <div className="lc-care__upcoming-actions">
                    <span
                      className={`lc-care__status-badge lc-care__status-badge--${appt.status as string}`}
                    >
                      {appt.status as string}
                    </span>
                    {cancellable ? (
                      <CancelSessionButton appointmentId={appt.id as string} />
                    ) : (
                      <span className="lc-care__cancel-deflect">
                        Inside 24h — contact {clinicianName} to cancel.
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

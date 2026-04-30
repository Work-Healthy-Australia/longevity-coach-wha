# Changelog — Clinician–Patient Booking Calendar

## 2026-04-30

### Added

**Migration 0055 — `supabase/migrations/0055_clinician_booking_calendar.sql`**
- New table `public.clinician_availability`: per-clinician recurring weekly slots (day_of_week 0–6, start_time, end_time). RLS: clinician own read/write, assigned-patient read-only.
- New columns on `public.appointments`: `video_link text`, `patient_notes text`, `clinician_notes text`, `requested_at timestamptz`, `accepted_at timestamptz`.
- `appointments` status CHECK constraint updated to include `'pending'` alongside existing `confirmed`, `completed`, `no_show`, `cancelled`.
- New `appointments_patient_insert` RLS policy: patients can self-insert appointments with `status = 'pending'` only.

**Clinician schedule page (`app/clinician/schedule/`)**
- `AvailabilityGrid.tsx` — 7-column weekly availability editor. Clinicians add time-block slots (30-min increments 06:00–20:00) per day. Slots persist to `clinician_availability`. Delete and add both use optimistic UI.
- `BookingRequests.tsx` — Pending booking request cards. Each card shows patient name, requested date/time, and patient's reason. Clinician can Accept (confirms appointment) or Decline (with optional reason, removes card).
- `actions.ts` — Four server actions: `upsertAvailabilitySlot`, `deleteAvailabilitySlot`, `acceptBookingRequest`, `declineBookingRequest`. All Zod-validated, all `auth.uid()`-guarded.
- `page.tsx` extended to load availability slots and pending requests and pass them to the new components.

**Patient care-team page (`app/(app)/care-team/`)**
- `page.tsx` — Server component. Loads active `patient_assignments`, then clinician profile (name, specialties, bio, session duration, active status). Generates available slots for next 28 days (2h minimum lead, max 20, overlap-checked against existing appointments). Renders clinician card, slot calendar, upcoming sessions.
- `SlotCalendar.tsx` — Client component. Week navigation (prev/next). Slots grouped by day. Clicking a slot opens an inline booking panel with optional-reason textarea. On submit calls `requestBooking`; on success shows confirmation card and disables the slot pill.
- `actions.ts` — `requestBooking` server action. Validates clinician UUID, future datetime, max-500 note. Verifies the clinician is the patient's assigned clinician before inserting a `pending` appointment.
- `care-team.css` — Scoped to `.lc-care`. Uses `--lc-*` design tokens. Styles for clinician card, avatar, specialty tags, calendar grid, slot pills, booking panel, confirmation card, upcoming sessions.

**Dashboard (`app/(app)/dashboard/`)**
- `page.tsx` — Care Team tile updated from coming-soon placeholder to a live `<Link href="/care-team">`.
- `dashboard.css` — `.lc-coming-tile--linked` modifier: full opacity, pointer cursor, hover highlight.

**Documentation**
- `docs/engineering/changes/2026-04-30-clinician-booking-calendar/PLAN.md`
- `docs/engineering/changes/2026-04-30-clinician-booking-calendar/QA_REPORT_wave1-3.md`
- `supabase/schema/public/tables/clinician_availability.sql` (new canonical)
- `supabase/schema/public/tables/appointments.sql` (updated canonical)

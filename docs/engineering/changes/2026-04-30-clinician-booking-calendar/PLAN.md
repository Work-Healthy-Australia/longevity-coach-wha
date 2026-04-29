# Plan: Clinician–Patient Two-Sided Booking Calendar
Date: 2026-04-30
Epic: 9 — The Care Team
Status: Awaiting user verification
Branch: feat/260430-booking-calendar
Source plan: docs/engineering/changes/2026-04-29-clinician-patient-booking-calendar/PLAN.md
Sign-off: Approved by product direction from Trac Nguyen, 2026-04-29.

## Objective

Build a two-sided booking calendar where patients can browse their assigned clinician's available time slots and request a session, and clinicians can declare their weekly availability (per-slot granularity) and accept or decline incoming session requests.

## Codebase state at implementation time (2026-04-30)

Divergences from the original plan written 2026-04-29:

| Original assumption | Actual state |
|---|---|
| Migration 0051 is latest | Highest on main is 0054 — use 0055 |
| `clinician_profiles` table needs creating | Already exists (migration 0048) |
| `appointments` table needs creating | Already exists (migration 0048, uses `scheduled_at`) |
| `profiles.role` needs 'clinician' | Already includes 'clinician', 'coach', 'health_manager' |
| Route group `app/(clinician)/` | Existing portal at `app/clinician/` (without parens) |
| `app/(clinician)/schedule/` needs scaffold | Exists at `app/clinician/schedule/page.tsx` + `_client.tsx` |

Existing `clinician_profiles` already has: `user_uuid`, `specialties`, `bio`, `languages`, `timezone`, `session_duration_minutes`, `is_active`.

Missing from `appointments`: `video_link`, `patient_notes`, `clinician_notes`, `requested_at`, `accepted_at`, and `'pending'` in status CHECK.

Missing entirely: `clinician_availability` table (per-slot recurring schedule — different from the existing `available_days`/`available_from`/`available_to` on `clinician_profiles`).

## Build order

Task execution must follow this strict order:
1. Task 1.1 (migration 0055)
2. Task 1.2 (TypeScript types — requires local Supabase OR manual update)
3. Tasks 2.1 and 2.2 can run in parallel (no shared files)
4. Task 3.1 → Task 3.2 (3.2 extends 3.1's page.tsx)

---

## Wave 1 — Database Foundation
Status: Built, awaiting merge

**What James can see after this wave merges:** No visible UI change. `clinician_availability` table exists in the DB; `appointments` has new columns; TypeScript types updated. App continues to build without errors.

### Task 1.1 — Migration 0055
Files:
- `supabase/migrations/0055_clinician_booking_calendar.sql` (new)
- `supabase/schema/public/tables/clinician_availability.sql` (new canonical)
- `supabase/schema/public/tables/appointments.sql` (update canonical)

What to build — one idempotent migration:
1. Create `clinician_availability` table:
   - `id uuid PK default gen_random_uuid()`
   - `clinician_uuid uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
   - `day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6)` (0=Sun)
   - `start_time time NOT NULL`
   - `end_time time NOT NULL`
   - `is_active boolean NOT NULL DEFAULT true`
   - `created_at timestamptz NOT NULL DEFAULT now()`
   - `UNIQUE (clinician_uuid, day_of_week, start_time)`
   - Enable RLS. Policies:
     - `clinician_availability_own_rw`: `USING (auth.uid() = clinician_uuid)` for all ops by clinician
     - `clinician_availability_patient_read`: `USING (EXISTS (SELECT 1 FROM patient_assignments pa WHERE pa.patient_uuid = auth.uid() AND pa.clinician_uuid = clinician_uuid AND pa.status = 'active'))` for SELECT

2. Alter `appointments` — all additive, all `IF NOT EXISTS`:
   - `video_link text`
   - `patient_notes text`
   - `clinician_notes text`
   - `requested_at timestamptz DEFAULT now()`
   - `accepted_at timestamptz`
   - Update status CHECK constraint to include `'pending'` (drop+re-add via anonymous DO block)
   - Add a patient-INSERT policy so patients can create `pending` appointments

### Task 1.2 — TypeScript types
File: `lib/supabase/database.types.ts`

Run `supabase gen types typescript --local > lib/supabase/database.types.ts` if local Supabase is running. Otherwise manually add the new types for `clinician_availability` and the new appointment columns.

---

## Wave 2 — Clinician Availability + Booking Requests
Status: Built, awaiting merge

**What James can see:** Log in as clinician → go to `/clinician/schedule`. Below existing appointments list, see two new sections: (1) weekly availability grid with add/delete slots, (2) pending booking requests from patients with accept/decline.

### Task 2.1 — Availability editor
Files:
- `app/clinician/schedule/AvailabilityGrid.tsx` (new "use client" component)
- `app/clinician/schedule/actions.ts` (extend — add `upsertAvailabilitySlot`, `deleteAvailabilitySlot`)
- `app/clinician/schedule/page.tsx` (extend — load slots, add section)
- `app/clinician/schedule/_client.tsx` (no change — leave existing appointment list intact)

Server actions (Zod-validated, auth.uid() verified):
- `upsertAvailabilitySlot(day: 0-6, startTime: "HH:MM", endTime: "HH:MM")`
- `deleteAvailabilitySlot(id: uuid)`

AvailabilityGrid: 7-column grid (Sun–Sat), slot pills per column, inline add form (30-min increments 06:00–20:00), optimistic UI.

### Task 2.2 — Pending booking requests
Files:
- `app/clinician/schedule/BookingRequests.tsx` (new "use client" component)
- `app/clinician/schedule/actions.ts` (extend — add `acceptBookingRequest`, `declineBookingRequest`)
- `app/clinician/schedule/page.tsx` (extend — load pending requests, add section)

Server actions (Zod-validated, auth.uid() verified):
- `acceptBookingRequest(appointmentId: uuid)` → status='confirmed', accepted_at=now()
- `declineBookingRequest(appointmentId: uuid, reason?: string)` → status='cancelled'

BookingRequests: card list of pending requests — patient name, requested date/time, patient_notes, Accept/Decline buttons. Empty state when none.

---

## Wave 3 — Patient Booking Flow
Status: Built, awaiting merge

**What James can see:** Log in as patient → dashboard Care Team tile links to `/care-team`. Patient sees clinician profile card, 28-day slot calendar, can book a session. Clinician sees the request in pending list.

### Task 3.1 — Care team route + clinician profile display
Files:
- `app/(app)/care-team/page.tsx` (new server component)
- `app/(app)/care-team/care-team.css` (new, scoped to `.lc-care`, `--lc-*` tokens)
- `app/(app)/dashboard/page.tsx` (update Care Team tile to link `/care-team`)

### Task 3.2 — Slot calendar + booking request submission
Files:
- `app/(app)/care-team/page.tsx` (extend — slot generation, upcoming sessions)
- `app/(app)/care-team/actions.ts` (new — `requestBooking` server action)
- `app/(app)/care-team/SlotCalendar.tsx` (new "use client" component)
- `app/(app)/care-team/care-team.css` (extend)

Slot generation: server-side, next 28 days, max 20 slots, excludes already-booked times and past slots (>= now + 2h).
SlotCalendar: week-view CSS grid, slot pills, booking panel on click, confirmation on success.

---

## Open questions for product owner before Wave 3 ships

1. **Auto-confirm vs require acceptance?** Current plan: always requires clinician acceptance (status starts as 'pending').
2. **Session types?** All bookings use `appointment_type = 'clinical_review'` for now.
3. **Cancellation?** Not implemented — deferred.

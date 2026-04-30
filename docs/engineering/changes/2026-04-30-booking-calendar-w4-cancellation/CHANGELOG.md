# Changelog — Booking Calendar Wave 4: Patient-Side Cancellation

## 2026-04-30

### Added

**Migration 0067 — `supabase/migrations/0067_appointment_cancellation.sql`**
- `appointments.status` CHECK constraint extended to include `'cancelled_by_patient'` and `'cancelled_by_clinician'` alongside the legacy `'cancelled'` value (kept for backward compatibility with the existing clinician-decline flow).
- New table `public.appointments_cancellation_log`: append-only audit trail. Columns: `id`, `appointment_id` (FK to `appointments`, on-delete cascade), `cancelled_by` (FK to `auth.users`, nullable / on-delete-set-null), `cancelled_role` (`'patient' | 'clinician' | 'admin' | 'system'`), `hours_before_start` (numeric, snapshot), `cancelled_at`. RLS: patient/clinician SELECT scoped through the parent appointment; admin full access; **no** INSERT/UPDATE/DELETE policies for any role.
- Trigger `appointments_log_cancellation_trg`: `AFTER UPDATE OF status ON appointments`. When status transitions to `'cancelled_by_patient'` or `'cancelled_by_clinician'`, inserts a row into `appointments_cancellation_log` with `cancelled_by = auth.uid()` and the role derived from the new status. Runs `SECURITY DEFINER` so the user-side update can write to the otherwise unwritable log table.
- New `appointments_patient_update_cancel` RLS policy: patients can UPDATE their own appointments only when the row is currently `'pending'` or `'confirmed'`, and only to set `status = 'cancelled_by_patient'`. All other patient-side writes remain blocked.

**Server action (`app/(app)/care-team/actions.ts`)**
- `cancelBooking(appointmentId)` — Zod-validates the UUID, checks auth, fetches the appointment, verifies ownership and that the status is still cancellable, computes `hoursUntilStart`, rejects with `inside_24h` if the session is less than 24 hours away, otherwise flips the row to `'cancelled_by_patient'`. Single user-side write; the audit log row is written by the DB trigger in the same transaction. `revalidatePath("/care-team")` on success.

**Patient care-team page (`app/(app)/care-team/`)**
- `page.tsx` — Upcoming sessions list now computes `hoursUntilStart` per row and renders either a Cancel control (>= 24h) or a static "Inside 24h — contact {clinicianName} to cancel" hint (< 24h). No `mailto:` link by design — secure messaging is the proper channel and lands next epic.
- `CancelSessionButton.tsx` (new) — Client component. Renders a Cancel button; clicking opens an inline confirm prompt ("Cancel this session? This cannot be undone.") with Keep/Cancel actions. On confirm, calls `cancelBooking` and shows a success or error toast.
- `care-team.css` — New scoped styles: `.lc-care__upcoming-info`, `.lc-care__upcoming-actions`, `.lc-care__cancel-btn`, `.lc-care__cancel-deflect`, `.lc-care__cancel-confirm` (+ children).

**Tests (`tests/integration/care-team/cancel-booking.test.ts`)**
- 14 new tests covering: unauthenticated rejection, malformed UUID rejection, not-found, wrong-owner, wrong-status (5 status variants), inside-24h deflect, exact 24h boundary, >24h confirmed, >24h pending, DB-update failure path. All assert that no `update()` call is made when the action rejects.

**Documentation**
- `docs/engineering/changes/2026-04-30-booking-calendar-w4-cancellation/PLAN.md`
- `docs/engineering/changes/2026-04-30-booking-calendar-w4-cancellation/CHANGELOG.md`
- `docs/engineering/changes/2026-04-30-booking-calendar-w4-cancellation/EXECUTIVE_SUMMARY.md`
- `supabase/schema/public/tables/appointments_cancellation_log.sql` (new canonical)
- `supabase/schema/public/tables/appointments.sql` (updated canonical — new status values, new patient-update policy)

### Type changes

`lib/supabase/database.types.ts` — added `appointments_cancellation_log` table types (Row/Insert/Update/Relationships) under `public`. Hand-edited because Docker / local Supabase is not running in this environment; structure mirrors the generator's output for adjacent tables.

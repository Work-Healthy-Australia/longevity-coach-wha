# QA Report — Booking Calendar Waves 1–3
Date: 2026-04-30
Branch: feat/260430-booking-calendar
Reviewer: Dev Team Loop (automated)

## Build

| Check | Result |
|---|---|
| `pnpm build` (pre-flight, main) | PASS |
| `pnpm build` (post Wave 1) | PASS |
| `pnpm build` (post Wave 2) | PASS |
| `pnpm build` (post Wave 3) | PASS |
| `pnpm test` (573 tests, 79 files) | PASS |

## Wave 1 — Database Foundation

| Check | Result |
|---|---|
| Migration file `0055_clinician_booking_calendar.sql` created | PASS |
| Migration is idempotent (IF NOT EXISTS guards, DROP IF EXISTS on policies) | PASS |
| `clinician_availability` table with RLS enabled | PASS |
| RLS policies: `clinician_availability_own_rw`, `clinician_availability_patient_read` | PASS |
| `appointments` columns added: video_link, patient_notes, clinician_notes, requested_at, accepted_at | PASS |
| `appointments` status constraint updated to include 'pending' | PASS |
| `appointments_patient_insert` RLS policy: patients can insert pending appointments only | PASS |
| TypeScript types updated: `clinician_availability` type added | PASS |
| TypeScript types updated: new appointment columns added | PASS |
| Canonical schema files created/updated | PASS |

## Wave 2 — Clinician Schedule Additions

| Check | Result |
|---|---|
| `app/clinician/schedule/actions.ts` created with 4 server actions | PASS |
| All server actions: Zod validation | PASS |
| All server actions: `auth.uid()` guard before writes | PASS |
| `AvailabilityGrid.tsx`: 7-column grid, add/delete slots, optimistic UI | PASS |
| `BookingRequests.tsx`: card list, Accept/Decline with optional reason | PASS |
| `app/clinician/schedule/page.tsx` extended (availability + pending requests sections) | PASS |
| Existing `_client.tsx` appointment list untouched | PASS |
| CSS styles appended to `clinician.css` | PASS |

## Wave 3 — Patient Booking Flow

| Check | Result |
|---|---|
| `app/(app)/care-team/page.tsx` created | PASS |
| `app/(app)/care-team/actions.ts` with `requestBooking` server action | PASS |
| `requestBooking`: Zod validation (UUID, future datetime, 500-char limit) | PASS |
| `requestBooking`: clinician-assignment ownership check | PASS |
| `app/(app)/care-team/SlotCalendar.tsx`: week nav, slot pills, booking panel | PASS |
| Slot generation: 28-day window, 2h minimum lead time, max 20 slots, overlap check | PASS |
| Upcoming sessions list rendered on care-team page | PASS |
| Dashboard Care Team tile updated to link `/care-team` | PASS |
| `care-team.css` scoped to `.lc-care` with `--lc-*` tokens | PASS |

## Regressions

- No existing tests broke (573/573 pass)
- No existing pages removed or broken
- `app/clinician/schedule/_client.tsx` was not modified

## Status

**APPROVED for user verification.**

---

## User verification required (cannot merge without these)

The following must be manually verified in the browser before merging:

### Clinician-side (`/clinician/schedule`)
1. Log in as a clinician-role user and navigate to `/clinician/schedule`
2. Confirm the "Weekly availability" section renders below the existing appointments list
3. Add a slot for Monday 9:00–10:00 AM → confirm it appears as a pill in the Mon column
4. Add a duplicate slot (same day + time) → confirm graceful error "Slot already exists"
5. Delete the slot → confirm it disappears optimistically
6. Confirm the "Pending session requests" section appears (may be empty — that's fine)

### Patient-side (`/care-team`)
1. Log in as a patient with an active `patient_assignments` row
2. Navigate to `/dashboard` → confirm the Care Team tile is now a live link
3. Click the Care Team tile → confirm you land on `/care-team`
4. Confirm the assigned clinician's profile card renders (name, specialties, bio, session duration)
5. If the clinician has `clinician_availability` slots set: confirm available slots appear as pills in the calendar
6. Book a session: click a slot, type a reason, submit → confirm "Request sent" confirmation appears
7. Log back in as the clinician → confirm the booking request appears under "Pending session requests"
8. Accept the request → confirm it moves to confirmed status

### Patient with no care team assigned
1. Log in as a patient with no `patient_assignments` row
2. Navigate to `/care-team` → confirm "No care team assigned yet" empty state renders

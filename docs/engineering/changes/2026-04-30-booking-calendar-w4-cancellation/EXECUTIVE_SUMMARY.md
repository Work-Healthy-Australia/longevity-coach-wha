# Executive Summary — Booking Calendar Wave 4: Patient-Side Cancellation

**Date:** 2026-04-30
**Epic:** 9 — The Care Team
**Predecessor:** Booking Calendar Waves 1–3 (PR #57)
**PR:** _pending — branch `feat/booking-calendar-w4-cancellation`, blocked by upstream `pnpm build` regression in `app/(app)/report/page.tsx`_
**Status:** Feature complete and tested; awaiting upstream build fix before browser verification and merge

## What was built

Patients can now cancel a pending or confirmed session from `/care-team` — provided the session is at least 24 hours away. The Cancel button only renders for sessions outside the 24-hour window; inside the window the UI replaces the button with a static "contact your clinician directly to cancel" hint (no `mailto:` link — secure messaging is the proper channel and lands next epic).

Every cancellation writes a row to a new append-only `appointments_cancellation_log` table via a Postgres trigger, capturing who cancelled (categorically, by role), how many hours before the session, and when. The trigger is wired to fire for clinician-side cancellations too once the existing decline flow migrates to typed status values.

## Why this shape

- **Trigger over app-level dual-write.** A `SECURITY DEFINER` trigger on `appointments` UPDATE is the single source of truth for log rows. The patient client makes one write (status flip); the trigger handles the audit row in the same transaction. No app-level rollback dance, no service-role escape hatch.
- **24-hour cutoff in app code, not the trigger.** Patients get a friendly "inside 24h" response rather than a SQL exception. RLS still hard-blocks any patient update outside `pending`/`confirmed`.
- **No reason field on the audit row.** Decision §6 of the PLAN keeps `appointments` lean; the trigger has no access to a free-text reason, so reason was dropped from the log. `cancelled_role` retains categorical signal.
- **No `mailto:` deflect.** Patients shouldn't have direct email access to clinicians by design; the deflect is a static hint until secure messaging deep-links replace it.

## What was not built (deferred — see PLAN §"Out of scope")

- Migration of the legacy clinician-decline flow from `'cancelled'` to `'cancelled_by_clinician'` (separate wave, paired with secure-messaging notifications).
- Notifying the clinician on patient cancellation (waits for secure messaging).
- "No-show" auto-flip cron after `scheduled_at + duration_minutes` lapses.
- Patient-side reschedule (cancel + re-book is sufficient for the pilot).
- Refund / credit logic (no payment flow on appointments).

## Test results

`pnpm test`: **610 passed (610)** across 82 files, including 14 new tests for `cancelBooking`. Zero regressions vs. the prior 596-test baseline.

`pnpm build`: **failing** — but the failure is a pre-existing Turbopack JSX parse error in `app/(app)/report/page.tsx:352`, present on `main` before this branch was cut. A separate task has been spawned to fix it.

## What the product owner needs to do

1. **Wait for the spawned `report/page.tsx` build fix** to merge to `main`.
2. **Rebase this branch** onto the fixed `main` and confirm `pnpm build` is clean.
3. **Browser-verify on `/care-team`:**
   - As a patient with at least one upcoming confirmed session >24h away → Cancel button renders → click → confirm → row disappears, slot returns to availability for booking.
   - As a patient with a session <24h away → see static "Inside 24h — contact {clinicianName} to cancel" hint instead of the button.
   - As the clinician of the cancelled session → status reflects on `/clinician/schedule` next visit.
4. **Apply migration 0067** to production (`supabase db push`) before deploying.
5. **Merge** the PR.

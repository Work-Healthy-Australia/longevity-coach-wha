# Executive Summary — Clinician–Patient Booking Calendar

**Date:** 2026-04-30
**Epic:** 9 — The Care Team
**PR:** https://github.com/Work-Healthy-Australia/longevity-coach-wha/pull/57
**Status:** Awaiting user verification before merge

## What was built

A two-sided booking system replacing the previous push-based model with a mutual-agency model:

**Clinicians** now have a dedicated availability editor on their schedule page. They set their open weekly slots (e.g. "Monday 9–10am, Wednesday 2–3pm") and see a pull-based queue of pending session requests from their patients. They choose which requests to accept or decline — they are never pushed work they didn't opt into.

**Patients** now have a `/care-team` page linked from the dashboard. They see their assigned clinician's profile (name, specialties, bio), a 28-day slot calendar showing real open times, and can request a session with an optional reason in a few clicks. After the request is sent, upcoming sessions (pending and confirmed) are listed on the same page.

## What was not built (deferred)

- Video call integration (link column is stored but not wired)
- Email/push notifications for booking events
- Patient-side session cancellation
- Multi-clinician practices

## Test results

573 unit/integration tests pass. Zero regressions.

## What the product owner needs to do

1. **Verify in the browser** — see `QA_REPORT_wave1-3.md` for the full checklist (3 flows: clinician adds availability, patient books a slot, clinician accepts)
2. **Apply migration 0055 to production** before deploying: `supabase db push` (or apply via Supabase dashboard)
3. **Merge PR #57** once verified

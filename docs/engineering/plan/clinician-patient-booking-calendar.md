# Clinician–Patient Booking Calendar
**Date:** 2026-04-29 · **Phase:** 5 — Care Network · **Sign-off:** Trac Nguyen, 2026-04-29

## Summary

Patients can book a clinical session with their assigned clinician directly inside the platform. Clinicians declare when they are available and choose which session requests to accept — nothing is pushed to them without their action. Both sides have full agency. No third-party booking service is used. Visually consistent with the existing patient dashboard.

---

## Epics — what gets built

### Epic 1 · Database foundation
- [ ] New `clinician_profiles` table — stores professional bio, specialties, timezone, session duration
- [ ] New `clinician_availability` table — clinician's recurring weekly open slots (e.g. Mon 9–10am)
- [ ] `appointments` table extended — adds `video_link`, `patient_notes`, `clinician_notes`, `requested_at`, `accepted_at`; status gains a `pending` state
- [ ] `profiles.role` updated to recognise `clinician` as a valid role
- [ ] TypeScript types regenerated

### Epic 2 · Clinician schedule page (`/clinician/schedule`)
- [ ] Clinician shell layout (top nav, name, sign-out) — same visual language as patient dashboard
- [ ] Weekly availability grid — clinician adds/removes open time slots per day
- [ ] Pending requests list — patient booking requests shown as cards; clinician accepts or declines each one

### Epic 3 · Patient care-team page (`/care-team`)
- [ ] Dashboard "Care Team" tile becomes a real link (currently a dead placeholder)
- [ ] Clinician profile card — shows name, specialties, bio, session length
- [ ] Slot calendar — shows the clinician's open slots for the next 28 days; patient clicks a slot to book
- [ ] Booking request form — optional reason field, submit sends a `pending` appointment to the clinician
- [ ] Upcoming sessions list — patient sees their confirmed and pending sessions

---

## Delivery order

| Wave | Delivers | Verify at |
|---|---|---|
| **Wave 1** | DB tables + types. Nothing visible to users, app stays fully functional. | `pnpm build` passes |
| **Wave 2** | Clinician schedule page live end-to-end | `http://localhost:3000/clinician/schedule` |
| **Wave 3** | Patient care-team + booking flow live end-to-end | `http://localhost:3000/care-team` |

Each wave is merged independently before the next begins.

---

## Key technical facts

- **Route guard already live** — `/clinician/*` is already protected in `lib/supabase/proxy.ts`. No changes needed there.
- **Migration number** — next migration is `0053` (two `0052` files already exist as a pre-existing quirk; leave them alone).
- **No third-party services** — calendar is a plain CSS grid. Date logic is native JavaScript. No Cal.com, Calendly, or similar.
- **Style tokens** — all pages use `--lc-primary: #2F6F8F`, `--lc-sage: #6B8E83`, `--lc-canvas: #FAFAF7` and the same card/shadow pattern as the dashboard. No Tailwind utilities.
- **Booking model** — patient requests a slot → status `pending` → clinician accepts/declines → status `confirmed` or `cancelled`.

---

## Pre-flight (before starting)

1. Run `supabase status` — local Supabase must be running for type generation in Wave 1.
2. Run `pnpm build` — confirm it passes clean before touching anything.
3. Run `SELECT DISTINCT role FROM profiles;` — confirm no unexpected role values exist before the constraint alteration.

---

## Open questions for James

1. **Auto-confirm or manual?** Should a booking auto-confirm when the slot is open, or always require clinician acceptance? (Current plan: always requires acceptance.)
2. **Session types?** Should patients choose a session type (Initial / Follow-up / Urgent)? Or is one type fine for now?
3. **Cancellations?** Can a patient cancel a confirmed session from the UI? How much notice is required? (Deferred from this plan.)

---

## Detailed implementation notes

Full wave-by-wave task breakdown, acceptance criteria, and file lists:
→ [`docs/engineering/changes/2026-04-29-clinician-patient-booking-calendar/PLAN.md`](../changes/2026-04-29-clinician-patient-booking-calendar/PLAN.md)

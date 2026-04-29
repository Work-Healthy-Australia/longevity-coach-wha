# Plan: Clinician–Patient Two-Sided Booking Calendar
Date: 2026-04-29
Phase: Phase 5 — Care Network (Epic 9)
Status: Ready for implementation
Sign-off: Approved by product direction from Trac Nguyen, 2026-04-29. Building ahead of current Phase 2 baseline with explicit owner approval.
Target: Production-ready. No placeholder pages. No third-party calendar libraries — pure CSS grid + native date logic only.

## Objective

Build a two-sided booking calendar where patients can browse their assigned clinician's available time slots and request a session, and clinicians can declare their weekly availability and accept or decline incoming session requests. Neither side is pushed work they didn't opt into: clinicians see a pull-based list of pending patient requests and choose which ones to accept; patients see only real open slots on their clinician's calendar. This replaces the push-based kanban review model with a mutual-agency model for session scheduling.

---

## Pre-flight checklist (run before Wave 1)

Claude Code must verify these before touching any files:

1. **Migration number** — The latest applied migration is `0051`. Files `0052_pricing_admin_foundation.sql` and `0052_upsert_supplement_advisor_agent.sql` are untracked (not yet applied). The new migration in this plan must be numbered `0053`.
2. **Existing duplicate migration numbers** — `0046`, `0051`, and `0052` each have two files with the same number. This is a pre-existing condition. Do not attempt to renumber or fix them — Supabase runs them alphabetically and they are stable. Simply use `0053` as the next number.
3. **Proxy guard already live** — `lib/supabase/proxy.ts` already contains the `/clinician` route protection (lines 1–91). `CLINICIAN_PREFIXES`, `CLINICIAN_ALLOWED_ROLES`, and the role-gate logic are fully implemented. **Do not modify `proxy.ts` or `lib/supabase/proxy.ts`.** Task 2.1 skips the proxy step entirely.
4. **Local Supabase required for type generation** — Task 1.2 runs `supabase gen types typescript --local`. This requires the local Supabase stack to be running. Before Task 1.2, verify with: `supabase status`. If not running, start it with: `supabase start` (takes ~60 seconds).
5. **pnpm available** — Confirm `pnpm build` runs without error on the current branch before starting. If it fails before any changes, stop and fix the pre-existing error first.

---

## Safety notes

- **`profiles.role` constraint change** — the migration drops and re-adds the CHECK constraint. If any existing `profiles` row has a `role` value not covered by the new constraint (e.g. a legacy value), the `ALTER TABLE` will fail. Before running the migration locally, verify: `SELECT DISTINCT role FROM profiles;` to confirm all existing values are in the new constraint list.
- **Appointments table alteration** — all changes are additive (new nullable columns). No data is altered, no columns are dropped. Zero risk of data loss.
- **New tables** — `clinician_profiles` and `clinician_availability` are net-new with RLS enabled. No existing functionality is affected by their creation.
- **No third-party services** — this plan uses zero external APIs for booking. Date/time logic is native JavaScript. The calendar UI is a CSS grid. No Calendly, Cal.com, or similar integrations.

---

## Scope

**In scope:**
- `clinician_profiles` table — professional identity, timezone, session duration
- `clinician_availability` table — recurring weekly open slots per clinician
- `appointments` table alterations — add `video_link`, `patient_notes`, `clinician_notes`, `requested_at`, `accepted_at`, update status check to include `pending`
- `profiles.role` CHECK constraint updated to include `'clinician'`
- `app/(clinician)/` route group with layout, proxy guard, and schedule page
- Clinician schedule page: weekly availability editor + incoming booking requests (pull-based, clinician accepts or declines)
- `app/(app)/care-team/` patient route: assigned clinician profile + available slot calendar + booking request form
- Dashboard "Care Team" tile linked to `/care-team`
- Canonical schema files updated alongside each migration
- TypeScript types regenerated after migrations

**Out of scope:**
- Video/telehealth integration (video_link stored but not wired)
- Email/push notifications for booking events (Wave 4, deferred)
- Multi-clinician practices or org-level booking
- Recurring appointment series
- Payment for sessions (billing schema, Phase 6)
- Janet-Clinician brief pipeline (separate feature, Phase 5 continuation)
- The push-based review kanban — it remains as-is; this plan adds the pull-based booking model alongside it

## Data model changes

### New table: `clinician_profiles`
Schema: `public`
Writer: clinician via schedule settings server action
PII note: No PII stored here. `bio` is professional-context copy, not identifying. Phone/address for the clinician stays on `profiles` (the PII boundary applies to all users, clinicians included). This table holds only professional metadata.
Columns:
- `id uuid PK default gen_random_uuid()`
- `user_uuid uuid NOT NULL UNIQUE REFERENCES auth.users(id)`
- `specialties text[] NOT NULL DEFAULT '{}'`
- `bio text`
- `languages text[] NOT NULL DEFAULT '{en}'`
- `timezone text NOT NULL DEFAULT 'Australia/Sydney'`
- `session_duration_minutes int NOT NULL DEFAULT 30 CHECK (session_duration_minutes IN (15,30,45,60))`
- `is_accepting_new_patients boolean NOT NULL DEFAULT true`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`
RLS: clinician reads/writes own row. Admins read all. Assigned patients can read (for booking page display).

### New table: `clinician_availability`
Schema: `public`
Writer: clinician via availability editor server action
Not PII.
Columns:
- `id uuid PK default gen_random_uuid()`
- `clinician_uuid uuid NOT NULL REFERENCES auth.users(id)`
- `day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6)` — 0=Sun, 1=Mon…6=Sat
- `start_time time NOT NULL`
- `end_time time NOT NULL`
- `is_active boolean NOT NULL DEFAULT true`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `UNIQUE (clinician_uuid, day_of_week, start_time)`
RLS: clinician manages own rows. Assigned patients can read (for slot generation).

### Altered table: `appointments`
Adds:
- `video_link text` — nullable, stored when clinician adds a link on accept
- `patient_notes text` — nullable, patient's reason/context at booking time
- `clinician_notes text` — nullable, replaces current unified `notes` field for clinician-only context (existing `notes` column retained as-is for backwards compatibility, not dropped)
- `requested_at timestamptz NOT NULL DEFAULT now()`
- `accepted_at timestamptz` — nullable, set when clinician accepts
- Status CHECK constraint updated: `'pending' | 'confirmed' | 'completed' | 'no_show' | 'cancelled'` (adds `pending`)
- Default status changed from `'confirmed'` to `'pending'`

### Altered: `profiles.role`
CHECK constraint updated to include `'clinician'` alongside existing values.

### Table write ownership
`appointments` has two declared writers in this feature — this is a deliberate design choice, documented here per data-management.md Rule 4:
| Writer | Operation | Condition |
|---|---|---|
| Patient (via `requestBooking` server action) | INSERT | Patient books a new session — status starts as `pending` |
| Clinician (via `acceptBookingRequest` / `declineBookingRequest` server actions) | UPDATE status, accepted_at | Clinician responds to a pending request |

No other code path may write to `appointments`. Both server actions verify `auth.uid()` matches the correct party before writing.

---

## Waves

---

### Wave 1 — Database Foundation
**What James can see after this wave merges:** Nothing visible to end users. The schema changes land safely and the TypeScript types are updated. The app continues to build and run without errors. This is the non-breaking foundation all subsequent waves build on.

#### Task 1.1 — Migration: clinician_profiles + clinician_availability + appointments alterations
Files affected:
- `supabase/migrations/0053_clinician_booking_foundation.sql` (new)
- `supabase/schema/public/tables/clinician_profiles.sql` (new canonical)
- `supabase/schema/public/tables/clinician_availability.sql` (new canonical)
- `supabase/schema/public/tables/appointments.sql` (update canonical)
- `supabase/schema/public/tables/profiles.sql` (update canonical)

What to build:
Write a single idempotent migration that:
1. Updates `profiles.role` CHECK constraint to include `'clinician'` — use `ALTER TABLE ... DROP CONSTRAINT IF EXISTS` then `ADD CONSTRAINT`.
2. Creates `clinician_profiles` table with all columns listed in the data model section above. Enable RLS. Add policies:
   - `clinician_profiles_own_rw`: `USING (auth.uid() = user_uuid)` for all operations by the clinician.
   - `clinician_profiles_patient_read`: `USING (EXISTS (SELECT 1 FROM patient_assignments pa WHERE pa.patient_uuid = auth.uid() AND pa.clinician_uuid = user_uuid AND pa.status = 'active'))` for SELECT by assigned patient.
   - `clinician_profiles_admin_read`: `USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))` for SELECT by admin.
3. Creates `clinician_availability` table. Enable RLS. Add policies:
   - `clinician_availability_own_rw`: `USING (auth.uid() = clinician_uuid)`.
   - `clinician_availability_patient_read`: same assigned-patient pattern as clinician_profiles.
4. Alters `appointments`: adds `video_link`, `patient_notes`, `clinician_notes`, `requested_at`, `accepted_at` with `IF NOT EXISTS` for each column. Updates status CHECK constraint.
5. Add canonical schema files for clinician_profiles and clinician_availability (full CREATE TABLE with all indexes and RLS policies). Update canonical files for appointments and profiles.

Acceptance criteria:
- [ ] Migration file is numbered `0053` (next sequential after 0052)
- [ ] Migration is fully idempotent — can be run twice without error
- [ ] All four objects (clinician_profiles, clinician_availability, appointments alterations, profiles.role) are in a single migration file
- [ ] RLS is enabled on both new tables
- [ ] All three RLS policies per table are present (own, patient-read, admin-read)
- [ ] New canonical schema files exist at `supabase/schema/public/tables/`
- [ ] `pnpm build` passes after migration (TypeScript types not yet regenerated in this task — done in 1.2)

Rules to apply: `.claude/rules/database.md`, `.claude/rules/data-management.md`, `.claude/rules/security.md`

---

#### Task 1.2 — Regenerate TypeScript types
Files affected:
- `lib/supabase/database.types.ts`

What to build:
Run `supabase gen types typescript --local > lib/supabase/database.types.ts` to regenerate types after the migration in Task 1.1 has been applied locally. Verify the output includes `clinician_profiles`, `clinician_availability`, and the new columns on `appointments`.

Acceptance criteria:
- [ ] `lib/supabase/database.types.ts` contains `clinician_profiles` table type
- [ ] `lib/supabase/database.types.ts` contains `clinician_availability` table type
- [ ] `appointments.Row` includes `video_link`, `patient_notes`, `clinician_notes`, `requested_at`, `accepted_at`
- [ ] `pnpm build` passes cleanly with no TypeScript errors

Rules to apply: `.claude/rules/database.md`

---

### Wave 2 — Clinician Schedule Page
**What James can see after this wave merges:** Log in as a clinician-role user and go to `http://localhost:3000/clinician/schedule`. You see a weekly grid (Sun–Sat columns) where you can add and remove your available time slots. Below the grid is a list of any pending booking requests from patients — each shows the patient's name, the slot they want, and their reason. You can accept (turns green, status → confirmed) or decline (removes the card). Visually matches the patient dashboard — same colours, same card style, same typography.

#### Task 2.1 — Clinician route group scaffold
**Note:** The proxy guard for `/clinician/*` is already fully implemented in `lib/supabase/proxy.ts` (lines 10–91). Do NOT modify `proxy.ts` or `lib/supabase/proxy.ts`. The role-gate, unauthenticated redirect, and admin bypass are all live.

Files affected:
- `app/(clinician)/layout.tsx` (new)
- `app/(clinician)/clinician.css` (new — shared layout styles)
- `app/(clinician)/schedule/page.tsx` (new — functional page with real data, no placeholders)
- `app/(clinician)/schedule/schedule.css` (new)

What to build:
1. Create `app/(clinician)/layout.tsx` — async Server Component. Reads the clinician's name from `profiles` via the server Supabase client (user_id = auth.uid()). Renders a top nav with: the platform logo/wordmark matching the patient dashboard header style, the clinician's full name, nav links to Schedule (`/clinician/schedule`) and Patients (`/clinician/patients` — renders a "Coming soon" page, do not leave as a broken route), and a sign-out button. Style in `app/(clinician)/clinician.css` scoped to `.lc-clinician-shell`. Use the same `--lc-*` tokens — this shell must feel like the same product as the patient dashboard.
2. Create `app/(clinician)/schedule/page.tsx` as a full async Server Component. This page is wired with real data in Tasks 2.2 and 2.3 — the shell only needs to render the layout wrapper and section headings so the route is non-broken before those tasks run.
3. Create `app/(clinician)/schedule/schedule.css` scoped to `.lc-sched`. Define all `--lc-*` tokens (copy from dashboard.css values: `--lc-primary: #2F6F8F`, `--lc-sage: #6B8E83`, `--lc-canvas: #FAFAF7`, `--lc-surface: #FFFFFF`, `--lc-line: #E3E8EC`, `--lc-text: #1A2E3B`, `--lc-muted: #6B7280`).
4. Create `app/(clinician)/patients/page.tsx` — a minimal "Coming soon" page so the nav link doesn't 404.

Acceptance criteria:
- [ ] Visiting `http://localhost:3000/clinician/schedule` as an unauthenticated user redirects to `/login` (proxy already handles this — verify it works, do not re-implement)
- [ ] Visiting `http://localhost:3000/clinician/schedule` as a patient-role user redirects to `/dashboard` (proxy already handles this — verify, do not re-implement)
- [ ] Layout renders with clinician's real name from DB, correct nav links, sign-out button
- [ ] `http://localhost:3000/clinician/patients` renders without error (coming soon page)
- [ ] CSS uses `--lc-*` tokens — visually matches the patient dashboard card/surface style
- [ ] `pnpm build` passes

Rules to apply: `.claude/rules/nextjs-conventions.md`, `.claude/rules/security.md`

---

#### Task 2.2 — Availability editor (server action + UI)
Files affected:
- `app/(clinician)/schedule/page.tsx` (extend)
- `app/(clinician)/schedule/actions.ts` (new)
- `app/(clinician)/schedule/AvailabilityGrid.tsx` (new client component)
- `app/(clinician)/schedule/schedule.css` (extend)

What to build:
**Server actions in `actions.ts`:**
- `upsertAvailabilitySlot(day: number, startTime: string, endTime: string)` — upserts a row in `clinician_availability`. Returns `{ success: true } | { error: string }`.
- `deleteAvailabilitySlot(id: string)` — deletes a row from `clinician_availability` (must verify `clinician_uuid = auth.uid()`). Returns `{ success: true } | { error: string }`.

**`AvailabilityGrid.tsx`** — a `"use client"` component:
- Receives `initialSlots: ClinicianAvailability[]` as a prop (loaded server-side in page.tsx via `Promise.all`).
- Renders a 7-column grid (Sun–Sat). Each column shows the clinician's existing slots as time-range pills (e.g. "9:00–10:00 AM").
- An "Add slot" button per column opens an inline form (no modal) with time pickers (start/end time as `<select>` elements with 30-min increments from 06:00–20:00). On save, calls `upsertAvailabilitySlot`. On cancel, collapses. No page reload — update state optimistically.
- Each existing slot has a delete button (×). On click, calls `deleteAvailabilitySlot`. Optimistic UI.
- Loading and error states displayed inline.

**`page.tsx` additions:**
- Load `clinician_availability` rows for the current clinician using the server-side Supabase client. Pass to `AvailabilityGrid`.
- Section heading: "Your weekly availability" with a short subheading: "Patients can only book during these open slots."

Acceptance criteria:
- [ ] `upsertAvailabilitySlot` validates input with Zod before any DB write: `day` is int 0–6, `startTime` and `endTime` match `HH:MM` format, `endTime > startTime`
- [ ] `deleteAvailabilitySlot` validates `id` is a non-empty UUID string with Zod
- [ ] Clinician can add a slot for any day; it persists and appears in the grid on next visit
- [ ] Clinician can delete a slot; it disappears immediately (optimistic)
- [ ] Duplicate slot (same clinician + day + start_time) is rejected gracefully with inline error
- [ ] Server actions verify `auth.uid()` before writing — no cross-clinician writes possible
- [ ] `pnpm build` passes

Rules to apply: `.claude/rules/nextjs-conventions.md`, `.claude/rules/security.md`, `.claude/rules/data-management.md`

---

#### Task 2.3 — Pending booking requests list (server action + UI)
Files affected:
- `app/(clinician)/schedule/page.tsx` (extend)
- `app/(clinician)/schedule/actions.ts` (extend)
- `app/(clinician)/schedule/BookingRequests.tsx` (new client component)
- `app/(clinician)/schedule/schedule.css` (extend)

What to build:
**Server actions added to `actions.ts`:**
- `acceptBookingRequest(appointmentId: string)` — sets `status = 'confirmed'` and `accepted_at = now()` where `id = appointmentId AND clinician_uuid = auth.uid() AND status = 'pending'`. Returns `{ success: true } | { error: string }`.
- `declineBookingRequest(appointmentId: string, reason?: string)` — sets `status = 'cancelled'` where `id = appointmentId AND clinician_uuid = auth.uid() AND status = 'pending'`. Returns `{ success: true } | { error: string }`.

**`BookingRequests.tsx`** — a `"use client"` component:
- Receives `pendingRequests: AppointmentWithPatient[]` as a prop (loaded server-side, joined with `profiles` for patient name).
- Renders a card list. Each card shows: patient name, requested date/time (formatted from `scheduled_at`), duration, and `patient_notes` (the patient's reason). Two action buttons: "Accept" (green) and "Decline" (muted/outline).
- On Accept: calls `acceptBookingRequest`, updates card to show "Confirmed" badge, disables buttons.
- On Decline: shows an optional reason textarea inline, then calls `declineBookingRequest`, removes card from list.
- Empty state: "No pending requests — share your booking link with patients."

**`page.tsx` additions:**
- Below the availability grid, add a "Pending session requests" section.
- Query: `SELECT appointments.*, profiles.full_name as patient_name FROM appointments JOIN profiles ON profiles.id = appointments.patient_uuid WHERE appointments.clinician_uuid = auth.uid() AND appointments.status = 'pending' ORDER BY scheduled_at ASC`.
- Pass result to `BookingRequests`.

Acceptance criteria:
- [ ] `acceptBookingRequest` and `declineBookingRequest` validate input with Zod: `appointmentId` is a non-empty UUID string; optional `reason` is a string max 500 chars
- [ ] Pending requests appear as cards with patient name, date/time, and patient_notes
- [ ] Clinician can accept — card shows "Confirmed", DB row status = 'confirmed', accepted_at is set
- [ ] Clinician can decline — card disappears, DB row status = 'cancelled'
- [ ] Server actions validate `clinician_uuid = auth.uid()` — clinician cannot accept/decline another clinician's requests
- [ ] Empty state renders when no pending requests
- [ ] `pnpm build` passes

Rules to apply: `.claude/rules/nextjs-conventions.md`, `.claude/rules/security.md`

---

### Wave 3 — Patient Booking Flow
**What James can see after this wave merges:** Log in as a patient. The "Care Team" tile on the dashboard (`http://localhost:3000/dashboard`) now has a real link — click it and land on `http://localhost:3000/care-team`. You see your assigned clinician's profile card (name, specialties, bio), then a week-view calendar showing their open slots as clickable buttons. Click a slot, optionally type a reason, and hit "Request session" — a confirmation message appears and the slot goes grey. Log back in as the clinician and the request now appears in their pending list at `http://localhost:3000/clinician/schedule`.

#### Task 3.1 — Care team route scaffold + clinician profile display
Files affected:
- `app/(app)/care-team/page.tsx` (new)
- `app/(app)/care-team/care-team.css` (new)
- `app/(app)/dashboard/page.tsx` (modify — update Care Team tile)

What to build:
1. Create `app/(app)/care-team/page.tsx` — async Server Component.
   - Load the authenticated user's `patient_assignments` row (status = 'active') to find their `clinician_uuid`.
   - If no assignment: render a "No care team assigned yet" empty state with a message to contact support.
   - If assigned: load `clinician_profiles` for that clinician (name from `profiles`, specialties/bio/session_duration_minutes/timezone from `clinician_profiles`).
   - Render clinician card: avatar placeholder (initials), name, specialties as tags, bio, session duration.
2. Create `care-team.css` scoped to `.lc-care`. Use the same `--lc-primary`, `--lc-sage`, `--lc-canvas`, `--lc-surface`, `--lc-line` tokens. Card radius 14px, same shadow as dashboard cards.
3. In `app/(app)/dashboard/page.tsx`, find the Care Team coming-soon tile (line ~427) and update it to link to `/care-team` instead of rendering as a dead placeholder. Keep the same tile style — just swap the href.

Acceptance criteria:
- [ ] `/care-team` is accessible to authenticated members
- [ ] Empty state renders when no `patient_assignments` row exists
- [ ] Clinician profile card renders with name, specialties, bio, and session duration
- [ ] Dashboard Care Team tile links to `/care-team`
- [ ] `pnpm build` passes

Rules to apply: `.claude/rules/nextjs-conventions.md`, `.claude/rules/data-management.md`

---

#### Task 3.2 — Available slot calendar + booking request submission
Files affected:
- `app/(app)/care-team/page.tsx` (extend)
- `app/(app)/care-team/actions.ts` (new)
- `app/(app)/care-team/SlotCalendar.tsx` (new client component)
- `app/(app)/care-team/care-team.css` (extend)

What to build:
**Slot generation logic (server-side utility, inline in page.tsx):**
- Given the clinician's `clinician_availability` rows (recurring weekly slots) and existing `appointments` for the next 28 days (status `pending` or `confirmed`), generate a list of concrete available date-time slots for the next 28 days.
- A slot is available if: it matches a `clinician_availability` row (day_of_week + start_time) AND no existing appointment overlaps it AND the slot is in the future (>= now + 2 hours).
- Return at most 20 upcoming slots.

**Server action in `actions.ts`:**
- `requestBooking(clinicianUuid: string, scheduledAt: string, patientNotes: string)` — inserts into `appointments` with:
  - `patient_uuid = auth.uid()`
  - `clinician_uuid = clinicianUuid`
  - `scheduled_at = scheduledAt`
  - `duration_minutes` from `clinician_profiles.session_duration_minutes`
  - `status = 'pending'`
  - `patient_notes = patientNotes`
  - `appointment_type = 'clinical_review'`
- Validates: clinicianUuid must match patient's assigned clinician (`patient_assignments` check — no booking with unassigned clinicians).
- Returns `{ success: true, appointmentId: string } | { error: string }`.

**`SlotCalendar.tsx`** — a `"use client"` component:
- Receives `availableSlots: { dateTime: string; label: string }[]` as a prop.
- Renders a simple week-view calendar (CSS grid, 7 columns for days, rows for time blocks). Days without slots show as empty. Days with slots show them as clickable pill buttons.
- Week navigation: "Previous week" / "Next week" buttons filter the prop list client-side.
- On slot click: expands a booking panel below the calendar with the selected slot displayed, a textarea for "Reason for booking (optional)", and a "Request session" button.
- On submit: calls `requestBooking`. On success: replace the panel with a "Request sent — your clinician will confirm shortly" confirmation card. Disable the slot pill.
- Error state: display inline below the button.

**`page.tsx` additions:**
- After the clinician profile card, add a "Book a session" section heading.
- Compute available slots server-side and pass to `SlotCalendar`.
- Also load existing upcoming appointments for this patient (status = 'pending' or 'confirmed') and render them as an "Upcoming sessions" list below the calendar.

Acceptance criteria:
- [ ] `requestBooking` validates input with Zod before any DB write: `clinicianUuid` is a non-empty UUID, `scheduledAt` is a valid ISO 8601 datetime string in the future, `patientNotes` is a string max 500 chars
- [ ] Calendar shows correct available slots based on clinician's recurring availability minus already-booked slots
- [ ] Patient can select a slot, optionally add a reason, and submit a booking request
- [ ] On successful submit: confirmation shown, slot disabled, appointment row created in DB with status = 'pending'
- [ ] `requestBooking` validates the clinician is the patient's assigned clinician — cannot book with an arbitrary clinician UUID
- [ ] Upcoming confirmed sessions are listed below the calendar
- [ ] Past the 28-day window: "No upcoming availability — check back soon" empty state
- [ ] `pnpm build` passes

Rules to apply: `.claude/rules/nextjs-conventions.md`, `.claude/rules/security.md`, `.claude/rules/data-management.md`

---

## UI consistency contract

Both the clinician schedule page and the patient care-team page must use the following shared token values. These are NOT Tailwind utilities — they are CSS custom properties defined in each page's scoped CSS file, matching the dashboard:

```css
--lc-primary:   #2F6F8F;
--lc-sage:      #6B8E83;
--lc-canvas:    #FAFAF7;
--lc-surface:   #FFFFFF;
--lc-line:      #E3E8EC;
--lc-text:      #1A2E3B;
--lc-muted:     #6B7280;
```

Card border-radius: 14px. Hero sections: 20px. Box shadow: `0 1px 2px rgba(0,0,0,0.04)`. Typography: `var(--font-lc-sans)` for body, `var(--font-lc-serif)` for headings. Button primary: `background: var(--lc-primary)`. No Tailwind utility classes on pages that have a co-located CSS file.

---

## Build order constraint

Tasks must be executed in this strict order:
1. Task 1.1 (migration) → must be applied before 1.2
2. Task 1.2 (types) → must complete before any Wave 2 or 3 task
3. Task 2.1 (scaffold) → must complete before 2.2 or 2.3
4. Tasks 2.2 and 2.3 → can run in parallel if desired (no shared files)
5. Task 3.1 → can start once 1.2 is done (no dependency on Wave 2)
6. Task 3.2 → must start after 3.1 (extends page.tsx from 3.1)

---

## Open questions for product owner (James) before Wave 3 ships

1. **Booking confirmation model:** Should a patient booking request be auto-confirmed if the slot is open, or should it always require explicit clinician acceptance? Current plan: always requires clinician acceptance (status starts as `pending`).
2. **Session types:** Should patients be able to choose a session type (Initial consult / Follow-up / Urgent review) or is all booking type = `clinical_review` for now?
3. **Cancellation policy:** Can a patient cancel a confirmed session? If so, how much notice is required? Not implemented in this plan — deferred.

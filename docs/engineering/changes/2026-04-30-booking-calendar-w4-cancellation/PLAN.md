# Plan: Booking Calendar Wave 4 — Patient-Side Cancellation
Date: 2026-04-30
Epic: 9 — The Care Team
Status: Draft, awaiting James sign-off
Branch: feat/booking-calendar-w4-cancellation (off `main`)
Predecessor: docs/engineering/changes/2026-04-30-clinician-booking-calendar/PLAN.md (W1–W3, merged in PR #57)

## Objective

Let a patient cancel a confirmed or pending session from `/care-team`, subject to a 24-hour notice rule. Inside the 24-hour window the UI shows a static "contact your clinician directly" message — no actionable link until secure messaging ships. Cancelling returns the slot to the clinician's availability pool automatically (slot generator already filters by `status IN ('pending','confirmed')`).

## Product decisions (signed off by James 2026-04-30)

1. Cancellation is allowed from the patient UI.
2. 24-hour cutoff: outside 24h → one-click cancel. Inside 24h → must contact clinician.
3. No fees, no penalties for the pilot.
4. UI: simple show/hide of the Cancel button based on the 24h cutoff — no live countdown.
5. Cancellation reason is **optional** on the patient form.
6. Audit: write each cancellation to a separate **`appointments_cancellation_log`** table (append-only). `appointments` itself only carries the status change — no denormalised actor or reason columns.
7. **Implementation: a Postgres `AFTER UPDATE` trigger on `appointments` writes the log row when status transitions to a `cancelled_*` value.** Single source of truth, single atomic write, covers patient and clinician flows uniformly. Trade-off accepted: the audit log does **not** capture a free-text cancellation reason (the trigger has no access to one). The patient `reason` form field is removed; clinicians can see status + actor + timing only.

## Codebase state at planning time

- W1–W3 merged on `main` via PR #57. `appointments` has `status in ('pending','confirmed','completed','no_show','cancelled')`, plus `requested_at`, `accepted_at`.
- `app/(app)/care-team/page.tsx` already renders an "Upcoming sessions" list — the cancel control attaches there.
- Latest migration on `main` is `0066_journal_enhancements.sql`. **Slot `0065` is missing** because of an untracked `0065_deceased_flag.sql` in the working tree (separate WIP). Use `0067` to avoid that collision.
- Existing decline flow (clinician side) sets `status = 'cancelled'`. We extend the enum with two typed values rather than overwrite that flow.

## Build order

1. Task 1.1 (migration `0067`)
2. Task 1.2 (canonical schema + regenerated types)
3. Task 2.1 (server action) — depends on 1.1
4. Task 2.2 (UI) — depends on 2.1
5. Task 3.1 (tests) — depends on 2.1
6. `pnpm build` + `pnpm test` clean before commit.

---

## Wave 4 — Patient cancellation
Status: Draft

**What James can see after this wave:** Patient logs in → `/care-team` → "Upcoming sessions" list shows a Cancel button on rows that are >24h away. Outside 24h → cancel works, slot returns to the available pool, row disappears from the list. Inside 24h → static "contact your clinician directly to cancel" hint replaces the button. Clinician sees status flip on `/clinician/schedule`.

### Task 1.1 — Migration `0067_appointment_cancellation.sql`

File: `supabase/migrations/0067_appointment_cancellation.sql` (new, idempotent)

What to build (one migration, two changes):

**A. Extend `appointments.status` enum.** Drop and re-add the status check constraint to allow:
`('pending','confirmed','completed','no_show','cancelled','cancelled_by_patient','cancelled_by_clinician')`.
`'cancelled'` remains as a legacy value — existing rows are untouched and the existing clinician-decline flow keeps working until a later wave migrates it to `cancelled_by_clinician`.

**B. New table `public.appointments_cancellation_log`.** Append-only audit row per cancellation. No free-text `reason` column — see decision §7.

```
id              uuid primary key default gen_random_uuid()
appointment_id  uuid not null references public.appointments(id) on delete cascade
cancelled_by    uuid references auth.users(id) on delete set null  -- nullable: a deleted user clears this; cancelled_role still records categorical actor
cancelled_role  text not null check (cancelled_role in ('patient','clinician','admin','system'))
hours_before_start numeric(6,2)   -- snapshotted at cancel time, useful for analytics on the 24h policy
cancelled_at    timestamptz not null default now()
```

Indexes:
- `appointments_cancellation_log_appointment_idx on (appointment_id)` for join lookups.
- `appointments_cancellation_log_cancelled_at_idx on (cancelled_at desc)` for chronological scans.

RLS:
- Enable RLS.
- `cancellation_log_patient_select`: patient can SELECT rows for appointments where they are `patient_uuid` (subquery on `appointments`).
- `cancellation_log_clinician_select`: clinician can SELECT rows for appointments where they are `clinician_uuid`.
- `cancellation_log_admin_all`: admin role full access.
- **No INSERT, UPDATE, or DELETE policies for any role.** All writes flow through the trigger (which runs with the table-owner's privileges and bypasses RLS). Append-only by construction.

RLS on `appointments` (status transition):
- Add `appointments_patient_update_cancel`:
  `for update using (auth.uid() = patient_uuid and status in ('pending','confirmed')) with check (auth.uid() = patient_uuid and status = 'cancelled_by_patient');`
  Limits patient writes strictly to the cancellation transition. All other status writes remain service-role / clinician only.

**C. Trigger function + AFTER UPDATE trigger on `appointments`.**

```sql
create or replace function public.appointments_log_cancellation()
returns trigger
language plpgsql
security definer  -- runs as table owner; bypasses RLS on the log table
set search_path = public
as $$
declare
  v_role text;
  v_hours numeric(6,2);
begin
  -- Only fire on a transition INTO a cancelled_* state.
  if NEW.status = OLD.status then
    return NEW;
  end if;
  if NEW.status not in ('cancelled_by_patient', 'cancelled_by_clinician') then
    return NEW;
  end if;

  v_role := case NEW.status
    when 'cancelled_by_patient'    then 'patient'
    when 'cancelled_by_clinician'  then 'clinician'
  end;

  v_hours := extract(epoch from (NEW.scheduled_at - now())) / 3600.0;

  insert into public.appointments_cancellation_log
    (appointment_id, cancelled_by, cancelled_role, hours_before_start)
  values
    (NEW.id, auth.uid(), v_role, v_hours);

  return NEW;
end;
$$;

drop trigger if exists appointments_log_cancellation_trg on public.appointments;
create trigger appointments_log_cancellation_trg
  after update of status on public.appointments
  for each row
  execute function public.appointments_log_cancellation();
```

Notes:
- `security definer` is required so the trigger can write to the log even though the patient/clinician has no INSERT policy on it.
- `auth.uid()` resolves to the calling user's UUID even inside a `security definer` function (Supabase's `auth` schema is plain SQL helpers, not session-scoped).
- The trigger ignores no-op status updates and any non-cancellation transition — safe to attach without affecting other status flows (`completed`, `no_show`, etc.).
- Future scope (out of this wave): extending the trigger to cover the legacy `'cancelled'` value if/when the clinician-decline flow migrates.

### Task 1.2 — Canonical schema + types

Files:
- `supabase/schema/public/tables/appointments.sql` (update — new status values in the comment block + new patient-update policy)
- `supabase/schema/public/tables/appointments_cancellation_log.sql` (new canonical)
- `lib/supabase/database.types.ts` (regenerate via `supabase gen types typescript --local`, or manually append the new table + widen the appointments status enum)

### Task 2.1 — `cancelBooking` server action

File: `app/(app)/care-team/actions.ts` (extend)

```
cancelBooking(appointmentId: uuid)
  → { success: true } | { error: string; reason?: 'inside_24h' | 'not_found' | 'wrong_owner' | 'wrong_status' }
```

Logic:
1. Zod-validate `appointmentId` (UUID). No reason field — see decision §7.
2. Auth: `auth.getUser()`; reject if unauthenticated.
3. Fetch appointment by id (patient client; RLS already filters to the patient's own rows). Reject `not_found` if missing.
4. Verify `patient_uuid === user.id` → reject `wrong_owner` (defence-in-depth; RLS already covers this).
5. Verify `status in ('pending','confirmed')` → reject `wrong_status`.
6. Compute `hoursUntilStart = (scheduled_at - now()) / 3600`. If `< 24` → return `{ error: 'Inside 24-hour window — contact your clinician', reason: 'inside_24h' }`. **Do not write.**
7. Single write via patient client: `update appointments set status = 'cancelled_by_patient' where id = ?`. The DB trigger writes the audit log row in the same transaction.
8. Return success.

Notes:
- The 24h check is enforced in the server action only; the UI hint is advisory. The trigger is **not** a hard enforcer of the 24h rule — that lives in the action so the patient gets a friendly response rather than a SQL exception. RLS still prevents flipping a non-`pending`/`confirmed` row.
- No service-role client is used in this action.

### Task 2.2 — UI on `/care-team`

Files:
- `app/(app)/care-team/page.tsx` (extend the upcoming-sessions list)
- `app/(app)/care-team/UpcomingSessionRow.tsx` (new "use client" — small enough that inlining into `page.tsx` is also fine; split if the row gains a confirm modal)
- `app/(app)/care-team/care-team.css` (extend — `.lc-care__cancel-btn`, `.lc-care__cancel-deflect`)

UI rules:
- For each upcoming `pending`/`confirmed` row, compute `hoursUntilStart` server-side and pass a flag to the row component.
- `hoursUntilStart >= 24` → show `Cancel` button → click opens a confirm-modal ("Cancel this session? This cannot be undone." / "Keep session" / "Cancel session" buttons — no reason textarea). On confirm, call `cancelBooking`. Optimistic remove from the list; on error, restore + show toast.
- `hoursUntilStart < 24` → in place of the Cancel button, render a static, non-actionable hint: *"Inside 24-hour window — please contact {clinicianName} directly to cancel."* No `mailto:` link. Rationale: patients shouldn't have direct email access to clinicians by design; secure messaging (next epic) is the proper channel. When secure messaging lands, swap this hint for a deep link to the thread.
- Already-cancelled rows are filtered server-side; not rendered.

Empty-state copy unchanged.

### Task 3.1 — Tests

Files (new):
- `tests/unit/care-team/cancel-booking.test.ts` — Zod validation (valid UUID, malformed UUID), hour-math boundary (23:59h, exactly 24h, 24:01h).
- `tests/integration/care-team/cancel-booking.test.ts` — (a) happy path: >24h cancels, `appointments.status = 'cancelled_by_patient'`, exactly one matching row in `appointments_cancellation_log` with correct `cancelled_role` and `cancelled_by`; (b) inside-24h path returns `inside_24h` error and writes nothing (status unchanged, no log row); (c) wrong-owner blocked by RLS; (d) wrong-status (e.g. already-cancelled) blocked by action.

Acceptance: `pnpm test` clean (existing 573 + 7 new).

---

## Out of scope (flagged for later)

- Clinician-initiated cancellation typed-status migration (`'cancelled'` → `'cancelled_by_clinician'` for existing decline flow). Worth a follow-up wave once secure messaging lands and we are also adding clinician notification copy.
- Notification to clinician on patient cancellation (email/secure-message). Deferred until secure messaging is live; for the pilot, the clinician sees the status change next time they open `/clinician/schedule`.
- "No-show" auto-flip cron after `scheduled_at + duration_minutes` lapses with status still `confirmed`. Separate wave.
- Patient-side reschedule. Out of scope — cancel + rebook is sufficient for the pilot.
- Refund or credit logic (no payment flow on appointments yet).

## Open questions

All resolved as of 2026-04-30 — see Product decisions §4–§6.

## Dev-loop & merge expectations

Per project rules (`CLAUDE.md` — "Mandatory: use dev-loop for any logic-affecting change"):
- This wave is one slice: build → `pnpm build` → `pnpm test` → push → PR → merge → next wave.
- Estimated PR size: 1 migration + 1 schema file + ~80 LoC server action + ~120 LoC UI + ~150 LoC tests. Single review.

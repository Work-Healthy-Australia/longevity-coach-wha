-- Migration 0067: Appointment cancellation — Booking Calendar Wave 4
--
-- Adds patient-initiated cancellation with a 24-hour cutoff (enforced in app code).
--   1. Extend appointments.status CHECK to include 'cancelled_by_patient' and
--      'cancelled_by_clinician'. Legacy 'cancelled' value is preserved so the
--      existing clinician decline flow keeps working unchanged.
--   2. New table: public.appointments_cancellation_log — append-only audit row
--      per cancellation.
--   3. Trigger: AFTER UPDATE OF status on appointments — when status transitions
--      to 'cancelled_by_patient' or 'cancelled_by_clinician', insert a log row.
--   4. RLS: patients may UPDATE their own pending/confirmed appointments only
--      to flip status to 'cancelled_by_patient' (no other writes).
--
-- See plan: docs/engineering/changes/2026-04-30-booking-calendar-w4-cancellation/PLAN.md
--
-- Idempotent — uses IF (NOT) EXISTS guards and DROP … IF EXISTS throughout.

-- ============================================================================
-- 1. Extend appointments.status CHECK constraint
-- ============================================================================

do $$
declare cname text;
begin
  for cname in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns  on ns.oid  = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'appointments'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.appointments drop constraint %I', cname);
  end loop;

  alter table public.appointments
    add constraint appointments_status_check
    check (status in (
      'pending',
      'confirmed',
      'completed',
      'no_show',
      'cancelled',
      'cancelled_by_patient',
      'cancelled_by_clinician'
    ));
end$$;

-- ============================================================================
-- 2. public.appointments_cancellation_log
-- ============================================================================

create table if not exists public.appointments_cancellation_log (
  id                 uuid        primary key default gen_random_uuid(),
  appointment_id     uuid        not null references public.appointments(id) on delete cascade,
  cancelled_by       uuid        references auth.users(id) on delete set null,
  cancelled_role     text        not null check (cancelled_role in ('patient', 'clinician', 'admin', 'system')),
  hours_before_start numeric(6,2),
  cancelled_at       timestamptz not null default now()
);

create index if not exists appointments_cancellation_log_appointment_idx
  on public.appointments_cancellation_log(appointment_id);

create index if not exists appointments_cancellation_log_cancelled_at_idx
  on public.appointments_cancellation_log(cancelled_at desc);

alter table public.appointments_cancellation_log enable row level security;

-- Patient may read log rows for their own appointments.
drop policy if exists "cancellation_log_patient_select" on public.appointments_cancellation_log;
create policy "cancellation_log_patient_select" on public.appointments_cancellation_log
  for select
  using (
    exists (
      select 1
      from public.appointments a
      where a.id = appointments_cancellation_log.appointment_id
        and a.patient_uuid = auth.uid()
    )
  );

-- Clinician may read log rows for appointments where they are the clinician.
drop policy if exists "cancellation_log_clinician_select" on public.appointments_cancellation_log;
create policy "cancellation_log_clinician_select" on public.appointments_cancellation_log
  for select
  using (
    exists (
      select 1
      from public.appointments a
      where a.id = appointments_cancellation_log.appointment_id
        and a.clinician_uuid = auth.uid()
    )
  );

-- Admins have full read access.
drop policy if exists "cancellation_log_admin_all" on public.appointments_cancellation_log;
create policy "cancellation_log_admin_all" on public.appointments_cancellation_log
  for all
  using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

-- No INSERT/UPDATE/DELETE policies for any role. The trigger writes via
-- SECURITY DEFINER and bypasses RLS; the table is append-only by construction.

-- ============================================================================
-- 3. Trigger: appointments_log_cancellation
-- ============================================================================

create or replace function public.appointments_log_cancellation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role  text;
  v_hours numeric(6,2);
begin
  -- No-op on non-status updates and unchanged statuses.
  if NEW.status is not distinct from OLD.status then
    return NEW;
  end if;

  -- Only fire for the new typed cancellation values.
  if NEW.status not in ('cancelled_by_patient', 'cancelled_by_clinician') then
    return NEW;
  end if;

  v_role := case NEW.status
    when 'cancelled_by_patient'   then 'patient'
    when 'cancelled_by_clinician' then 'clinician'
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

-- ============================================================================
-- 4. RLS: patient UPDATE policy — strictly the cancel transition
-- ============================================================================

drop policy if exists "appointments_patient_update_cancel" on public.appointments;
create policy "appointments_patient_update_cancel" on public.appointments
  for update
  using (
    auth.uid() = patient_uuid
    and status in ('pending', 'confirmed')
  )
  with check (
    auth.uid() = patient_uuid
    and status = 'cancelled_by_patient'
  );

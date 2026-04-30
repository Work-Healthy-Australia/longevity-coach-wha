-- Canonical schema: public.appointments_cancellation_log
-- Originally created: migration 0067_appointment_cancellation
--
-- Append-only audit row written by the appointments_log_cancellation trigger
-- whenever appointments.status transitions to 'cancelled_by_patient' or
-- 'cancelled_by_clinician'. No INSERT/UPDATE/DELETE policies for any role —
-- the trigger runs SECURITY DEFINER and bypasses RLS.

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

-- Trigger function (declared in the same migration, defined here for canonical reference):
-- AFTER UPDATE OF status ON public.appointments → inserts a row when the new status
-- is 'cancelled_by_patient' or 'cancelled_by_clinician'. cancelled_by = auth.uid().

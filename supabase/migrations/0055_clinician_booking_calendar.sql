-- Migration 0055: Clinician–Patient Booking Calendar — Wave 1
--
-- Implements the schema foundation for patient self-booking:
--   1. New table: public.clinician_availability  — per-clinician weekly slots
--   2. Alter:     public.appointments            — booking workflow columns
--                                                  + 'pending' status value
--                                                  + patient INSERT policy
--
-- Idempotent — uses IF (NOT) EXISTS guards and DROP … IF EXISTS throughout.

-- ============================================================================
-- 1. public.clinician_availability
-- ============================================================================

create table if not exists public.clinician_availability (
  id             uuid        primary key default gen_random_uuid(),
  clinician_uuid uuid        not null references auth.users(id) on delete cascade,
  day_of_week    int         not null check (day_of_week between 0 and 6),
  start_time     time        not null,
  end_time       time        not null,
  is_active      boolean     not null default true,
  created_at     timestamptz not null default now(),
  unique (clinician_uuid, day_of_week, start_time)
);

create index if not exists clinician_availability_clinician_idx
  on public.clinician_availability(clinician_uuid);

alter table public.clinician_availability enable row level security;

-- Clinician owns their own availability rows (read + write).
drop policy if exists "clinician_availability_own_rw" on public.clinician_availability;
create policy "clinician_availability_own_rw" on public.clinician_availability
  for all
  using     (auth.uid() = clinician_uuid)
  with check (auth.uid() = clinician_uuid);

-- Patients assigned to a clinician can read that clinician's availability.
drop policy if exists "clinician_availability_patient_read" on public.clinician_availability;
create policy "clinician_availability_patient_read" on public.clinician_availability
  for select
  using (
    exists (
      select 1
      from public.patient_assignments pa
      where pa.patient_uuid = auth.uid()
        and pa.clinician_uuid = clinician_availability.clinician_uuid
        and pa.status = 'active'
    )
  );

-- ============================================================================
-- 2. public.appointments — additive columns (all IF NOT EXISTS)
-- ============================================================================

-- video_link / patient_notes / clinician_notes were added in migration 0050;
-- these ADD COLUMN IF NOT EXISTS guards make this migration re-runnable.
alter table public.appointments
  add column if not exists video_link      text,
  add column if not exists patient_notes   text,
  add column if not exists clinician_notes text,
  add column if not exists requested_at    timestamptz default now(),
  add column if not exists accepted_at     timestamptz;

-- ============================================================================
-- 2b. Extend status CHECK constraint to include 'pending'
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
    check (status in ('pending', 'confirmed', 'completed', 'no_show', 'cancelled'));
end$$;

-- ============================================================================
-- 2c. Patient INSERT policy — patients may create 'pending' appointments
-- ============================================================================

drop policy if exists "appointments_patient_insert" on public.appointments;
create policy "appointments_patient_insert" on public.appointments
  for insert
  with check (auth.uid() = patient_uuid and status = 'pending');

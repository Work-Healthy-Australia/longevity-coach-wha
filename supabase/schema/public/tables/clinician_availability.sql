-- Canonical schema: public.clinician_availability
-- Last updated: migration 0055_clinician_booking_calendar

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

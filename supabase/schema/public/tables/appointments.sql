-- Canonical schema: public.appointments
-- Originally created: migration 0014_agent_tables
-- Updated:            migration 0050_appointments_clinician_portal (video_link, patient_notes, clinician_notes)
--                     migration 0055_clinician_booking_calendar    (requested_at, accepted_at, 'pending' status, patient_insert policy)

create table if not exists public.appointments (
  id               uuid        primary key default gen_random_uuid(),
  patient_uuid     uuid        not null references auth.users(id) on delete cascade,
  clinician_uuid   uuid        references auth.users(id) on delete set null,
  appointment_type text        not null check (appointment_type in ('clinician_review', 'coaching_session')),
  scheduled_at     timestamptz not null,
  duration_minutes smallint    not null default 30,
  status           text        not null default 'pending'
                     check (status in ('pending', 'confirmed', 'completed', 'no_show', 'cancelled')),
  notes            text,
  conversation_ref uuid        references public.agent_conversations(id) on delete set null,
  -- columns added by 0050
  video_link       text,
  patient_notes    text,
  clinician_notes  text,
  -- columns added by 0055
  requested_at     timestamptz default now(),
  accepted_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists appointments_patient_uuid_idx
  on public.appointments(patient_uuid);
create index if not exists appointments_clinician_uuid_idx
  on public.appointments(clinician_uuid);
create index if not exists appointments_scheduled_at_idx
  on public.appointments(scheduled_at);
-- indexes added by 0048 (no-op on pre-existing tables; present for completeness)
create index if not exists appointments_clinician_idx
  on public.appointments(clinician_uuid, scheduled_at);
create index if not exists appointments_patient_idx
  on public.appointments(patient_uuid, scheduled_at);
create index if not exists appointments_status_idx
  on public.appointments(status);

alter table public.appointments enable row level security;

-- Patient sees their own appointments (read-only, set by 0014 / reaffirmed by 0048).
drop policy if exists "appointments_patient_select" on public.appointments;
create policy "appointments_patient_select" on public.appointments
  for select using (auth.uid() = patient_uuid);

-- Patient may create 'pending' appointments (added by 0055).
drop policy if exists "appointments_patient_insert" on public.appointments;
create policy "appointments_patient_insert" on public.appointments
  for insert with check (auth.uid() = patient_uuid and status = 'pending');

-- Clinician sees and manages appointments where they are the clinician (set by 0048).
drop policy if exists "appointments_clinician_all" on public.appointments;
create policy "appointments_clinician_all" on public.appointments
  for all using (auth.uid() = clinician_uuid);

-- Service role may insert (set by 0014).
drop policy if exists "appointments_service_insert" on public.appointments;
create policy "appointments_service_insert" on public.appointments
  for insert with check (auth.role() = 'service_role');

-- Service role may update (set by 0014).
drop policy if exists "appointments_service_update" on public.appointments;
create policy "appointments_service_update" on public.appointments
  for update using (auth.role() = 'service_role');

-- Admins have full access (set by 0014 / reaffirmed by 0048).
drop policy if exists "appointments_admin_all" on public.appointments;
create policy "appointments_admin_all" on public.appointments
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

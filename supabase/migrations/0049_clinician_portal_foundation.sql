-- Migration 0048: Clinician portal foundation
--
-- Implements decisions C1–C6 from
-- docs/architecture/clinician-portal-decisions.md (RESOLVED 2026-04-29).
--
-- This is the schema-only foundation. UI lands in subsequent waves.
--
--   C1: clinician_invites table mirroring billing.org_invites shape.
--   C4: profiles.role check constraint extended to include 'clinician',
--       'coach', and 'health_manager'. (Existing: 'user', 'admin'.)
--   New tables: clinician_profiles + appointments (Base44 → wha gap-fill,
--   per docs/architecture/clinician-portal.md §6).
--
-- Idempotent — uses IF EXISTS / IF NOT EXISTS guards throughout.

-- ============================================================================
-- C4: extend profiles.role check constraint
-- ============================================================================

do $$
declare
  cname text;
begin
  -- Drop any existing role-check constraint regardless of system-generated name
  for cname in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'profiles'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%role%check%'
  loop
    execute format('alter table public.profiles drop constraint %I', cname);
  end loop;

  alter table public.profiles
    add constraint profiles_role_check
    check (role in ('user', 'admin', 'clinician', 'coach', 'health_manager'));
end$$;

-- ============================================================================
-- New table: public.clinician_profiles
-- ============================================================================
-- Self-service profile per clinician. One row per clinician user.
-- Patients see this when nominating a clinician for care-team access (C2).

create table if not exists public.clinician_profiles (
  user_uuid                uuid        primary key references auth.users(id) on delete cascade,
  title                    text,
  full_name                text        not null,
  qualifications           text,
  specialties              text[]      not null default '{}',
  interests                text[]      not null default '{}',
  bio                      text,
  contact_email            text,
  contact_phone            text,
  languages                text[]      not null default '{}',
  video_link               text,
  available_days           int[]       not null default '{}', -- ints 0–6, Sun=0
  available_from           time,
  available_to             time,
  lunch_break_from         time,
  lunch_break_to           time,
  session_duration_minutes int         not null default 30 check (session_duration_minutes > 0),
  timezone                 text        not null default 'Australia/Sydney',
  is_active                boolean     not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists clinician_profiles_active_idx
  on public.clinician_profiles(is_active);

alter table public.clinician_profiles enable row level security;

drop policy if exists "clinician_profiles_public_select" on public.clinician_profiles;
drop policy if exists "clinician_profiles_self_update"   on public.clinician_profiles;
drop policy if exists "clinician_profiles_admin_all"     on public.clinician_profiles;

-- Patients can read active clinician profiles to nominate care-team access.
create policy "clinician_profiles_public_select" on public.clinician_profiles
  for select using (is_active = true);

-- Each clinician edits their own row.
create policy "clinician_profiles_self_update" on public.clinician_profiles
  for update using (auth.uid() = user_uuid);

create policy "clinician_profiles_admin_all" on public.clinician_profiles
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop trigger if exists clinician_profiles_set_updated_at on public.clinician_profiles;
create trigger clinician_profiles_set_updated_at
  before update on public.clinician_profiles
  for each row execute function public.set_updated_at();

-- ============================================================================
-- New table: public.appointments
-- ============================================================================
-- Clinician-initiated appointments (C3 — patient self-booking deferred).

create table if not exists public.appointments (
  id                 uuid        primary key default gen_random_uuid(),
  patient_uuid       uuid        not null references auth.users(id) on delete cascade,
  clinician_uuid     uuid        not null references auth.users(id) on delete cascade,
  appointment_date   date        not null,
  start_time         time        not null,
  duration_minutes   int         not null default 30 check (duration_minutes > 0),
  status             text        not null default 'confirmed'
                       check (status in ('confirmed', 'completed', 'no_show', 'cancelled')),
  video_link         text,
  patient_notes      text,
  clinician_notes    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists appointments_clinician_idx
  on public.appointments(clinician_uuid, appointment_date);
create index if not exists appointments_patient_idx
  on public.appointments(patient_uuid, appointment_date);
create index if not exists appointments_status_idx
  on public.appointments(status);

alter table public.appointments enable row level security;

drop policy if exists "appointments_patient_select" on public.appointments;
drop policy if exists "appointments_clinician_all"  on public.appointments;
drop policy if exists "appointments_admin_all"      on public.appointments;

-- Patient sees their own appointments (read-only).
create policy "appointments_patient_select" on public.appointments
  for select using (auth.uid() = patient_uuid);

-- Clinician sees and manages appointments where they are the clinician.
create policy "appointments_clinician_all" on public.appointments
  for all using (auth.uid() = clinician_uuid);

create policy "appointments_admin_all" on public.appointments
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- ============================================================================
-- New table: public.clinician_invites
-- ============================================================================
-- Single-use token, 14-day expiry. Mirrors billing.org_invites (C1).

create table if not exists public.clinician_invites (
  id          uuid        primary key default gen_random_uuid(),
  email       text        not null,
  full_name   text,
  role        text        not null default 'clinician' check (role in ('clinician', 'coach')),
  token       text        not null unique,
  invited_by  uuid        references auth.users(id) on delete set null,
  status      text        not null default 'pending'
                check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at  timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (email, status)
);

create index if not exists clinician_invites_email_idx  on public.clinician_invites(email);
create index if not exists clinician_invites_token_idx  on public.clinician_invites(token);
create index if not exists clinician_invites_status_idx on public.clinician_invites(status);

alter table public.clinician_invites enable row level security;

drop policy if exists "clinician_invites_admin_all" on public.clinician_invites;

create policy "clinician_invites_admin_all" on public.clinician_invites
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop trigger if exists clinician_invites_set_updated_at on public.clinician_invites;
create trigger clinician_invites_set_updated_at
  before update on public.clinician_invites
  for each row execute function public.set_updated_at();

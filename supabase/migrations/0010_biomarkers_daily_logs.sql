-- Migration 0010: biomarkers.daily_logs
--
-- Daily self-reported wellness data. One row per patient per day.
-- Replaces DailyCheckin from base-44.
--
-- NOTE: No blood_glucose column. Glucose is a biomarker in biomarkers.lab_results.
-- Self-measured glucose goes there too with test_provider='self' or 'glucometer'.
--
-- Single writer: patient. Readers: patient, clinician, admin, systemAdmin.

create table if not exists biomarkers.daily_logs (
  id                uuid        primary key default gen_random_uuid(),
  user_uuid         uuid        not null references auth.users(id) on delete cascade,
  log_date          date        not null,
  unique(user_uuid, log_date),

  -- Sleep
  sleep_hours       numeric(4,2),
  sleep_quality     smallint    check (sleep_quality between 1 and 10),

  -- Wellbeing
  energy_level      smallint    check (energy_level between 1 and 10),
  mood              smallint    check (mood between 1 and 10),
  stress_level      smallint    check (stress_level between 1 and 10),

  -- Movement
  workout_completed boolean     default false,
  workout_type      text,
  workout_duration_min int,
  workout_intensity smallint    check (workout_intensity between 1 and 10),
  steps             int,
  strength_notes    text,

  -- Recovery
  mobility_completed boolean     default false,
  mobility_duration_min int,
  meditation_completed boolean   default false,
  meditation_duration_min int,
  sauna_completed   boolean     default false,
  sauna_rounds      int,

  -- Vitals
  weight_kg         numeric(5,2),
  hrv               numeric(6,2),
  resting_heart_rate int,
  blood_pressure_systolic int,
  blood_pressure_diastolic int,

  -- Nutrition
  water_ml          int,
  protein_grams     numeric(6,2),
  meals_consumed    jsonb       default '[]',

  -- Gut health
  gut_health        smallint    check (gut_health between 1 and 10),
  bowel_movements   int,
  bowel_quality     text,

  -- Supplements & notes
  supplements_taken text[]      not null default '{}',
  notes             text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists daily_logs_user_uuid_idx
  on biomarkers.daily_logs(user_uuid);
create index if not exists daily_logs_user_date_idx
  on biomarkers.daily_logs(user_uuid, log_date desc);

alter table biomarkers.daily_logs enable row level security;

drop policy if exists "daily_logs_owner_select" on biomarkers.daily_logs;
drop policy if exists "daily_logs_owner_insert" on biomarkers.daily_logs;
drop policy if exists "daily_logs_owner_update" on biomarkers.daily_logs;
drop policy if exists "daily_logs_owner_delete" on biomarkers.daily_logs;
drop policy if exists "daily_logs_clinician_select" on biomarkers.daily_logs;
drop policy if exists "daily_logs_admin_select" on biomarkers.daily_logs;

create policy "daily_logs_owner_select" on biomarkers.daily_logs
  for select using (auth.uid() = user_uuid);

create policy "daily_logs_owner_insert" on biomarkers.daily_logs
  for insert with check (auth.uid() = user_uuid);

create policy "daily_logs_owner_update" on biomarkers.daily_logs
  for update using (auth.uid() = user_uuid);

create policy "daily_logs_owner_delete" on biomarkers.daily_logs
  for delete using (auth.uid() = user_uuid);

create policy "daily_logs_clinician_select" on biomarkers.daily_logs
  for select using ((auth.jwt() ->> 'role') = 'clinician');

create policy "daily_logs_admin_select" on biomarkers.daily_logs
  for select using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

-- Trigger: set_updated_at
drop trigger if exists daily_logs_set_updated_at on biomarkers.daily_logs;
create trigger daily_logs_set_updated_at
  before update on biomarkers.daily_logs
  for each row
  execute function public.set_updated_at();

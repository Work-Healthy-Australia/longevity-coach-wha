-- Migration 0012: program tables (all in public)
--
-- supplement_plans, meal_plans, training_plans — AI-generated patient protocols.
-- items/macros_target/meal_structure/sessions are JSONB: opaque, schema-less,
-- not queried individually (AGENTS.md rule 3).
--
-- Writers: service_role (AI drafts), clinician (status updates).
-- Reader: patient (own records only), clinician, admin.

-- ============================================================================
-- public.supplement_plans
-- ============================================================================

create table if not exists public.supplement_plans (
  id                uuid        primary key default gen_random_uuid(),
  patient_uuid      uuid        not null references auth.users(id) on delete cascade,
  created_by_uuid   uuid        references auth.users(id) on delete set null,
  created_by_role   text        not null check (created_by_role in ('ai', 'clinician', 'coach')),
  status            text        not null default 'draft'
                    check (status in ('draft', 'active', 'paused', 'completed', 'superseded')),
  valid_from        date,
  valid_to          date,
  items             jsonb       not null default '[]',
  notes             text,
  review_id         uuid        references public.periodic_reviews(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists supplement_plans_patient_uuid_idx
  on public.supplement_plans(patient_uuid);
create index if not exists supplement_plans_patient_status_idx
  on public.supplement_plans(patient_uuid, status, valid_from desc);

alter table public.supplement_plans enable row level security;

drop policy if exists "supplement_plans_patient_select"   on public.supplement_plans;
drop policy if exists "supplement_plans_service_insert"   on public.supplement_plans;
drop policy if exists "supplement_plans_clinician_update" on public.supplement_plans;
drop policy if exists "supplement_plans_admin_all"        on public.supplement_plans;

create policy "supplement_plans_patient_select" on public.supplement_plans
  for select using (auth.uid() = patient_uuid);

create policy "supplement_plans_service_insert" on public.supplement_plans
  for insert with check (auth.role() = 'service_role');

create policy "supplement_plans_clinician_update" on public.supplement_plans
  for update using ((auth.jwt() ->> 'role') = 'clinician');

create policy "supplement_plans_admin_all" on public.supplement_plans
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop trigger if exists supplement_plans_set_updated_at on public.supplement_plans;
create trigger supplement_plans_set_updated_at
  before update on public.supplement_plans
  for each row execute function public.set_updated_at();

-- ============================================================================
-- public.meal_plans
-- ============================================================================

create table if not exists public.meal_plans (
  id                   uuid        primary key default gen_random_uuid(),
  patient_uuid         uuid        not null references auth.users(id) on delete cascade,
  created_by_uuid      uuid        references auth.users(id) on delete set null,
  created_by_role      text        not null check (created_by_role in ('ai', 'clinician', 'coach')),
  status               text        not null default 'draft'
                       check (status in ('draft', 'active', 'paused', 'completed', 'superseded')),
  valid_from           date,
  valid_to             date,
  dietary_restrictions text[]      not null default '{}',
  calorie_target       int,
  macros_target        jsonb,
  meal_structure       jsonb,
  notes                text,
  review_id            uuid        references public.periodic_reviews(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists meal_plans_patient_uuid_idx
  on public.meal_plans(patient_uuid);
create index if not exists meal_plans_patient_status_idx
  on public.meal_plans(patient_uuid, status, valid_from desc);

alter table public.meal_plans enable row level security;

drop policy if exists "meal_plans_patient_select"   on public.meal_plans;
drop policy if exists "meal_plans_service_insert"   on public.meal_plans;
drop policy if exists "meal_plans_clinician_update" on public.meal_plans;
drop policy if exists "meal_plans_admin_all"        on public.meal_plans;

create policy "meal_plans_patient_select" on public.meal_plans
  for select using (auth.uid() = patient_uuid);

create policy "meal_plans_service_insert" on public.meal_plans
  for insert with check (auth.role() = 'service_role');

create policy "meal_plans_clinician_update" on public.meal_plans
  for update using ((auth.jwt() ->> 'role') = 'clinician');

create policy "meal_plans_admin_all" on public.meal_plans
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop trigger if exists meal_plans_set_updated_at on public.meal_plans;
create trigger meal_plans_set_updated_at
  before update on public.meal_plans
  for each row execute function public.set_updated_at();

-- ============================================================================
-- public.training_plans
-- ============================================================================

create table if not exists public.training_plans (
  id                uuid        primary key default gen_random_uuid(),
  patient_uuid      uuid        not null references auth.users(id) on delete cascade,
  created_by_uuid   uuid        references auth.users(id) on delete set null,
  created_by_role   text        not null check (created_by_role in ('ai', 'clinician', 'coach')),
  status            text        not null default 'draft'
                    check (status in ('draft', 'active', 'paused', 'completed', 'superseded')),
  valid_from        date,
  valid_to          date,
  sessions_per_week smallint,
  sessions          jsonb       not null default '[]',
  notes             text,
  review_id         uuid        references public.periodic_reviews(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists training_plans_patient_uuid_idx
  on public.training_plans(patient_uuid);
create index if not exists training_plans_patient_status_idx
  on public.training_plans(patient_uuid, status, valid_from desc);

alter table public.training_plans enable row level security;

drop policy if exists "training_plans_patient_select"   on public.training_plans;
drop policy if exists "training_plans_service_insert"   on public.training_plans;
drop policy if exists "training_plans_clinician_update" on public.training_plans;
drop policy if exists "training_plans_admin_all"        on public.training_plans;

create policy "training_plans_patient_select" on public.training_plans
  for select using (auth.uid() = patient_uuid);

create policy "training_plans_service_insert" on public.training_plans
  for insert with check (auth.role() = 'service_role');

create policy "training_plans_clinician_update" on public.training_plans
  for update using ((auth.jwt() ->> 'role') = 'clinician');

create policy "training_plans_admin_all" on public.training_plans
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop trigger if exists training_plans_set_updated_at on public.training_plans;
create trigger training_plans_set_updated_at
  before update on public.training_plans
  for each row execute function public.set_updated_at();

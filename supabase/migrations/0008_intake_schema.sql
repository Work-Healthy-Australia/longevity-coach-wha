-- Migration 0008: public.family_members
--
-- Family history drives the actuarial risk engine (hereditary disease risk,
-- age-at-death patterns). Stored as structured rows (not JSONB) so the risk
-- engine can query by relationship and cause_category without JSON parsing.
--
-- Single writer: patient. Readers: patient, clinician, admin, systemAdmin.

create table if not exists public.family_members (
  id                uuid        primary key default gen_random_uuid(),
  user_uuid         uuid        not null references auth.users(id) on delete cascade,
  relationship      text        not null check (relationship in (
    'mother', 'father',
    'maternal_grandmother', 'maternal_grandfather',
    'paternal_grandmother', 'paternal_grandfather',
    'sibling', 'other'
  )),
  sex               text        check (sex in ('male', 'female', 'unknown')),
  is_alive          boolean     not null,
  current_age       int,
  age_at_death      int,
  cause_category    text        check (cause_category in (
    'cardiovascular', 'cancer', 'neurological', 'metabolic',
    'respiratory', 'infection', 'accident', 'other', 'unknown'
  )),
  conditions        text[]      not null default '{}',
  smoking_status    text        check (smoking_status in ('never', 'former', 'current', 'unknown')),
  alcohol_use       text        check (alcohol_use in ('none', 'moderate', 'heavy', 'unknown')),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists family_members_user_uuid_idx
  on public.family_members(user_uuid);
create index if not exists family_members_user_relationship_idx
  on public.family_members(user_uuid, relationship, is_alive);

alter table public.family_members enable row level security;

drop policy if exists "family_members_owner_select"    on public.family_members;
drop policy if exists "family_members_owner_insert"    on public.family_members;
drop policy if exists "family_members_owner_update"    on public.family_members;
drop policy if exists "family_members_owner_delete"    on public.family_members;
drop policy if exists "family_members_clinician_select" on public.family_members;
drop policy if exists "family_members_admin_select"    on public.family_members;

create policy "family_members_owner_select" on public.family_members
  for select using (auth.uid() = user_uuid);

create policy "family_members_owner_insert" on public.family_members
  for insert with check (auth.uid() = user_uuid);

create policy "family_members_owner_update" on public.family_members
  for update using (auth.uid() = user_uuid);

create policy "family_members_owner_delete" on public.family_members
  for delete using (auth.uid() = user_uuid);

create policy "family_members_clinician_select" on public.family_members
  for select using ((auth.jwt() ->> 'role') = 'clinician');

create policy "family_members_admin_select" on public.family_members
  for select using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop trigger if exists family_members_set_updated_at on public.family_members;
create trigger family_members_set_updated_at
  before update on public.family_members
  for each row execute function public.set_updated_at();

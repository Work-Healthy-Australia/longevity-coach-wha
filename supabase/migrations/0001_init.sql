-- Longevity Coach: initial schema
-- Patient data architecture (per sprint plan Part 2):
--   profiles        : identifier store, 1:1 with auth.users, RLS-locked to owner
--   health_profiles : de-identified questionnaire data, linked by user_uuid
--   risk_scores     : de-identified bio-age + domain risk scores
--   subscriptions   : Stripe billing state
--
-- This migration is idempotent — safe to re-run if a previous attempt
-- partially applied. It uses gen_random_uuid() (built-in since PG 13)
-- rather than uuid-ossp's uuid_generate_v4(), which lives in Supabase's
-- `extensions` schema and isn't on the default search_path.
--
-- TODO before production launch: move PII columns in `profiles`
-- (full_name, phone, date_of_birth) into Supabase Vault. Email stays in
-- auth.users. RLS is the primary access control; Vault is defense in depth.

-- ---------------------------------------------------------------------------
-- profiles : identifier store
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  date_of_birth date,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_owner_select" on public.profiles;
drop policy if exists "profiles_owner_update" on public.profiles;
drop policy if exists "profiles_owner_insert" on public.profiles;
drop policy if exists "profiles_admin_select" on public.profiles;

create policy "profiles_owner_select" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_owner_update" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_owner_insert" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_admin_select" on public.profiles
  for select using ((auth.jwt() ->> 'role') = 'admin');

-- ---------------------------------------------------------------------------
-- health_profiles : de-identified questionnaire responses
-- ---------------------------------------------------------------------------
create table if not exists public.health_profiles (
  id uuid primary key default gen_random_uuid(),
  user_uuid uuid not null references auth.users(id) on delete cascade,
  responses jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists health_profiles_user_uuid_idx
  on public.health_profiles(user_uuid);

alter table public.health_profiles enable row level security;

drop policy if exists "health_owner_all" on public.health_profiles;
drop policy if exists "health_admin_select" on public.health_profiles;

create policy "health_owner_all" on public.health_profiles
  for all using (auth.uid() = user_uuid) with check (auth.uid() = user_uuid);
create policy "health_admin_select" on public.health_profiles
  for select using ((auth.jwt() ->> 'role') = 'admin');

-- ---------------------------------------------------------------------------
-- risk_scores : bio-age and per-domain risk
-- ---------------------------------------------------------------------------
create table if not exists public.risk_scores (
  id uuid primary key default gen_random_uuid(),
  user_uuid uuid not null references auth.users(id) on delete cascade,
  biological_age numeric(5,2),
  cv_risk numeric(5,2),
  metabolic_risk numeric(5,2),
  neuro_risk numeric(5,2),
  onco_risk numeric(5,2),
  msk_risk numeric(5,2),
  computed_at timestamptz not null default now()
);

create index if not exists risk_scores_user_uuid_idx
  on public.risk_scores(user_uuid);

alter table public.risk_scores enable row level security;

drop policy if exists "risk_owner_select" on public.risk_scores;
drop policy if exists "risk_admin_select" on public.risk_scores;

-- Reads only; writes happen via service_role (server-side risk engine).
create policy "risk_owner_select" on public.risk_scores
  for select using (auth.uid() = user_uuid);
create policy "risk_admin_select" on public.risk_scores
  for select using ((auth.jwt() ->> 'role') = 'admin');

-- ---------------------------------------------------------------------------
-- subscriptions : Stripe state (wired up in a later sprint day)
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_uuid uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null,
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_uuid_idx
  on public.subscriptions(user_uuid);

alter table public.subscriptions enable row level security;

drop policy if exists "subs_owner_select" on public.subscriptions;
drop policy if exists "subs_admin_select" on public.subscriptions;

create policy "subs_owner_select" on public.subscriptions
  for select using (auth.uid() = user_uuid);
create policy "subs_admin_select" on public.subscriptions
  for select using ((auth.jwt() ->> 'role') = 'admin');

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Auto-create a profile row whenever a new auth.users row appears.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists health_profiles_set_updated_at on public.health_profiles;
create trigger health_profiles_set_updated_at
  before update on public.health_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

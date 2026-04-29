-- 0052_erasure_log_and_data_no_training.sql
-- Right-to-erasure foundation: an append-only audit table that records every
-- deletion request and its outcome, plus FK relaxations on existing audit
-- tables so the audit trail survives a hard-delete of auth.users.
--
-- Compliance context: AHPRA / Australian Privacy Act + GDPR right-to-erasure.
-- We must be able to prove an erasure happened, what it covered, and what
-- happened to billing — even after the user row itself is gone.
--
-- Idempotent throughout: safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. profiles.erased_at — soft-delete marker
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists erased_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. erasure_log — append-only audit table
-- ---------------------------------------------------------------------------

create table if not exists public.erasure_log (
  id uuid primary key default gen_random_uuid(),
  -- nullable + ON DELETE SET NULL so the audit row outlives a hard-delete.
  user_uuid uuid references auth.users(id) on delete set null,
  erased_at timestamptz not null default now(),
  -- request_ip + request_user_agent are intentionally meta-PII on this audit
  -- table (matches the consent_records / export_log convention). Required
  -- for AHPRA-style "who triggered this erasure, from where, with what
  -- client" audit forensics. Not subject to the Rule 2 "PII lives only on
  -- profiles" boundary because the request metadata never identifies the
  -- patient on its own.
  request_ip text,
  request_user_agent text,
  confirmation_text text not null,
  table_counts jsonb not null,
  hard_delete bool not null default false,
  stripe_subscription_action text
    check (stripe_subscription_action in ('none', 'cancelled', 'blocked'))
);

create index if not exists erasure_log_user_uuid_idx
  on public.erasure_log(user_uuid);
create index if not exists erasure_log_erased_at_idx
  on public.erasure_log(erased_at desc);

alter table public.erasure_log enable row level security;

-- service_role bypasses RLS, so no INSERT policy is needed (matches the
-- pattern used by export_log in 0026). No owner-select by design — only
-- admins can review the erasure audit trail.
drop policy if exists "erasure_log_admin_select" on public.erasure_log;
create policy "erasure_log_admin_select" on public.erasure_log
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- ---------------------------------------------------------------------------
-- 3. consent_records.user_uuid — relax FK to ON DELETE SET NULL + nullable
-- ---------------------------------------------------------------------------
-- Original (0004): `user_uuid uuid not null references auth.users(id) on delete cascade`.
-- Erasure must preserve the consent record (AHPRA audit trail), so we drop
-- the cascade and allow null after a hard delete.

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'consent_records_user_uuid_fkey'
      and conrelid = 'public.consent_records'::regclass
  ) then
    alter table public.consent_records
      drop constraint consent_records_user_uuid_fkey;
  end if;
end $$;

alter table public.consent_records
  alter column user_uuid drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'consent_records_user_uuid_fkey'
      and conrelid = 'public.consent_records'::regclass
  ) then
    alter table public.consent_records
      add constraint consent_records_user_uuid_fkey
      foreign key (user_uuid) references auth.users(id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. export_log.user_uuid — same FK relaxation
-- ---------------------------------------------------------------------------
-- Original (0026): `user_uuid uuid not null references auth.users(id) on delete cascade`.

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'export_log_user_uuid_fkey'
      and conrelid = 'public.export_log'::regclass
  ) then
    alter table public.export_log
      drop constraint export_log_user_uuid_fkey;
  end if;
end $$;

alter table public.export_log
  alter column user_uuid drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'export_log_user_uuid_fkey'
      and conrelid = 'public.export_log'::regclass
  ) then
    alter table public.export_log
      add constraint export_log_user_uuid_fkey
      foreign key (user_uuid) references auth.users(id) on delete set null;
  end if;
end $$;

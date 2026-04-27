-- Audit trail for consent capture. Each row = one toggle accepted by one
-- user against a versioned policy. Append-only by design (no UPDATE policy).
-- Required for AHPRA / Australian Privacy Act compliance: we must be able
-- to show which version of which policy a user agreed to, and when.

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_uuid uuid not null references auth.users(id) on delete cascade,
  policy_id text not null,
  policy_version text not null,
  accepted_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists consent_records_user_uuid_idx
  on public.consent_records(user_uuid);
create index if not exists consent_records_policy_idx
  on public.consent_records(policy_id, policy_version);

alter table public.consent_records enable row level security;

drop policy if exists "consent_owner_select" on public.consent_records;
drop policy if exists "consent_owner_insert" on public.consent_records;
drop policy if exists "consent_admin_select" on public.consent_records;

-- Owner can read their own consent history and insert new acceptances.
-- No UPDATE / DELETE policies => append-only audit trail.
create policy "consent_owner_select" on public.consent_records
  for select using (auth.uid() = user_uuid);
create policy "consent_owner_insert" on public.consent_records
  for insert with check (auth.uid() = user_uuid);
create policy "consent_admin_select" on public.consent_records
  for select using ((auth.jwt() ->> 'role') = 'admin');

-- Migration 0015: health_updates table (research digests for display)
--
-- Writer: Nova research pipeline (service_role only). Content is generic — not user-specific.
-- Reader: All authenticated users.
--
-- Note: health_knowledge (pgvector) is in migration 0016.
-- Enable the pgvector extension in Supabase Dashboard before applying 0016.

create table if not exists public.health_updates (
  id             uuid        primary key default gen_random_uuid(),
  title          text        not null,
  content        text        not null,
  category       text        not null check (category in (
                   'longevity', 'biohacking', 'supplements',
                   'exercise', 'nutrition', 'sleep'
                 )),
  source         text        not null,
  evidence_level text        not null check (evidence_level in ('strong', 'moderate', 'preliminary')),
  posted_date    timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create index if not exists health_updates_category_idx
  on public.health_updates(category, posted_date desc);

alter table public.health_updates enable row level security;

drop policy if exists "health_updates_auth_select"    on public.health_updates;
drop policy if exists "health_updates_service_insert" on public.health_updates;
drop policy if exists "health_updates_admin_all"      on public.health_updates;

create policy "health_updates_auth_select" on public.health_updates
  for select using (auth.role() = 'authenticated');

create policy "health_updates_service_insert" on public.health_updates
  for insert with check (auth.role() = 'service_role');

create policy "health_updates_admin_all" on public.health_updates
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

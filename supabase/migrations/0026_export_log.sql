-- 0026_export_log.sql
-- Append-only audit log for /api/export. One row per export attempt.
-- Owner can read their own rows; inserts are service-role only by design
-- (no insert policy — the export route uses the admin client to write).

create table if not exists public.export_log (
  id           uuid primary key default gen_random_uuid(),
  user_uuid    uuid not null references auth.users(id) on delete cascade,
  exported_at  timestamptz not null default now(),
  format       text not null check (format in ('json','zip','pdf')),
  byte_size    integer,
  request_ip   text,
  created_at   timestamptz not null default now()
);

alter table public.export_log enable row level security;

drop policy if exists "export_log_owner_select" on public.export_log;
create policy "export_log_owner_select" on public.export_log
  for select to authenticated using (auth.uid() = user_uuid);

-- Service-role only for inserts (admin client from /api/export).
-- No insert policy is intentional: service_role bypasses RLS.

create index if not exists export_log_user_uuid_idx
  on public.export_log(user_uuid);

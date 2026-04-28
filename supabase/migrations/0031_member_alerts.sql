-- 0031_member_alerts.sql
-- In-app alerts surface. Append-mostly; status mutates on dismiss.
-- Inserts: service-role (cron + post-upload helper). Updates: owner only.

create table if not exists public.member_alerts (
  id            uuid primary key default gen_random_uuid(),
  user_uuid     uuid not null references auth.users(id) on delete cascade,
  alert_type    text not null check (alert_type in ('lab_out_of_range', 'repeat_test')),
  severity      text not null check (severity in ('info', 'attention', 'urgent')),
  source_id     text not null,
  title         text not null,
  body          text not null,
  link_href     text,
  status        text not null default 'open' check (status in ('open', 'dismissed', 'resolved')),
  created_at    timestamptz not null default now(),
  dismissed_at  timestamptz,
  resolved_at   timestamptz
);

alter table public.member_alerts enable row level security;

drop policy if exists "member_alerts_owner_select" on public.member_alerts;
create policy "member_alerts_owner_select" on public.member_alerts
  for select to authenticated using (auth.uid() = user_uuid);

drop policy if exists "member_alerts_owner_update" on public.member_alerts;
create policy "member_alerts_owner_update" on public.member_alerts
  for update to authenticated
  using (auth.uid() = user_uuid)
  with check (auth.uid() = user_uuid);

-- No insert policy: service-role-only insert via admin client.

create index if not exists member_alerts_user_status_idx
  on public.member_alerts(user_uuid, status, created_at desc);

create unique index if not exists member_alerts_open_unique_partial
  on public.member_alerts(user_uuid, alert_type, source_id)
  where status = 'open';

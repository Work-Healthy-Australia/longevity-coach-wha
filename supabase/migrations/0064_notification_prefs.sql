-- 0064_notification_prefs.sql
-- Per-user delivery preferences for reminder dispatchers (Epic 7, Epic 11).
-- One row per user. Default opt-in; user can toggle from /account.
-- Service-role and owner can write; nobody else reads.
-- Idempotency for cron handlers lives in last_*_sent_at columns and in
-- member_alerts.email_sent_at (added below).

create table if not exists public.notification_prefs (
  user_uuid                          uuid primary key references auth.users(id) on delete cascade,
  check_in_reminders                 boolean not null default true,
  weekly_digest                      boolean not null default true,
  alert_emails                       boolean not null default true,
  last_check_in_reminder_sent_at     timestamptz,
  last_weekly_digest_sent_at         timestamptz,
  updated_at                         timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;

drop policy if exists "notification_prefs_owner_select" on public.notification_prefs;
create policy "notification_prefs_owner_select" on public.notification_prefs
  for select to authenticated using (auth.uid() = user_uuid);

drop policy if exists "notification_prefs_owner_update" on public.notification_prefs;
create policy "notification_prefs_owner_update" on public.notification_prefs
  for update to authenticated
  using (auth.uid() = user_uuid)
  with check (auth.uid() = user_uuid);

drop policy if exists "notification_prefs_owner_insert" on public.notification_prefs;
create policy "notification_prefs_owner_insert" on public.notification_prefs
  for insert to authenticated
  with check (auth.uid() = user_uuid);

-- Backfill: every existing profile gets a default-opt-in row.
insert into public.notification_prefs (user_uuid)
select id from public.profiles
on conflict (user_uuid) do nothing;

-- Idempotency for the alert-email cron — every member_alerts row gets at
-- most one email (only when alert_emails pref is true and account isn't paused).
alter table public.member_alerts
  add column if not exists email_sent_at timestamptz;

create index if not exists member_alerts_email_pending_idx
  on public.member_alerts(email_sent_at)
  where status = 'open' and email_sent_at is null;

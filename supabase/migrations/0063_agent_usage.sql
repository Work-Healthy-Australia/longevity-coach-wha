-- 0063_agent_usage.sql
-- Anthropic API spend telemetry. Two tables:
--   agent_usage         — one row per Claude call (token counts + cost in cents)
--   agent_cost_alerts   — one row when daily spend crosses the configured threshold
--
-- Both tables: append-only by service-role; admin select; no PII.

create table if not exists public.agent_usage (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  agent_slug          text not null,
  model               text not null,
  user_uuid           uuid references auth.users(id) on delete set null,
  input_tokens        integer not null default 0,
  output_tokens       integer not null default 0,
  cache_read_tokens   integer not null default 0,
  cache_write_tokens  integer not null default 0,
  cost_usd_cents      integer not null default 0,
  latency_ms          integer not null default 0,
  success             boolean not null default true,
  path                text not null check (path in ('stream', 'pipeline_t1', 'pipeline_t2', 'pipeline_t3'))
);

create index if not exists agent_usage_created_at_idx
  on public.agent_usage(created_at desc);

create index if not exists agent_usage_agent_created_idx
  on public.agent_usage(agent_slug, created_at desc);

alter table public.agent_usage enable row level security;

drop policy if exists "agent_usage_admin_select" on public.agent_usage;
create policy "agent_usage_admin_select" on public.agent_usage
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- No insert/update/delete policy: service-role only.

-- ── Cost alerts ─────────────────────────────────────────────────────────────

create table if not exists public.agent_cost_alerts (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  period_date         date not null,
  cost_usd_cents      integer not null,
  threshold_usd_cents integer not null,
  severity            text not null default 'attention' check (severity in ('attention', 'urgent')),
  status              text not null default 'open' check (status in ('open', 'acknowledged')),
  notes               text
);

create unique index if not exists agent_cost_alerts_period_unique
  on public.agent_cost_alerts(period_date);

create index if not exists agent_cost_alerts_status_idx
  on public.agent_cost_alerts(status, created_at desc);

alter table public.agent_cost_alerts enable row level security;

drop policy if exists "agent_cost_alerts_admin_select" on public.agent_cost_alerts;
create policy "agent_cost_alerts_admin_select" on public.agent_cost_alerts
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "agent_cost_alerts_admin_update" on public.agent_cost_alerts;
create policy "agent_cost_alerts_admin_update" on public.agent_cost_alerts
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

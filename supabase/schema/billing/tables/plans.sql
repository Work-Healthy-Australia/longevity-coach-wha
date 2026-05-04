-- ============================================================================
-- billing.plans — canonical schema
--
-- Backfilled in PR #BUG-014 (2026-05-04) per .claude/rules/database.md.
-- The table itself was created in migration 0013_billing_schema.sql; the
-- tier check constraint was dropped in 0061_plans_open_tier.sql; B2C rows
-- (Core/Clinical/Elite × month/year) were seeded in 0060 and 0070.
--
-- Live tier values: 'core' | 'clinical' | 'elite' (application-managed via
-- Zod at the admin API; no DB constraint).
-- ============================================================================

create table if not exists billing.plans (
  id                  uuid        primary key default gen_random_uuid(),
  name                text        not null,
  tier                text        not null,
  billing_interval    text        not null check (billing_interval in ('month', 'year')),
  stripe_price_id     text        not null unique,
  base_price_cents    int         not null check (base_price_cents >= 0),
  annual_discount_pct numeric(5,2) not null default 0 check (annual_discount_pct between 0 and 100),
  feature_flags       jsonb       not null default '{}'::jsonb,
  is_active           boolean     not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table billing.plans enable row level security;

-- Public can read active plans (powers /pricing).
drop policy if exists "plans_public_select" on billing.plans;
create policy "plans_public_select" on billing.plans
  for select using (is_active = true);

-- Admin write access via JWT role claim.
drop policy if exists "plans_admin_all" on billing.plans;
create policy "plans_admin_all" on billing.plans
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop trigger if exists plans_set_updated_at on billing.plans;
create trigger plans_set_updated_at
  before update on billing.plans
  for each row execute function public.set_updated_at();

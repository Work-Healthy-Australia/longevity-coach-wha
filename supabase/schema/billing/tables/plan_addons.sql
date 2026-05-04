-- ============================================================================
-- billing.plan_addons — canonical schema
--
-- Backfilled in PR #BUG-014 (2026-05-04) per .claude/rules/database.md.
-- The table itself was created in migration 0013_billing_schema.sql; the
-- min_tier check constraint was dropped in 0070 (mirrors what 0061 did for
-- billing.plans.tier).
--
-- Live tier values for min_tier: 'core' | 'clinical' | 'elite'
-- (application-managed via Zod at the admin API; no DB constraint).
-- ============================================================================

create table if not exists billing.plan_addons (
  id                       uuid        primary key default gen_random_uuid(),
  name                     text        not null,
  description              text,
  feature_key              text        not null unique,
  stripe_price_id_monthly  text        not null unique,
  stripe_price_id_annual   text        not null unique,
  price_monthly_cents      int         not null check (price_monthly_cents >= 0),
  price_annual_cents       int         not null check (price_annual_cents >= 0),
  min_tier                 text        not null,
  is_active                boolean     not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table billing.plan_addons enable row level security;

-- Public can read active add-ons (powers /pricing add-on list).
drop policy if exists "plan_addons_public_select" on billing.plan_addons;
create policy "plan_addons_public_select" on billing.plan_addons
  for select using (is_active = true);

-- Admin write access via JWT role claim.
drop policy if exists "plan_addons_admin_all" on billing.plan_addons;
create policy "plan_addons_admin_all" on billing.plan_addons
  for all using ((auth.jwt() ->> 'role') in ('admin', 'systemAdmin'));

drop trigger if exists plan_addons_set_updated_at on billing.plan_addons;
create trigger plan_addons_set_updated_at
  before update on billing.plan_addons
  for each row execute function public.set_updated_at();

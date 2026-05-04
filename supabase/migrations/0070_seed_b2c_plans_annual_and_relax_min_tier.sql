-- ============================================================================
-- 0070_seed_b2c_plans_annual_and_relax_min_tier.sql
--
-- Two coupled changes for BUG-014:
--
-- 1) Insert 3 annual rows into billing.plans (Core / Clinical / Elite,
--    billing_interval='year') so the /pricing page Annual toggle has rows to
--    display. The 0060 migration only seeded monthly rows.
--
-- 2) Drop the legacy min_tier check constraint on billing.plan_addons. The
--    constraint hard-codes the original ('individual', 'professional',
--    'corporate') tier model, but the live tier model is core/clinical/elite
--    (per 0060 + this PR). Mirrors what 0061 did for billing.plans.tier:
--    tier values are now application-managed (Zod gates at the admin API),
--    not schema-managed.
--
-- Pricing convention (matches 0060): base_price_cents holds the monthly base
-- price for both monthly and annual rows; annual_discount_pct controls the
-- annual savings. PricingClient.tsx computes the displayed monthly-equivalent
-- price for annual rows as base_price_cents * (1 - annual_discount_pct/100).
--
-- Stripe price IDs are deterministic placeholders matching the 0060
-- convention. Real IDs are populated via the admin UI before checkout works
-- end-to-end (Stripe rejects unknown price IDs at session creation).
-- ============================================================================

insert into billing.plans (name, tier, billing_interval, stripe_price_id, base_price_cents, annual_discount_pct, is_active)
select 'Core', 'core', 'year', 'price_CORE_ANNUAL_PLACEHOLDER', 4900, 20, true
where not exists (select 1 from billing.plans where tier = 'core' and billing_interval = 'year');

insert into billing.plans (name, tier, billing_interval, stripe_price_id, base_price_cents, annual_discount_pct, is_active)
select 'Clinical', 'clinical', 'year', 'price_CLINICAL_ANNUAL_PLACEHOLDER', 9900, 20, true
where not exists (select 1 from billing.plans where tier = 'clinical' and billing_interval = 'year');

insert into billing.plans (name, tier, billing_interval, stripe_price_id, base_price_cents, annual_discount_pct, is_active)
select 'Elite', 'elite', 'year', 'price_ELITE_ANNUAL_PLACEHOLDER', 19900, 20, true
where not exists (select 1 from billing.plans where tier = 'elite' and billing_interval = 'year');

do $$ begin
  alter table billing.plan_addons drop constraint if exists plan_addons_min_tier_check;
exception when undefined_object then null;
end $$;

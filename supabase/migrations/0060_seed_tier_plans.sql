-- ============================================================================
-- 0053_seed_tier_plans.sql
--
-- Seeds billing.plans with the three canonical B2C tier rows (core, clinical,
-- elite). Depends on 0052 (tier constraint expansion).
-- Prices are placeholder defaults — admin sets real Stripe IDs from the UI.
-- Idempotent: skips rows where a plan with that tier already exists.
-- ============================================================================

insert into billing.plans (name, tier, billing_interval, stripe_price_id, base_price_cents, annual_discount_pct, is_active)
select 'Core', 'core', 'month', 'price_CORE_PLACEHOLDER', 4900, 20, true
where not exists (select 1 from billing.plans where tier = 'core');

insert into billing.plans (name, tier, billing_interval, stripe_price_id, base_price_cents, annual_discount_pct, is_active)
select 'Clinical', 'clinical', 'month', 'price_CLINICAL_PLACEHOLDER', 9900, 20, true
where not exists (select 1 from billing.plans where tier = 'clinical');

insert into billing.plans (name, tier, billing_interval, stripe_price_id, base_price_cents, annual_discount_pct, is_active)
select 'Elite', 'elite', 'month', 'price_ELITE_PLACEHOLDER', 19900, 20, true
where not exists (select 1 from billing.plans where tier = 'elite');

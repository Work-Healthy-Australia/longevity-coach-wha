-- ============================================================================
-- 0054_plans_open_tier.sql
--
-- Removes the hardcoded tier check constraint from billing.plans so admin
-- can create arbitrary tier names from the UI (e.g. "enterprise", "basic").
-- The constraint was an implementation detail from the original two-tier model;
-- tier values are now admin-managed, not code-managed.
-- ============================================================================

do $$ begin
  alter table billing.plans drop constraint if exists plans_tier_check;
exception when undefined_object then null;
end $$;

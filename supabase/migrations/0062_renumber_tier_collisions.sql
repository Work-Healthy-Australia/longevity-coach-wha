-- Reconcile supabase_migrations.name after renaming the two collision migrations
-- introduced by PR #52 (Feat/260429 agent complete) which clashed with 0053
-- (seed_janet_clinician) and 0054 (erasure_log_and_data_no_training).
--
--   0053_seed_tier_plans.sql  -> 0060_seed_tier_plans.sql
--   0054_plans_open_tier.sql  -> 0061_plans_open_tier.sql
--
-- Idempotent: each UPDATE no-ops if already renamed. The renamed files are
-- themselves idempotent (WHERE NOT EXISTS / DROP CONSTRAINT IF EXISTS) so a
-- one-time double-apply is safe if production picks up the new filenames
-- before this UPDATE runs.

UPDATE supabase_migrations.schema_migrations SET name = '0060_seed_tier_plans.sql'
  WHERE name = '0053_seed_tier_plans.sql';

UPDATE supabase_migrations.schema_migrations SET name = '0061_plans_open_tier.sql'
  WHERE name = '0054_plans_open_tier.sql';

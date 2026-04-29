-- Reconcile supabase_migrations.name after one-shot file renumber.
-- Old collision groups (0046×2, 0051×2, 0052×3) collapsed into 0046–0056 monotonic.
-- Idempotent: each UPDATE uses WHERE name = old_name (no-op if already renamed).

UPDATE supabase_migrations.schema_migrations SET name = '0047_meal_plan_recipes_shopping.sql'
  WHERE name = '0046_meal_plan_recipes_shopping.sql';

UPDATE supabase_migrations.schema_migrations SET name = '0048_billing_org_addons_stripe_item_and_invites.sql'
  WHERE name = '0047_billing_org_addons_stripe_item_and_invites.sql';

UPDATE supabase_migrations.schema_migrations SET name = '0049_clinician_portal_foundation.sql'
  WHERE name = '0048_clinician_portal_foundation.sql';

UPDATE supabase_migrations.schema_migrations SET name = '0050_periodic_reviews_program.sql'
  WHERE name = '0049_periodic_reviews_program.sql';

UPDATE supabase_migrations.schema_migrations SET name = '0051_appointments_clinician_portal.sql'
  WHERE name = '0050_appointments_clinician_portal.sql';

UPDATE supabase_migrations.schema_migrations SET name = '0052_janet_tool_aware_system_prompt.sql'
  WHERE name = '0051_janet_tool_aware_system_prompt.sql';

UPDATE supabase_migrations.schema_migrations SET name = '0053_seed_janet_clinician.sql'
  WHERE name = '0051_seed_janet_clinician.sql';

UPDATE supabase_migrations.schema_migrations SET name = '0054_erasure_log_and_data_no_training.sql'
  WHERE name = '0052_erasure_log_and_data_no_training.sql';

UPDATE supabase_migrations.schema_migrations SET name = '0055_pricing_admin_foundation.sql'
  WHERE name = '0052_pricing_admin_foundation.sql';

UPDATE supabase_migrations.schema_migrations SET name = '0056_upsert_supplement_advisor_agent.sql'
  WHERE name = '0052_upsert_supplement_advisor_agent.sql';

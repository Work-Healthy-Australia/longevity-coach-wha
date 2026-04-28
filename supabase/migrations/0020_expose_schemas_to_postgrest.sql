-- Migration 0020: expose non-public schemas to PostgREST.
--
-- Migration 0007 created the `biomarkers` and `billing` schemas but did not
-- add them to PostgREST's exposed-schema list. As a result, the Supabase JS
-- client could not query e.g. `biomarkers.daily_logs` even though RLS was
-- correct.
--
-- This migration sets `pgrst.db_schemas` for the supabase admin role and
-- triggers a config reload so the change takes effect immediately.
--
-- Idempotent: re-running just re-asserts the same setting.

alter role postgres set pgrst.db_schemas = 'public, graphql_public, biomarkers, billing';

-- Reload PostgREST so the new schema list takes effect without a restart.
notify pgrst, 'reload config';

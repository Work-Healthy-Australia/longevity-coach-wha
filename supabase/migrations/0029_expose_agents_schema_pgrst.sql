-- Migration 0029: expose agents schema to PostgREST
-- Migration 0025 moved agent_definitions, health_knowledge, and agent_conversations
-- from public to agents schema, but did not add 'agents' to PostgREST's db_schemas
-- list. This causes all .schema('agents') calls from supabase-js to fail with
-- PGRST106 ("Invalid schema: agents").
-- The current exposed set from PostgREST hint: public, graphql_public, biomarkers, billing.

ALTER ROLE authenticator SET pgrst.db_schemas TO 'public, graphql_public, biomarkers, billing, agents';

NOTIFY pgrst, 'reload schema';

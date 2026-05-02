-- ============================================================================
-- 0015b_enable_pgvector.sql
--
-- Enable the pgvector extension and surface it on the search_path so the
-- bare `vector(N)` type used by migration 0016 (knowledge_base_pgvector)
-- resolves without an `extensions.` schema prefix.
--
-- Production already has pgvector enabled (set up manually via Supabase
-- Dashboard before 0016 was first applied), so both statements below are
-- idempotent no-ops there. The migration exists to make `supabase start`
-- work cleanly on a fresh local dev environment.
--
-- Filename uses 0015b suffix so it sorts between 0015_health_updates and
-- 0016_knowledge_base_pgvector under lexical ordering ('_' < 'a' < 'b').
-- ============================================================================

create extension if not exists vector with schema extensions;

alter database postgres set search_path to "$user", public, extensions;

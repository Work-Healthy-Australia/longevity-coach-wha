-- Migration 0055: Formalize pgvector extension in migration history
--
-- Migration 0016_knowledge_base_pgvector.sql creates a vector(2560) column
-- and HNSW index (vector_cosine_ops, m=16, ef_construction=64) on
-- public.health_knowledge, but assumes the pgvector extension was already
-- enabled via the Supabase dashboard.
--
-- This migration makes the dependency explicit so that:
--   1. Fresh local/CI databases work without manual dashboard steps.
--   2. The extension is captured in the migration history for auditability.
--
-- Idempotent — safe to run on databases where pgvector is already enabled.

create extension if not exists vector with schema extensions;

-- Migration 0025: move agent tables to dedicated `agents` schema
--
-- Tables moved:
--   public.agent_conversations  → agents.agent_conversations
--   public.agent_definitions    → agents.agent_definitions
--   public.health_knowledge     → agents.health_knowledge
--
-- Tables kept in public (broader operational meaning):
--   public.support_tickets   — customer support records
--   public.appointments      — clinical scheduling
--
-- Writers, RLS policies, indexes, and triggers follow the table automatically.
-- The hybrid_search_health RPC is updated to reference the new schema path.

-- ============================================================================
-- Create schema
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS agents;

-- ============================================================================
-- Move tables
-- ============================================================================

ALTER TABLE IF EXISTS public.agent_conversations  SET SCHEMA agents;
ALTER TABLE IF EXISTS public.agent_definitions    SET SCHEMA agents;
ALTER TABLE IF EXISTS public.health_knowledge     SET SCHEMA agents;

-- ============================================================================
-- Grant usage on new schema to required roles
-- ============================================================================

GRANT USAGE ON SCHEMA agents TO postgres, anon, authenticated, service_role;
GRANT ALL   ON ALL TABLES    IN SCHEMA agents TO postgres, service_role;
GRANT SELECT ON ALL TABLES   IN SCHEMA agents TO authenticated;

-- Ensure future tables in agents schema also get these grants
ALTER DEFAULT PRIVILEGES IN SCHEMA agents
  GRANT SELECT ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA agents
  GRANT ALL ON TABLES TO service_role;

-- ============================================================================
-- Replace hybrid_search_health to reference agents.health_knowledge
-- ============================================================================

CREATE OR REPLACE FUNCTION public.hybrid_search_health(
  query_text  text,
  query_vec   vector(2560) DEFAULT NULL,
  match_count int          DEFAULT 5
)
RETURNS TABLE (id uuid, content text, category text, rank float)
LANGUAGE plpgsql
AS $$
BEGIN
  IF query_vec IS NULL THEN
    -- BM25-only path (pgvector unavailable or OpenRouter key absent)
    RETURN QUERY
      SELECT
        hk.id,
        hk.content,
        hk.category,
        ts_rank_cd(
          to_tsvector('english', hk.content),
          plainto_tsquery('english', query_text)
        )::float AS rank
      FROM agents.health_knowledge hk
      WHERE to_tsvector('english', hk.content) @@ plainto_tsquery('english', query_text)
      ORDER BY rank DESC
      LIMIT match_count;
  ELSE
    -- Hybrid RRF: semantic (HNSW) + BM25 keyword fusion
    RETURN QUERY
      WITH semantic AS (
        SELECT hk.id, ROW_NUMBER() OVER (ORDER BY hk.embedding <=> query_vec) AS rn
        FROM agents.health_knowledge hk
        WHERE hk.embedding IS NOT NULL
        ORDER BY hk.embedding <=> query_vec
        LIMIT match_count * 2
      ),
      bm25 AS (
        SELECT
          hk.id,
          ROW_NUMBER() OVER (
            ORDER BY ts_rank_cd(
              to_tsvector('english', hk.content),
              plainto_tsquery('english', query_text)
            ) DESC
          ) AS rn
        FROM agents.health_knowledge hk
        WHERE to_tsvector('english', hk.content) @@ plainto_tsquery('english', query_text)
        LIMIT match_count * 2
      ),
      fused AS (
        SELECT
          COALESCE(s.id, b.id) AS id,
          (COALESCE(1.0 / (60 + s.rn), 0.0) + COALESCE(1.0 / (60 + b.rn), 0.0)) AS score
        FROM semantic s
        FULL OUTER JOIN bm25 b ON b.id = s.id
      )
      SELECT
        hk.id,
        hk.content,
        hk.category,
        fused.score::float AS rank
      FROM fused f JOIN agents.health_knowledge hk ON hk.id = f.id
      ORDER BY fused.score DESC
      LIMIT match_count;
  END IF;
END;
$$;

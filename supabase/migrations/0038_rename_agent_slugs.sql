-- Migration 0038: rename agent slugs from human names to role-based names
--
-- atlas  → risk_analyzer      (Risk Analyzer)
-- sage   → supplement_advisor (Supplement Advisor)
-- nova   → health_researcher  (Health Researcher)
-- alex   → support            (Support)
--
-- Also fixes the CHECK constraint on public.agent_conversations.agent
-- to replace the old 'alex' value with the new 'support' value.

-- ============================================================================
-- 1. Rename agent slugs and display names in agents.agent_definitions
-- ============================================================================

DO $$
BEGIN

  -- atlas → risk_analyzer
  IF EXISTS (SELECT 1 FROM agents.agent_definitions WHERE slug = 'atlas') THEN
    UPDATE agents.agent_definitions
    SET
      slug         = 'risk_analyzer',
      display_name = 'Risk Analyzer',
      description  = 'Risk narrative pipeline — analyses patient questionnaire and uploads, produces structured risk assessment',
      updated_at   = now()
    WHERE slug = 'atlas';
  END IF;

  -- sage → supplement_advisor
  IF EXISTS (SELECT 1 FROM agents.agent_definitions WHERE slug = 'sage') THEN
    UPDATE agents.agent_definitions
    SET
      slug         = 'supplement_advisor',
      display_name = 'Supplement Advisor',
      description  = 'Supplement protocol pipeline — generates personalised supplement protocols from risk profile and uploads',
      updated_at   = now()
    WHERE slug = 'sage';
  END IF;

  -- nova → health_researcher
  IF EXISTS (SELECT 1 FROM agents.agent_definitions WHERE slug = 'nova') THEN
    UPDATE agents.agent_definitions
    SET
      slug         = 'health_researcher',
      display_name = 'Health Researcher',
      description  = 'Research digest pipeline — weekly literature scan, writes structured digests and vector chunks to knowledge base',
      updated_at   = now()
    WHERE slug = 'nova';
  END IF;

  -- alex → support (slug, display_name, description, and system_prompt first line)
  IF EXISTS (SELECT 1 FROM agents.agent_definitions WHERE slug = 'alex') THEN
    UPDATE agents.agent_definitions
    SET
      slug         = 'support',
      display_name = 'Support',
      description  = 'Customer support agent — sidecar chatbot across all signed-in pages',
      system_prompt = replace(
        system_prompt,
        'You are Alex, the customer support assistant for Longevity Coach.',
        'You are the customer support assistant for Longevity Coach.'
      ),
      updated_at   = now()
    WHERE slug = 'alex';
  END IF;

END $$;

-- ============================================================================
-- 2. Fix CHECK constraint on agents.agent_conversations.agent
--    Old: ('janet', 'pt_coach_live', 'alex')
--    New: ('janet', 'pt_coach_live', 'support')
--
-- The constraint was defined inline in migration 0014 with no explicit name,
-- so Postgres auto-generated the name: agent_conversations_agent_check.
--
-- Only run the constraint swap if 'alex' is still in the allowed values
-- (i.e. the constraint has not already been updated by a previous run).
-- ============================================================================

DO $$
DECLARE
  v_has_alex boolean;
BEGIN
  -- Check whether the old constraint (containing 'alex') is still present
  SELECT EXISTS (
    SELECT 1
    FROM   pg_constraint c
    JOIN   pg_class      t ON t.oid = c.conrelid
    JOIN   pg_namespace  n ON n.oid = t.relnamespace
    WHERE  n.nspname  = 'agents'
    AND    t.relname  = 'agent_conversations'
    AND    c.conname  = 'agent_conversations_agent_check'
    AND    pg_get_constraintdef(c.oid) LIKE '%alex%'
  ) INTO v_has_alex;

  IF v_has_alex THEN
    ALTER TABLE agents.agent_conversations
      DROP CONSTRAINT agent_conversations_agent_check;

    ALTER TABLE agents.agent_conversations
      ADD CONSTRAINT agent_conversations_agent_check
        CHECK (agent IN ('janet', 'pt_coach_live', 'support'));
  END IF;

END $$;

-- ============================================================================
-- 3. Also rename any existing conversation rows that reference 'alex'
--    so live data stays consistent with the new constraint.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM agents.agent_conversations WHERE agent = 'alex' LIMIT 1
  ) THEN
    UPDATE agents.agent_conversations
    SET    agent = 'support'
    WHERE  agent = 'alex';
  END IF;
END $$;

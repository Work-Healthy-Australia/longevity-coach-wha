-- health_updates: stores structured research digests written by Nova.
CREATE TABLE IF NOT EXISTS agents.health_updates (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id         uuid        NOT NULL,
  title          text        NOT NULL,
  content        text        NOT NULL,
  category       text        NOT NULL,
  source         text        NOT NULL,
  evidence_level text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT health_updates_category_check
    CHECK (category IN ('cv','metabolic','neuro','onco','msk','supplements')),
  CONSTRAINT health_updates_evidence_level_check
    CHECK (evidence_level IN ('strong','moderate','preliminary'))
);

ALTER TABLE agents.health_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read health_updates"
  ON agents.health_updates FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS health_updates_created_at_idx
  ON agents.health_updates (created_at DESC);

-- Nova agent definition
INSERT INTO agents.agent_definitions (slug, display_name, model, provider, system_prompt, temperature, max_tokens, enabled)
VALUES (
  'nova',
  'Nova',
  'claude-sonnet-4-6',
  'anthropic',
  E'You are Nova, a research synthesis specialist for a longevity health platform.\n\nYour job: given a set of recent scientific paper abstracts from PubMed in a specific health domain, synthesise a concise, actionable digest for health-conscious adults.\n\nRules:\n- Distinguish strong evidence (RCTs, systematic reviews, large cohorts) from preliminary findings (observational studies, small trials, animal studies).\n- Never present preliminary findings as recommendations. Label evidence level explicitly: "Strong evidence:", "Preliminary evidence:", "Expert consensus:".\n- Use plain language. No jargon without explanation.\n- Content is generic — not personalised to any individual.\n- Focus on longevity, prevention, and optimisation.\n- Always include a specific, actionable takeaway even for preliminary findings ("worth watching, not yet acting on").\n- 2–3 paragraphs per digest. Concise.',
  0.3,
  2048,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  display_name  = EXCLUDED.display_name,
  model         = EXCLUDED.model,
  system_prompt = EXCLUDED.system_prompt,
  temperature   = EXCLUDED.temperature,
  max_tokens    = EXCLUDED.max_tokens,
  enabled       = EXCLUDED.enabled,
  updated_at    = now();

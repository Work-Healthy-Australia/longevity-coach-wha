CREATE TABLE IF NOT EXISTS agents.conversation_summaries (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uuid               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent                   text        NOT NULL CHECK (agent IN ('janet', 'alex')),
  summary                 text        NOT NULL,
  last_compressed_turn_id uuid,
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT conversation_summaries_user_agent_unique UNIQUE (user_uuid, agent)
);

ALTER TABLE agents.conversation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conv_summaries_patient_select"
  ON agents.conversation_summaries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_uuid);

-- No explicit service_role policy needed — Supabase service_role bypasses RLS by default.

CREATE INDEX IF NOT EXISTS conv_summaries_user_agent_idx
  ON agents.conversation_summaries (user_uuid, agent);

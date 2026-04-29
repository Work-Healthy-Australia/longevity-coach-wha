-- Raise chef max_tokens to 16000.
-- A 7-day meal plan (21+ meals with ingredients, instructions, macros) + shopping list
-- consistently exceeds 8000 tokens, causing truncated JSON in the pipeline response.
UPDATE agents.agent_definitions
SET max_tokens = 16000, updated_at = now()
WHERE slug = 'chef';

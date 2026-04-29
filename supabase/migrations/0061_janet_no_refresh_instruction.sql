-- Strip every "refresh the page" instruction from Janet's system prompt.
-- The report and chat thread now hydrate automatically when pipelines complete,
-- so telling the patient to refresh is wrong (and erodes trust when the page
-- already contains the new data).
--
-- Idempotent: replace() is a no-op when the substring is absent.

UPDATE agents.agent_definitions
SET
  system_prompt = replace(
    replace(
      replace(
        replace(
          system_prompt,
          'should refresh the page to see it',
          'will see it appear automatically in their report'
        ),
        'refresh the page to see it',
        'will see it appear automatically in your report'
      ),
      'Refresh the page',
      'It will appear in your report automatically'
    ),
    'refresh the page',
    'wait — it will appear automatically'
  ),
  updated_at = now()
WHERE slug = 'janet'
  AND system_prompt ILIKE '%refresh the page%';

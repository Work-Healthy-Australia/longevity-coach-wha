-- Append supplement protocol behavior rules to Janet's system prompt.
-- Guard: NOT LIKE prevents double-application on re-run.
UPDATE agents.agent_definitions
SET
  system_prompt = system_prompt || E'\n\n## Supplement protocol behavior\n\n'
    || E'**Rule 1 — Auto-trigger when missing or stale (first message only):**\n'
    || E'Check your patient context supplement protocol line. If it says "not yet generated" OR contains "⚠ STALE", AND there are no prior assistant messages in the conversation history provided to you, call the `request_supplement_protocol` tool immediately at the start of your response. Do not wait for the patient to ask. Briefly acknowledge what they said, then inform them their supplement protocol is being refreshed in the background.\n\n'
    || E'**Rule 2 — Read from context when fresh:**\n'
    || E'If the supplement protocol is tagged "✓ fresh" in your context, answer ALL supplement questions directly from the protocol data in your Patient context section. Do NOT call `supplement_advisor_summary` for routine questions such as "what supplements am I on?", "why do I take X?", "what does my protocol look like?", or "summarise my supplements". Reserve `supplement_advisor_summary` only for requests that explicitly require deep analytical synthesis beyond what the protocol data in your context already shows.\n\n'
    || E'**Rule 3 — One auto-trigger per session:**\n'
    || E'Call `request_supplement_protocol` at most once per conversation for auto-refresh purposes. If it has already been triggered in this session, do not call it again. If the patient asks about their protocol while generation is still pending, inform them it is being generated and will be ready shortly.',
  updated_at = now()
WHERE slug = 'janet'
  AND system_prompt NOT LIKE '%## Supplement protocol behavior%';

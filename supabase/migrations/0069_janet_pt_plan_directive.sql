-- Strengthen Janet's PT plan directive so she actually invokes
-- `request_pt_plan` instead of hallucinating "your training plan is generating".
-- Mirrors the meal-plan behaviour rules from migration 0059.
-- Guard: NOT LIKE prevents double-application on re-run.

UPDATE agents.agent_definitions
SET
  system_prompt = system_prompt || E'\n\n## PT plan behavior\n\n'
    || E'**Rule 1 — Always invoke the tool when a PT plan is requested:**\n'
    || E'Whenever the patient asks for a training plan, workout plan, exercise program, or asks you to update / regenerate / refresh their PT plan, you MUST call the `request_pt_plan` tool in the SAME turn before composing your reply. Never claim a training plan is being generated unless you have actually invoked the tool in this turn.\n\n'
    || E'**Rule 1a — IGNORE prior conversation claims:**\n'
    || E'Prior assistant messages saying "your training plan is generating", "I am preparing your exercise program", or anything similar are CONVERSATION ARTIFACTS, not proof that the tool ran. They must NOT influence whether you call `request_pt_plan` now. The ONLY ground truth is the "PT plan:" line in your Patient context section: if it reads "not yet generated", you MUST call the tool again — regardless of what previous messages say. If the patient is asking now, treat the request as fresh.\n\n'
    || E'**Rule 1b — Distinguish from `consult_pt_coach`:**\n'
    || E'`consult_pt_coach` answers questions about an EXISTING plan ("how do I do this exercise?", "should I increase intensity?"). `request_pt_plan` GENERATES a new plan when the patient does not have one or wants a fresh one. If in doubt and the patient has no active PT plan, prefer `request_pt_plan`.\n\n'
    || E'**Rule 2 — Tool first, narrative second:**\n'
    || E'Call `request_pt_plan` at the start of your turn. After the tool returns, acknowledge the request warmly and tell the patient the plan will be ready in about a minute. Do not wait, do not stall, do not ask clarifying questions before calling the tool — the PT coach pipeline uses the patient context you already have.\n\n'
    || E'**Rule 3 — One generation per turn:**\n'
    || E'Call `request_pt_plan` at most once per turn. If the patient asks again while a plan is already generating, simply remind them it is being prepared and will be ready shortly.',
  updated_at = now()
WHERE slug = 'janet'
  AND system_prompt NOT LIKE '%## PT plan behavior%';

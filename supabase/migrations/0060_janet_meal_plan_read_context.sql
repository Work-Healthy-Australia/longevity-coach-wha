-- Tell Janet to answer meal-plan questions directly from her patient context
-- when the plan is fresh, instead of re-triggering the chef pipeline or
-- claiming the plan is still being generated.
-- Mirrors supplement Rule 2 from migration 0055.
-- Guard: NOT LIKE prevents double-application on re-run.

UPDATE agents.agent_definitions
SET
  system_prompt = system_prompt || E'\n\n## Meal plan read-from-context\n\n'
    || E'**Rule — Read directly when fresh:**\n'
    || E'When the "Meal plan:" line in your Patient context is tagged "✓ fresh", you have the FULL plan available in the "Meals by day:" and "Shopping list:" sections of your context. Answer questions like "what is breakfast on Monday?", "what should I cook tonight?", "what is on my shopping list?", or "summarise my meal plan" DIRECTLY from that data. Do NOT call `request_meal_plan` again, and do NOT tell the patient the plan is still being generated or that they need to check the dashboard — the data is right there in your context.\n\n'
    || E'Only call `request_meal_plan` when (a) the plan line says "not yet generated", (b) it carries a "⚠ STALE" tag, OR (c) the patient explicitly asks to update / regenerate / refresh the plan.',
  updated_at = now()
WHERE slug = 'janet'
  AND system_prompt NOT LIKE '%## Meal plan read-from-context%';

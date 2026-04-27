// Schema-aware hydration: drops any step or field id that isn't in the
// current questionnaire definition. Without this, a draft saved against an
// older schema would survive every save (form loads stale keys → form state
// holds them → saveDraft persists them again), violating the single-source-
// of-truth rule for derived/migrated fields.

import type { QuestionnaireDef, ResponsesByStep } from "./schema";

export function stripUnknownKeys(
  responses: ResponsesByStep,
  questionnaire: QuestionnaireDef,
): ResponsesByStep {
  const out: ResponsesByStep = {};
  for (const step of questionnaire.steps) {
    const raw = responses[step.id];
    if (!raw || typeof raw !== "object") continue;
    const valid = new Set(step.fields.map((f) => f.id));
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (valid.has(k)) cleaned[k] = v;
    }
    if (Object.keys(cleaned).length > 0) out[step.id] = cleaned;
  }
  return out;
}

import type { StepDef } from "./schema";

export function requiredMissing(
  step: StepDef,
  values: Record<string, unknown>,
): string | null {
  for (const field of step.fields) {
    if (field.optional) continue;
    const v = values[field.id];
    if (field.type === "toggle") {
      if (v !== true) return field.label;
      continue;
    }
    if (field.type === "multiselect" || field.type === "chips") {
      if (!Array.isArray(v) || v.length === 0) return field.label;
      continue;
    }
    if (v === undefined || v === null || v === "") return field.label;
  }
  return null;
}

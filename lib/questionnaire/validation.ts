import type { StepDef } from "./schema";

export function requiredMissing(
  step: StepDef,
  values: Record<string, unknown>,
): string | null {
  for (const field of step.fields) {
    const v = values[field.id];

    // Range / integer constraints apply to ANY number value (even on
    // optional fields) — once a user has entered something, it must be
    // valid. HTML5 attrs are advisory; this is the real gate.
    if (field.type === "number" && v !== undefined && v !== null && v !== "") {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) return field.label;
      if (field.min !== undefined && n < field.min) return field.label;
      if (field.max !== undefined && n > field.max) return field.label;
      if (field.step === 1 && !Number.isInteger(n)) return field.label;
    }

    // cancer_history: even on an optional field, if the member said "yes" and
    // selected "Other" they must describe it — otherwise the entry is noise.
    if (field.type === "cancer_history" && v !== undefined && v !== null) {
      const cv = v as { status?: string; entries?: Array<{ type?: string; otherText?: string }> };
      if (cv.status === "yes" && Array.isArray(cv.entries)) {
        for (const entry of cv.entries) {
          if (entry?.type === "Other" && (!entry.otherText || !entry.otherText.trim())) {
            return `${field.label} — describe "Other"`;
          }
        }
      }
    }

    if (field.optional) continue;
    if (field.type === "toggle") {
      if (v !== true) return field.label;
      continue;
    }
    if (field.type === "multiselect" || field.type === "chips") {
      if (!Array.isArray(v) || v.length === 0) return field.label;
      continue;
    }
    if (field.type === "allergy_list") {
      if (!Array.isArray(v) || v.length === 0) return field.label;
      // Required allergy_list also requires every entry to have a substance.
      for (const entry of v as Array<Record<string, unknown>>) {
        if (!entry?.substance || typeof entry.substance !== "string" || !entry.substance.trim()) {
          return field.label;
        }
      }
      continue;
    }
    if (v === undefined || v === null || v === "") return field.label;
  }
  return null;
}

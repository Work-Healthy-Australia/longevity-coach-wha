import type { PatientInput } from "@/lib/risk/types";
import type { SimulatorOverrides } from "./types";

/**
 * Returns a new PatientInput with the slider overrides applied. Pure.
 * Does not mutate the input. Slider values that are undefined leave
 * the baseline value untouched. If `biomarkers` or `biomarkers.blood_panel`
 * is missing on the input, the path is created so the override lands.
 */
export function applyOverrides(
  base: PatientInput,
  overrides: SimulatorOverrides,
): PatientInput {
  const next: PatientInput = { ...base };

  const hasBlood =
    overrides.ldl !== undefined ||
    overrides.hba1c !== undefined ||
    overrides.hsCRP !== undefined;

  if (hasBlood) {
    next.biomarkers = {
      ...(base.biomarkers ?? {}),
      blood_panel: {
        ...(base.biomarkers?.blood_panel ?? {}),
      },
    };
    if (overrides.ldl !== undefined) {
      next.biomarkers.blood_panel!.ldl = overrides.ldl;
    }
    if (overrides.hba1c !== undefined) {
      next.biomarkers.blood_panel!.hba1c = overrides.hba1c;
    }
    if (overrides.hsCRP !== undefined) {
      next.biomarkers.blood_panel!.hsCRP = overrides.hsCRP;
    }
  }

  if (overrides.weight_kg !== undefined) {
    next.demographics = {
      ...(base.demographics ?? {}),
      weight_kg: overrides.weight_kg,
    };
  }

  return next;
}

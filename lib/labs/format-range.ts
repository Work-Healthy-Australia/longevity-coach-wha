/**
 * Format a reference / optimal range for display.
 *
 * - `(null, null, _)`            → `"—"`
 * - `(min,  null, "mg/dL")`      → `"≥ {min} {unit}"`
 * - `(null, max,  "mg/dL")`      → `"≤ {max} {unit}"`
 * - `(min,  max,  "mg/dL")`      → `"{min}–{max} {unit}"` (en-dash, U+2013)
 */
export function formatRange(
  min: number | null,
  max: number | null,
  unit: string,
): string {
  if (min == null && max == null) return "—";
  if (min != null && max == null) return `≥ ${min} ${unit}`;
  if (min == null && max != null) return `≤ ${max} ${unit}`;
  return `${min}–${max} ${unit}`;
}

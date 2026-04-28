/**
 * Display labels for `lab_results.category` DB enum values.
 *
 * Mapping is explicit — never runtime-capitalise the DB string. A future schema
 * change that introduces a new category will fall through to `"Other"` via
 * `categoryLabel()`, and the test suite asserts every known key is present.
 */
export const CATEGORY_LABELS: Record<string, string> = {
  metabolic: "Metabolic",
  cardiovascular: "Cardiovascular",
  hormonal: "Hormonal",
  inflammatory: "Inflammatory",
  haematology: "Haematology",
  vitamins: "Vitamins",
  kidney: "Kidney",
  liver: "Liver",
  thyroid: "Thyroid",
  other: "Other",
};

export function categoryLabel(key: string | null): string {
  if (key == null) return "Other";
  return CATEGORY_LABELS[key] ?? "Other";
}

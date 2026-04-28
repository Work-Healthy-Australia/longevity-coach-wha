import { describe, expect, it } from "vitest";
import { groupByBiomarker, type LabRow } from "@/lib/labs/group-by-biomarker";

function row(overrides: Partial<LabRow>): LabRow {
  return {
    biomarker: "ApoB",
    category: "cardiovascular",
    created_at: "2026-01-01T00:00:00Z",
    id: "00000000-0000-0000-0000-000000000000",
    lab_provider: null,
    notes: null,
    optimal_max: null,
    optimal_min: null,
    panel_name: null,
    reference_max: null,
    reference_min: null,
    status: null,
    test_date: "2026-01-01",
    trend: null,
    unit: "mg/dL",
    upload_id: null,
    user_uuid: "00000000-0000-0000-0000-000000000001",
    value: 92,
    ...overrides,
  };
}

describe("groupByBiomarker", () => {
  it("returns empty array for empty input", () => {
    expect(groupByBiomarker([])).toEqual([]);
  });

  it("collapses three rows of one biomarker into one group with newest as latest", () => {
    const rows: LabRow[] = [
      row({ biomarker: "ApoB", test_date: "2026-01-10", value: 92 }),
      row({ biomarker: "ApoB", test_date: "2025-06-01", value: 110 }),
      row({ biomarker: "ApoB", test_date: "2025-12-01", value: 100 }),
    ];
    const result = groupByBiomarker(rows);
    expect(result).toHaveLength(1);
    expect(result[0].biomarker).toBe("ApoB");
    expect(result[0].rowCount).toBe(3);
    expect(result[0].latest.test_date).toBe("2026-01-10");
    expect(result[0].latest.value).toBe(92);
    expect(result[0].firstTestDate).toBe("2025-06-01");
  });

  it("sorts groups by category then biomarker name", () => {
    const rows: LabRow[] = [
      row({ biomarker: "HbA1c", category: "metabolic" }),
      row({ biomarker: "ApoB", category: "cardiovascular" }),
      row({ biomarker: "LDL", category: "cardiovascular" }),
    ];
    const result = groupByBiomarker(rows);
    expect(result.map((g) => g.biomarker)).toEqual(["ApoB", "LDL", "HbA1c"]);
    expect(result.map((g) => g.category)).toEqual([
      "cardiovascular",
      "cardiovascular",
      "metabolic",
    ]);
  });

  it("sorts biomarker names case-insensitively within a category", () => {
    const rows: LabRow[] = [
      row({ biomarker: "zinc", category: "vitamins" }),
      row({ biomarker: "Vitamin D", category: "vitamins" }),
      row({ biomarker: "ferritin", category: "vitamins" }),
    ];
    const result = groupByBiomarker(rows);
    expect(result.map((g) => g.biomarker)).toEqual([
      "ferritin",
      "Vitamin D",
      "zinc",
    ]);
  });
});

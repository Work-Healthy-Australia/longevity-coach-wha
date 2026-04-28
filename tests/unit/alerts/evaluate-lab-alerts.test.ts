import { describe, expect, it } from "vitest";
import { evaluateLabAlerts } from "@/lib/alerts/evaluate-lab-alerts";
import type { LabRow } from "@/lib/labs";

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
    reference_max: 100,
    reference_min: 50,
    status: null,
    test_date: "2026-01-01",
    trend: null,
    unit: "mg/dL",
    upload_id: null,
    user_uuid: "00000000-0000-0000-0000-000000000001",
    value: 75,
    ...overrides,
  };
}

describe("evaluateLabAlerts", () => {
  it("returns empty array for empty rows", () => {
    expect(evaluateLabAlerts([])).toEqual([]);
  });

  it("suppresses optimal status", () => {
    expect(evaluateLabAlerts([row({ status: "optimal" })])).toEqual([]);
  });

  it("suppresses borderline status", () => {
    expect(evaluateLabAlerts([row({ status: "borderline" })])).toEqual([]);
  });

  it("emits an attention alert for low status with the correct title/body/link", () => {
    const result = evaluateLabAlerts([
      row({
        biomarker: "Vitamin D",
        status: "low",
        value: 18,
        unit: "ng/mL",
        reference_min: 30,
        reference_max: 100,
      }),
    ]);
    expect(result).toHaveLength(1);
    const [alert] = result;
    expect(alert.alert_type).toBe("lab_out_of_range");
    expect(alert.severity).toBe("attention");
    expect(alert.source_id).toBe("Vitamin D");
    expect(alert.title).toBe("Vitamin D is below the reference range");
    expect(alert.body).toBe(
      "Your latest Vitamin D reading is 18 ng/mL (range 30–100 ng/mL). Consider a follow-up panel.",
    );
    expect(alert.link_href).toBe("/labs/Vitamin%20D");
  });

  it("ignores prior out-of-range rows when the latest is optimal", () => {
    const rows: LabRow[] = [
      row({ biomarker: "ApoB", status: "optimal", test_date: "2026-02-01" }),
      row({ biomarker: "ApoB", status: "high", test_date: "2025-12-01" }),
    ];
    expect(evaluateLabAlerts(rows)).toEqual([]);
  });

  it("emits an urgent alert for critical status with clinician guidance", () => {
    const result = evaluateLabAlerts([
      row({
        biomarker: "Potassium",
        status: "critical",
        value: 6.8,
        unit: "mmol/L",
        reference_min: 3.5,
        reference_max: 5.0,
      }),
    ]);
    expect(result).toHaveLength(1);
    const [alert] = result;
    expect(alert.severity).toBe("urgent");
    expect(alert.title).toBe("Potassium is at a critical level");
    expect(alert.body).toContain("Speak with your clinician.");
  });

  it("emits one alert per biomarker when two different biomarkers are high", () => {
    const rows: LabRow[] = [
      row({ biomarker: "ApoB", status: "high", id: "id-a" }),
      row({ biomarker: "LDL", status: "high", id: "id-b" }),
    ];
    const result = evaluateLabAlerts(rows);
    expect(result).toHaveLength(2);
    expect(new Set(result.map((a) => a.source_id))).toEqual(
      new Set(["ApoB", "LDL"]),
    );
  });

  it("uses (test_date desc, id desc) tiebreak so same-day rows produce a deterministic latest", () => {
    const rows: LabRow[] = [
      row({
        biomarker: "ApoB",
        status: "optimal",
        test_date: "2026-03-01",
        id: "00000000-0000-0000-0000-000000000001",
      }),
      row({
        biomarker: "ApoB",
        status: "high",
        test_date: "2026-03-01",
        id: "00000000-0000-0000-0000-000000000099",
      }),
    ];
    const result = evaluateLabAlerts(rows);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("ApoB is above the reference range");
  });
});

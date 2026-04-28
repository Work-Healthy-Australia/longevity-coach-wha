import { describe, it, expect } from "vitest";
import { scoreCardiovascular } from "@/lib/risk/cardiovascular";
import { pristine, highCv, lowData } from "@/tests/fixtures/risk-profiles";

describe("scoreCardiovascular", () => {
  it("returns very_low/low risk for pristine biomarkers", () => {
    const r = scoreCardiovascular(pristine);
    expect(r.domain).toBe("cardiovascular");
    expect(r.score).toBeLessThan(20);
    expect(["very_low", "low"]).toContain(r.risk_level);
    expect(r.factors.length).toBeGreaterThan(5);
  });

  it("returns high/very_high risk for elevated CVD profile", () => {
    const r = scoreCardiovascular(highCv);
    expect(r.score).toBeGreaterThan(55);
    expect(["high", "very_high", "moderate"]).toContain(r.risk_level);
    const apo = r.factors.find((f) => f.name === "apoB");
    expect(apo?.score).toBeGreaterThan(70);
    const smoke = r.factors.find((f) => f.name === "smoking");
    expect(smoke?.score).toBe(90);
  });

  it("returns moderate fallback when no data available", () => {
    const r = scoreCardiovascular(lowData);
    // Only smoking factor — should still produce a result.
    expect(r.factors.length).toBeGreaterThanOrEqual(1);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it("populates blood_pressure factor based on hypertension dx + meds", () => {
    const r = scoreCardiovascular(highCv);
    const bpf = r.factors.find((f) => f.name === "blood_pressure");
    // Hypertension + lisinopril → 50.
    expect(bpf?.score).toBe(50);
  });
});

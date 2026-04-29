import { describe, it, expect } from "vitest";
import { scoreCardiovascular, computeBpScore } from "@/lib/risk/cardiovascular";
import { pristine, highCv, lowData } from "@/tests/fixtures/risk-profiles";
import type { PatientInput } from "@/lib/risk/types";

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

  it("uses numeric SBP from demographics when provided (smoke test)", () => {
    const patient: PatientInput = {
      demographics: { systolic_bp_mmHg: 145 },
      medical_history: {},
    };
    const r = scoreCardiovascular(patient);
    const bpf = r.factors.find((f) => f.name === "blood_pressure");
    expect(bpf?.raw_value).toBe("145 mmHg");
    expect(bpf?.score).toBe(60);
  });
});

describe("computeBpScore", () => {
  it("fallback — no numeric, no HTN → 0 / normal", () => {
    expect(computeBpScore({ hasHTN: false, hasAntihyp: false })).toEqual({
      score: 0,
      rawValue: "normal",
    });
  });

  it("fallback — no numeric, HTN, no antihyp → 70 / hypertension", () => {
    expect(computeBpScore({ hasHTN: true, hasAntihyp: false })).toEqual({
      score: 70,
      rawValue: "hypertension",
    });
  });

  it("fallback — no numeric, HTN + antihyp → 50 / hypertension", () => {
    expect(computeBpScore({ hasHTN: true, hasAntihyp: true })).toEqual({
      score: 50,
      rawValue: "hypertension",
    });
  });

  it("numeric — 110 → 0 / '110 mmHg'", () => {
    expect(
      computeBpScore({ systolic_bp_mmHg: 110, hasHTN: false, hasAntihyp: false })
    ).toEqual({ score: 0, rawValue: "110 mmHg" });
  });

  it("numeric — 119 → 0 (band boundary)", () => {
    expect(
      computeBpScore({ systolic_bp_mmHg: 119, hasHTN: false, hasAntihyp: false }).score
    ).toBe(0);
  });

  it("numeric — 120 → 15 (band boundary)", () => {
    expect(
      computeBpScore({ systolic_bp_mmHg: 120, hasHTN: false, hasAntihyp: false }).score
    ).toBe(15);
  });

  it("numeric — 135 → 35 (Stage 1)", () => {
    expect(
      computeBpScore({ systolic_bp_mmHg: 135, hasHTN: false, hasAntihyp: false }).score
    ).toBe(35);
  });

  it("numeric — 145 → 60 (Stage 2)", () => {
    expect(
      computeBpScore({ systolic_bp_mmHg: 145, hasHTN: false, hasAntihyp: false }).score
    ).toBe(60);
  });

  it("numeric — 175 → 85 (Severe)", () => {
    expect(
      computeBpScore({ systolic_bp_mmHg: 175, hasHTN: false, hasAntihyp: false }).score
    ).toBe(85);
  });

  it("numeric — 195 → 100 (Crisis)", () => {
    expect(
      computeBpScore({ systolic_bp_mmHg: 195, hasHTN: false, hasAntihyp: false }).score
    ).toBe(100);
  });

  it("numeric + antihyp — 145 → 45 (60 − 15)", () => {
    expect(
      computeBpScore({ systolic_bp_mmHg: 145, hasHTN: false, hasAntihyp: true }).score
    ).toBe(45);
  });

  it("numeric + antihyp — 110 → 0 (clamped, not negative)", () => {
    expect(
      computeBpScore({ systolic_bp_mmHg: 110, hasHTN: false, hasAntihyp: true }).score
    ).toBe(0);
  });

  it("numeric overrides binary — 110 + HTN → 0 / '110 mmHg'", () => {
    expect(
      computeBpScore({ systolic_bp_mmHg: 110, hasHTN: true, hasAntihyp: false })
    ).toEqual({ score: 0, rawValue: "110 mmHg" });
  });

  it("non-finite (NaN) falls through to binary path", () => {
    expect(
      computeBpScore({
        systolic_bp_mmHg: Number("not"),
        hasHTN: true,
        hasAntihyp: false,
      }).score
    ).toBe(70);
  });

  it("non-positive (0) falls through to binary path", () => {
    expect(
      computeBpScore({ systolic_bp_mmHg: 0, hasHTN: true, hasAntihyp: false })
    ).toEqual({ score: 70, rawValue: "hypertension" });
  });

  it("negative SBP falls through to fallback (no HTN → normal)", () => {
    expect(
      computeBpScore({ systolic_bp_mmHg: -10, hasHTN: false, hasAntihyp: false })
    ).toEqual({ score: 0, rawValue: "normal" });
  });
});

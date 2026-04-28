import { describe, it, expect } from "vitest";
import { scoreMetabolic } from "@/lib/risk/metabolic";
import { pristine, metabolicSyndrome, lowData } from "@/tests/fixtures/risk-profiles";

describe("scoreMetabolic", () => {
  it("returns low/very_low for pristine metabolic biomarkers", () => {
    const r = scoreMetabolic(pristine);
    expect(r.domain).toBe("metabolic");
    expect(r.score).toBeLessThan(20);
  });

  it("flags high risk for metabolic-syndrome profile", () => {
    const r = scoreMetabolic(metabolicSyndrome);
    expect(r.score).toBeGreaterThan(50);
    const hba1c = r.factors.find((f) => f.name === "hba1c");
    expect(hba1c?.score).toBeGreaterThan(70);
    const homa = r.factors.find((f) => f.name === "HOMA_IR");
    expect(homa?.score).toBeGreaterThan(50);
  });

  it("falls back to moderate=50 when truly no data is available", () => {
    const r = scoreMetabolic({ demographics: { age: 40, sex: "male" } });
    expect(r.factors.length).toBe(0);
    expect(r.score).toBe(50);
    expect(r.risk_level).toBe("moderate");
    expect(r.data_completeness).toBe(0);
  });

  it("respects sex-specific uric_acid thresholds", () => {
    const female = scoreMetabolic({ ...metabolicSyndrome });
    const ua = female.factors.find((f) => f.name === "uric_acid");
    // 6.2 for female with low=5.0 mid=6.0 high=7.0 → 50–80 band.
    expect(ua?.score).toBeGreaterThan(45);
  });
});

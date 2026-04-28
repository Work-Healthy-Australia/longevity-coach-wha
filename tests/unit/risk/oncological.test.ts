import { describe, it, expect } from "vitest";
import { scoreOncological } from "@/lib/risk/oncological";
import { pristine, highCv, lowData } from "@/tests/fixtures/risk-profiles";
import type { PatientInput } from "@/lib/risk/types";

describe("scoreOncological", () => {
  it("scores low for pristine profile", () => {
    const r = scoreOncological(pristine);
    expect(r.score).toBeLessThan(20);
  });

  it("flags BRCA1 positive as high oncological risk", () => {
    const brca: PatientInput = {
      ...pristine,
      biomarkers: { ...pristine.biomarkers, genetic: { BRCA1: "positive" } },
    };
    const r = scoreOncological(brca);
    const f = r.factors.find((x) => x.name === "BRCA_status");
    expect(f?.score).toBe(85);
  });

  it("amplifies family-history score when high-risk type + early onset", () => {
    const fh: PatientInput = {
      ...pristine,
      family_history: {
        cancer: { first_degree: true, age_onset: 42, types: ["Ovarian"] },
      },
    };
    const r = scoreOncological(fh);
    const f = r.factors.find((x) => x.name === "family_history_cancer");
    expect(f?.score).toBe(80);
  });

  it("returns 50 fallback when truly no data is available", () => {
    const r = scoreOncological({ demographics: { age: 40, sex: "male" } });
    expect(r.factors.length).toBe(0);
    expect(r.score).toBe(50);
  });

  it("scores current smoker high in onco-smoking factor", () => {
    const r = scoreOncological(highCv);
    const smoke = r.factors.find((f) => f.name === "smoking_onco");
    expect(smoke?.score).toBe(90);
  });
});

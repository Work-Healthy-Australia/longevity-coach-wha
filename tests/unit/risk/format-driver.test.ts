import { describe, it, expect } from "vitest";
import { formatRiskDriver, cleanLegacyDriver } from "@/lib/risk/format-driver";

describe("formatRiskDriver", () => {
  it("drops the domain prefix when factor name is already domain-tagged (metabolic)", () => {
    expect(formatRiskDriver("metabolic", "BMI (metabolic)", 64)).toBe(
      "BMI (metabolic) (score 64)",
    );
  });

  it("drops the domain prefix when factor name is already domain-tagged (cancer)", () => {
    expect(formatRiskDriver("oncological", "BMI (cancer risk)", 45)).toBe(
      "BMI (cancer risk) (score 45)",
    );
  });

  it("keeps the domain prefix for plain biomarker names", () => {
    expect(formatRiskDriver("cardiovascular", "apoB", 75)).toBe(
      "cardiovascular: apoB (score 75)",
    );
  });

  it("keeps the domain prefix for hsCRP-flavoured factors that don't include the domain in parens", () => {
    expect(formatRiskDriver("neurodegenerative", "hsCRP_neuro", 40)).toBe(
      "neurodegenerative: hsCRP_neuro (score 40)",
    );
  });

  it("recognises cv abbreviations in the factor-name parens", () => {
    expect(formatRiskDriver("cardiovascular", "ldl (cv)", 55)).toBe(
      "ldl (cv) (score 55)",
    );
  });
});

describe("cleanLegacyDriver", () => {
  it("strips redundant domain prefix when factor already names the domain", () => {
    expect(cleanLegacyDriver("metabolic: BMI (metabolic) (score 64)")).toBe(
      "BMI (metabolic) (score 64)",
    );
  });

  it("strips redundant cancer prefix", () => {
    expect(cleanLegacyDriver("oncological: BMI (cancer risk) (score 45)")).toBe(
      "BMI (cancer risk) (score 45)",
    );
  });

  it("leaves plain biomarker rows untouched", () => {
    expect(cleanLegacyDriver("cardiovascular: apoB (score 75)")).toBe(
      "cardiovascular: apoB (score 75)",
    );
  });

  it("leaves rows with no leading domain prefix untouched", () => {
    expect(cleanLegacyDriver("BMI (metabolic) (score 64)")).toBe(
      "BMI (metabolic) (score 64)",
    );
  });

  it("returns input unchanged for malformed strings", () => {
    expect(cleanLegacyDriver("not a structured driver string")).toBe(
      "not a structured driver string",
    );
  });

  it("rewrites legacy BMI_onco to the new readable form", () => {
    expect(cleanLegacyDriver("oncological: BMI_onco (score 45)")).toBe(
      "BMI (cancer risk) (score 45)",
    );
  });

  it("rewrites legacy bare BMI in metabolic context", () => {
    expect(cleanLegacyDriver("metabolic: BMI (score 64)")).toBe(
      "BMI (metabolic) (score 64)",
    );
  });

  it("rewrites legacy _onco suffix factors generically", () => {
    expect(cleanLegacyDriver("oncological: hsCRP_onco (score 55)")).toBe(
      "hsCRP (cancer risk) (score 55)",
    );
    expect(cleanLegacyDriver("oncological: smoking_onco (score 80)")).toBe(
      "smoking (cancer risk) (score 80)",
    );
  });

  it("rewrites legacy _neuro suffix factors", () => {
    expect(cleanLegacyDriver("neurodegenerative: hsCRP_neuro (score 40)")).toBe(
      "hsCRP (brain health) (score 40)",
    );
    expect(cleanLegacyDriver("neurodegenerative: vitamin_D_neuro (score 50)")).toBe(
      "vitamin_D (brain health) (score 50)",
    );
  });

  it("rewrites legacy _msk suffix factors", () => {
    expect(cleanLegacyDriver("musculoskeletal: testosterone_msk (score 35)")).toBe(
      "testosterone (musculoskeletal) (score 35)",
    );
  });
});

// One-off renderer: produces /tmp/sample-report.pdf for manual review.
// Uses the same fixture as tests/unit/pdf/report-doc.test.tsx.
// Run with: pnpm exec vitest run scripts/render-sample-pdf.test.tsx
import { describe, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { writeFileSync } from "node:fs";
import {
  ReportDocument,
  type EngineOutput,
  type ReportData,
} from "@/lib/pdf/report-doc";

const engine: EngineOutput = {
  longevity_score: 78,
  longevity_label: "good",
  composite_risk: 38,
  biological_age: 47,
  chronological_age: 53,
  age_delta: -6,
  risk_level: "moderate",
  domains: {
    cardiovascular: {
      score: 42,
      risk_level: "moderate",
      top_modifiable_risks: [
        { name: "LDL cholesterol", score: 64, optimal_range: "< 2.6 mmol/L" },
        { name: "Resting heart rate", score: 51, optimal_range: "55-65 bpm" },
      ],
    },
    metabolic: {
      score: 28,
      risk_level: "low",
      top_modifiable_risks: [
        { name: "Fasting glucose", score: 32, optimal_range: "4.4-5.5" },
        { name: "Waist circumference", score: 30, optimal_range: "< 94 cm" },
      ],
    },
    neurodegenerative: {
      score: 18,
      risk_level: "very_low",
      top_modifiable_risks: [
        { name: "Sleep duration", score: 24, optimal_range: "7-9 h" },
        { name: "Cognitive activity", score: 20 },
      ],
    },
    oncological: {
      score: 55,
      risk_level: "high",
      top_modifiable_risks: [
        { name: "Alcohol", score: 60, optimal_range: "< 5 drinks/wk" },
        { name: "UV exposure", score: 50 },
      ],
    },
    musculoskeletal: {
      score: 70,
      risk_level: "very_high",
      top_modifiable_risks: [
        { name: "Grip strength", score: 72, optimal_range: "> 40 kg" },
        { name: "VO2 max", score: 68, optimal_range: "> 42" },
      ],
    },
  },
  top_risks: [
    { name: "Grip strength", domain: "musculoskeletal", score: 72, optimal_range: "> 40 kg" },
    { name: "VO2 max", domain: "musculoskeletal", score: 68, optimal_range: "> 42" },
    { name: "LDL cholesterol", domain: "cardiovascular", score: 64, optimal_range: "< 2.6 mmol/L" },
    { name: "Alcohol", domain: "oncological", score: 60, optimal_range: "< 5 drinks/wk" },
    { name: "Resting heart rate", domain: "cardiovascular", score: 51, optimal_range: "55-65 bpm" },
  ],
  data_completeness: 0.82,
  score_confidence: { level: "high", note: "Most domains have sufficient inputs." },
  trajectory_6month: {
    current_longevity_score: 78,
    projected_longevity_score: 86,
    improvements: [
      { factor: "Grip strength", current_score: 72, projected_score: 55 },
      { factor: "VO2 max", current_score: 68, projected_score: 52 },
      { factor: "LDL cholesterol", current_score: 64, projected_score: 40 },
      { factor: "Alcohol", current_score: 60, projected_score: 35 },
      { factor: "Resting heart rate", current_score: 51, projected_score: 38 },
    ],
  },
};

const data: ReportData = {
  memberName: "Jordan Smith",
  dateOfBirth: "1972-04-12",
  generatedAt: new Date().toISOString(),
  engineOutput: engine,
  supplementItems: [
    { name: "Creatine monohydrate", dose: "5 g", timing: "morning", tier: "critical" },
    { name: "Vitamin D3", dose: "4000 IU", timing: "morning with food", tier: "critical" },
    { name: "Omega-3 (EPA/DHA)", dose: "2 g", timing: "with meal", tier: "high" },
    { name: "Magnesium glycinate", dose: "400 mg", timing: "evening", tier: "high" },
    { name: "Vitamin K2-MK7", dose: "180 mcg", timing: "with D3", tier: "recommended" },
    { name: "Curcumin", dose: "500 mg", timing: "with meal", tier: "recommended" },
    { name: "CoQ10", dose: "200 mg", timing: "morning", tier: "recommended" },
    { name: "Glycine", dose: "3 g", timing: "before bed", tier: "performance" },
  ],
};

describe("Render sample PDF", () => {
  it("writes /tmp/sample-report.pdf", async () => {
    const buffer = await renderToBuffer(<ReportDocument data={data} />);
    writeFileSync("/tmp/sample-report.pdf", buffer);
    // eslint-disable-next-line no-console
    console.log(`Wrote /tmp/sample-report.pdf — ${buffer.byteLength} bytes`);
  }, 30_000);
});

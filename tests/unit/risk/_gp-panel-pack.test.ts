// Generates `docs/qa/2026-04-28-gp-panel-pack.md` — 10 representative
// scorer outputs for clinical advisory review. Run with:
//   pnpm exec vitest run tests/unit/risk/_gp-panel-pack.test.ts
import { describe, it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { scoreRisk } from "@/lib/risk";
import type { PatientInput, EngineOutput } from "@/lib/risk/types";
import {
  pristine,
  highCv,
  metabolicSyndrome,
  lowData,
  pristineWithWearable,
} from "@/tests/fixtures/risk-profiles";

// Five additional fixtures spanning the demographic + risk landscape.

const postmenopausalOsteo: PatientInput = {
  patient_id: "postmenopausalOsteo",
  demographics: { age: 64, sex: "female", height_cm: 162, weight_kg: 58 },
  family_history: {
    osteoporosis: { first_degree: true },
    cardiovascular: { first_degree: true, age_onset: 70 },
  },
  medical_history: { conditions: ["Hypothyroidism"], medications: ["levothyroxine"] },
  lifestyle: {
    smoking_status: "former",
    exercise_minutes_weekly: 90,
    exercise_type: "Cardio only",
    sleep_hours: 7,
    diet_type: "mediterranean",
    stress_level: "low",
    alcohol_units_weekly: 6,
  },
  biomarkers: {
    blood_panel: {
      apoB: 95,
      ldl: 135,
      hdl: 60,
      triglycerides: 110,
      hsCRP: 1.2,
      hba1c: 5.5,
      vitamin_D: 38,
      magnesium_rbc: 4.5,
    },
    imaging: { DEXA_t_score_spine: -2.3, DEXA_t_score_hip: -1.8 },
    hormonal: { estradiol: 18 },
  },
};

const longTermSmoker: PatientInput = {
  patient_id: "longTermSmoker",
  demographics: { age: 56, sex: "male", height_cm: 175, weight_kg: 84 },
  family_history: {
    cancer: { first_degree: true, types: ["lung", "colorectal"], age_onset: 58 },
  },
  medical_history: { conditions: [], medications: [] },
  lifestyle: {
    smoking_status: "current",
    exercise_minutes_weekly: 0,
    sleep_hours: 6,
    diet_type: "standard_western",
    stress_level: "moderate",
    alcohol_units_weekly: 14,
  },
  biomarkers: {
    blood_panel: {
      apoB: 115,
      ldl: 140,
      hdl: 42,
      triglycerides: 175,
      hsCRP: 4.2,
      hba1c: 5.8,
      neutrophil_lymphocyte_ratio: 3.2,
    },
  },
};

const apoe4Carrier: PatientInput = {
  patient_id: "apoe4Carrier",
  demographics: { age: 52, sex: "female", height_cm: 168, weight_kg: 65 },
  family_history: {
    neurodegenerative: { first_degree: true, age_onset: 68 },
  },
  medical_history: { conditions: [], medications: [] },
  lifestyle: {
    smoking_status: "never",
    exercise_minutes_weekly: 180,
    exercise_type: "Mixed cardio + weights",
    sleep_hours: 7,
    diet_type: "mediterranean",
    stress_level: "moderate",
    alcohol_units_weekly: 4,
  },
  biomarkers: {
    blood_panel: {
      apoB: 85,
      ldl: 115,
      hdl: 65,
      hsCRP: 0.8,
      homocysteine: 12,
      hba1c: 5.2,
      omega3_index: 5,
      vitamin_B12: 380,
    },
    genetic: { APOE_status: "e3/e4" },
  },
};

const familialHypercholesterolemia: PatientInput = {
  patient_id: "familialHypercholesterolemia",
  demographics: { age: 38, sex: "male", height_cm: 182, weight_kg: 78 },
  family_history: {
    cardiovascular: { first_degree: true, age_onset: 42 },
  },
  medical_history: { conditions: [], medications: [] },
  lifestyle: {
    smoking_status: "never",
    exercise_minutes_weekly: 360,
    exercise_type: "Mixed cardio + weights",
    sleep_hours: 8,
    diet_type: "vegan",
    stress_level: "low",
    alcohol_units_weekly: 2,
  },
  biomarkers: {
    blood_panel: {
      apoB: 155,
      lp_a: 85,
      ldl: 195,
      hdl: 55,
      triglycerides: 70,
      hsCRP: 0.6,
      homocysteine: 9,
      hba1c: 5.0,
    },
    imaging: { coronary_calcium_score: 0, carotid_IMT: 0.65 },
  },
  wearable_data: { vo2max_estimated: 50, hrv_rmssd: 70 },
};

const t2dOnMultipleMeds: PatientInput = {
  patient_id: "t2dOnMultipleMeds",
  demographics: { age: 61, sex: "male", height_cm: 173, weight_kg: 102 },
  family_history: {
    diabetes: { first_degree: true, multiple: true },
    cardiovascular: { first_degree: true, age_onset: 60 },
  },
  medical_history: {
    conditions: ["Type 2 diabetes", "Hypertension", "High cholesterol"],
    medications: ["metformin", "atorvastatin", "lisinopril", "empagliflozin"],
  },
  lifestyle: {
    smoking_status: "former",
    exercise_minutes_weekly: 60,
    sleep_hours: 6,
    diet_type: "standard_western",
    stress_level: "high",
    alcohol_units_weekly: 4,
  },
  biomarkers: {
    blood_panel: {
      apoB: 98,
      ldl: 105,
      hdl: 38,
      triglycerides: 195,
      hsCRP: 2.1,
      hba1c: 7.4,
      fasting_insulin: 12,
      HOMA_IR: 4.2,
      fasting_glucose: 145,
      uric_acid: 7.2,
      ALT: 48,
      GGT: 75,
    },
    imaging: { liver_fat_fraction: 14, visceral_fat_area_cm2: 158 },
  },
};

type Sample = { label: string; persona: string; profile: PatientInput };

const samples: Sample[] = [
  { label: "S1", persona: "Healthy 35yo male, full biomarker panel, no family history", profile: pristine },
  { label: "S2", persona: "Same as S1 but with wearable data (HRV, VO₂max, sleep)", profile: pristineWithWearable },
  { label: "S3", persona: "58yo male, current smoker, multiple CV risk factors, family CV history", profile: highCv },
  { label: "S4", persona: "48yo woman, pre-diabetes, central adiposity, MASLD", profile: metabolicSyndrome },
  { label: "S5", persona: "42yo woman, sparse data — only demographics + smoking status. New signup case", profile: lowData },
  { label: "S6", persona: "64yo postmenopausal woman, low DEXA T-scores, vit-D deficient, statin-naive", profile: postmenopausalOsteo },
  { label: "S7", persona: "56yo male long-term smoker, family lung+CRC cancer, pro-inflammatory state", profile: longTermSmoker },
  { label: "S8", persona: "52yo woman, APOE e4/e3 carrier, family AD, otherwise healthy", profile: apoe4Carrier },
  { label: "S9", persona: "38yo male athlete, suspected familial hypercholesterolemia (very high apoB+LDL+Lp(a))", profile: familialHypercholesterolemia },
  { label: "S10", persona: "61yo male T2D on 4 meds, central obesity, MASLD, hypertensive", profile: t2dOnMultipleMeds },
];

function fmtScore(n: number): string {
  return `${n}`;
}

function fmtFactor(f: { name: string; raw_value: number | null; score: number; optimal_range?: string | null; standard_range?: string | null }): string {
  const range = f.optimal_range ? ` (optimal ${f.optimal_range})` : "";
  return `\`${f.name}\` ${f.raw_value ?? "—"} → score ${f.score}${range}`;
}

function renderSample(s: Sample, output: EngineOutput): string {
  const dem = s.profile.demographics;
  const lines: string[] = [];
  lines.push(`## ${s.label} · ${s.persona}`);
  lines.push("");
  lines.push(`**De-identified profile:** ${dem?.sex ?? "—"}, age ${dem?.age ?? "—"}, BMI ${
    dem?.weight_kg && dem?.height_cm
      ? (dem.weight_kg / Math.pow(dem.height_cm / 100, 2)).toFixed(1)
      : "—"
  }. Smoking: ${s.profile.lifestyle?.smoking_status ?? "—"}. Exercise: ${
    s.profile.lifestyle?.exercise_minutes_weekly ?? 0
  } min/wk.`);
  if (s.profile.medical_history?.conditions?.length) {
    lines.push(`**Conditions:** ${s.profile.medical_history.conditions.join(", ")}`);
  }
  if (s.profile.medical_history?.medications?.length) {
    lines.push(`**Medications:** ${s.profile.medical_history.medications.join(", ")}`);
  }
  lines.push("");
  lines.push("### Engine output");
  lines.push("");
  const chronAge = s.profile.demographics?.age;
  const ageDelta = chronAge != null ? Math.round((chronAge - output.biological_age) * 10) / 10 : null;
  const deltaText =
    ageDelta == null
      ? ""
      : ageDelta === 0
        ? " (matches chronological)"
        : ageDelta > 0
          ? ` (${ageDelta.toFixed(1)} years younger than chronological)`
          : ` (${Math.abs(ageDelta).toFixed(1)} years older than chronological)`;
  lines.push(`- **Biological age:** ${output.biological_age}${deltaText}`);
  lines.push(`- **Composite risk:** ${fmtScore(output.composite_risk)} → \`${output.risk_level}\``);
  lines.push(`- **Longevity score:** ${output.longevity_score} (${output.longevity_label})`);
  lines.push(`- **Confidence:** \`${output.score_confidence}\``);
  lines.push(`- **Data completeness:** ${(output.data_completeness * 100).toFixed(0)}%`);
  lines.push("");
  lines.push("### Domain scores");
  lines.push("");
  lines.push("| Domain | Score | Risk | Top driver |");
  lines.push("|---|---:|---|---|");
  for (const [name, dom] of Object.entries(output.domains)) {
    const top = dom.top_modifiable_risks?.[0];
    const driver = top ? `${top.name} (${top.score})` : "—";
    lines.push(`| ${name} | ${fmtScore(dom.score)} | \`${dom.risk_level}\` | ${driver} |`);
  }
  lines.push("");
  if (output.top_risks.length > 0) {
    lines.push("### Top modifiable risks (panel-level)");
    lines.push("");
    for (let i = 0; i < Math.min(5, output.top_risks.length); i++) {
      const r = output.top_risks[i]!;
      lines.push(`${i + 1}. **${r.name}** — score ${r.score} (${r.domain})${r.optimal_range ? ` · optimal: ${r.optimal_range}` : ""}`);
    }
    lines.push("");
  }
  if (output.next_recommended_tests.length > 0) {
    lines.push("### Engine-recommended next tests");
    lines.push("");
    lines.push(output.next_recommended_tests.join("; "));
    lines.push("");
  }
  lines.push("### GP-panel notes");
  lines.push("");
  lines.push("- [ ] Bio-age estimate is clinically defensible.");
  lines.push("- [ ] Composite risk classification matches my impression.");
  lines.push("- [ ] Top modifiable risks are correctly ordered.");
  lines.push("- [ ] Confidence level is appropriately calibrated.");
  lines.push("- [ ] Recommended tests are reasonable.");
  lines.push("");
  lines.push("**Free-text feedback:**");
  lines.push("");
  lines.push("> _Reviewer to fill in._");
  lines.push("");
  lines.push("---");
  lines.push("");
  return lines.join("\n");
}

describe("GP-panel review pack", () => {
  it("writes docs/qa/2026-04-28-gp-panel-pack.md", () => {
    const path = "docs/qa/2026-04-28-gp-panel-pack.md";
    mkdirSync(dirname(path), { recursive: true });

    const head: string[] = [];
    head.push("# GP-Panel Review Pack — Deterministic Risk Engine");
    head.push("");
    head.push("**Generated:** 2026-04-28 by `tests/unit/risk/_gp-panel-pack.test.ts`");
    head.push("**Reviewers:** Clinical advisory panel");
    head.push("**Engine version:** Deterministic port of base-44 entry.ts (1,231 lines), see `lib/risk/`.");
    head.push("");
    head.push("## Purpose");
    head.push("");
    head.push("The deterministic risk engine has been ported from Base44 to TypeScript and is now wired into `submitAssessment()`. Before promoting it to a clinician-channel pilot we'd value a sanity check from the panel.");
    head.push("");
    head.push("Below are 10 representative profiles spanning the demographic and risk landscape Janet Cares is likely to encounter. For each, the engine produced biological age, composite risk, five-domain scores, top modifiable risks, and a confidence level reflecting data completeness.");
    head.push("");
    head.push("## What we'd like you to check");
    head.push("");
    head.push("1. **Bio-age plausibility** — does the gap between biological and chronological age look defensible?");
    head.push("2. **Composite risk classification** — matches your clinical impression?");
    head.push("3. **Top modifiable risks** — correct ordering?");
    head.push("4. **Confidence calibration** — does `high`/`moderate`/`low`/`insufficient` match the data shown?");
    head.push("5. **Next-test recommendations** — sensible?");
    head.push("");
    head.push("Please tick the checkboxes inline and add free-text feedback under each sample. Reply by **2026-05-12** if possible.");
    head.push("");
    head.push("## Engine method (one-paragraph summary)");
    head.push("");
    head.push("Each domain is scored 0–100 by combining ~10–20 weighted factors (e.g., apoB, hsCRP, vitamin D, sleep hours). Composite risk weights the five domains with dynamic up-weighting if any one domain is high. Biological age modifies chronological age by a weighted sum of the strongest mortality predictors (VO₂max, HRV, hsCRP, HbA1c, HOMA-IR, ApoB, visceral fat, deep sleep, sex-specific testosterone). Confidence reflects what fraction of expected factors had data.");
    head.push("");
    head.push("---");
    head.push("");

    const out: string[] = [head.join("\n")];
    for (const s of samples) {
      const output = scoreRisk(s.profile);
      out.push(renderSample(s, output));
    }

    writeFileSync(path, out.join("\n"));
    // eslint-disable-next-line no-console
    console.log(`Wrote ${path} — ${samples.length} samples`);
  }, 30_000);
});

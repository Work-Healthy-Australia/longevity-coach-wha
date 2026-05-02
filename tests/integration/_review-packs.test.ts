// @vitest-environment node
// Generates two clinical-review packs:
//   docs/qa/<DATE>-narrative-review-pack.md   (GP panel — Epic 3 gate)
//   docs/qa/<DATE>-protocol-review-pack.md    (Integrative-medicine panel — Epic 4 gate)
//
// Drives the same 10 fixtures used by the engine pack through Atlas (risk
// narrative) + Sage (supplement protocol) so reviewers see the LLM output the
// production pipelines actually emit, grounded in the deterministic engine
// baseline. No DB writes — calls the agents directly via createPipelineAgent.
//
// Costs ~$1 in Anthropic spend per run (10 patients × Atlas + Sage on Sonnet
// 4.6). Gated behind GENERATE_REVIEW_PACKS=1 to keep `pnpm test` free.
//
// Run with:
//   GENERATE_REVIEW_PACKS=1 pnpm exec vitest run tests/integration/_review-packs.test.ts

// MUST be the very first import: populates env from the main repo's .env.local
// before lib/ai/providers.ts captures ANTHROPIC_API_KEY at module-init time.
// Vitest's vi.mock hoisting reorders top-level imports, so we ALSO dynamic-
// import the AI modules inside the test body to be safe — that guarantees
// providers.ts evaluates after env is in place.
import "./_env-from-main";
import { describe, it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { scoreRisk } from "@/lib/risk";
import type { PatientInput, EngineOutput } from "@/lib/risk/types";
import { z } from "zod";
import {
  pristine,
  highCv,
  metabolicSyndrome,
  lowData,
  pristineWithWearable,
} from "@/tests/fixtures/risk-profiles";

// Five extra fixtures matching the engine pack (kept inline so this file is
// self-contained for future date-stamped re-runs).
// `lifestyle.exercise_type` is the engine-layer joined string — see
// tests/fixtures/risk-profiles.ts header for the schema-boundary note.

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
  { label: "S5", persona: "42yo woman, sparse data — only demographics + smoking status", profile: lowData },
  { label: "S6", persona: "64yo postmenopausal woman, low DEXA T-scores, vit-D borderline, statin-naive", profile: postmenopausalOsteo },
  { label: "S7", persona: "56yo male long-term smoker, family lung+CRC cancer, pro-inflammatory state", profile: longTermSmoker },
  { label: "S8", persona: "52yo woman, APOE e4/e3 carrier, family AD, otherwise healthy", profile: apoe4Carrier },
  { label: "S9", persona: "38yo male athlete, suspected familial hypercholesterolemia (very high apoB+LDL+Lp(a))", profile: familialHypercholesterolemia },
  { label: "S10", persona: "61yo male T2D on 4 meds, central obesity, MASLD, hypertensive", profile: t2dOnMultipleMeds },
];

// Use the production schema directly so any future change flows through
// here automatically. Imports from the *-schema module which has no AI/SDK
// deps, so it's safe to import statically without disturbing env-load order.
import {
  RiskNarrativeOutputSchema,
  clampAtlasOutput,
  type RiskNarrativeOutput,
} from "@/lib/ai/pipelines/risk-narrative-schema";
type AtlasOutput = RiskNarrativeOutput;

const SupplementOutputSchema = z.object({
  supplements: z.array(
    z.object({
      name: z.string(),
      form: z.string(),
      dosage: z.string(),
      timing: z.string(),
      priority: z.enum(["critical", "high", "recommended", "performance"]),
      domains: z.array(z.string()),
      rationale: z.string(),
      note: z.string().optional(),
    }),
  ),
  generated_at: z.string(),
  data_completeness_note: z.string(),
  interactions_checked: z.boolean(),
});
type SageOutput = z.infer<typeof SupplementOutputSchema>;

// Map the engine's PatientInput into a shape that resembles what Atlas/Sage
// would normally see in `responses` JSONB on health_profiles. The exact key
// names don't matter — the LLM reads it as context, the engine baseline carries
// the structured signal.
function synthesiseResponses(profile: PatientInput): Record<string, unknown> {
  return {
    medical: profile.medical_history ?? {},
    family: profile.family_history ?? {},
    lifestyle: profile.lifestyle ?? {},
    biomarkers: profile.biomarkers ?? {},
    wearable: profile.wearable_data ?? {},
  };
}

function riskSummaryFromAtlas(a: AtlasOutput): string {
  return `CV=${a.cv_risk} Metabolic=${a.metabolic_risk} Neuro=${a.neuro_risk} Onco=${a.onco_risk} MSK=${a.msk_risk} (confidence: ${a.confidence_level})`;
}

type Result = {
  sample: Sample;
  engine: EngineOutput;
  atlas: AtlasOutput;
  sage: SageOutput;
};

type AiModules = {
  createPipelineAgent: typeof import("@/lib/ai/agent-factory")["createPipelineAgent"];
  buildAtlasPrompt: typeof import("@/lib/ai/pipelines/risk-narrative")["buildAtlasPrompt"];
  buildSagePrompt: typeof import("@/lib/ai/pipelines/supplement-protocol")["buildSagePrompt"];
};

async function runOne(s: Sample, ai: AiModules): Promise<Result> {
  const engine = scoreRisk(s.profile);
  const responses = synthesiseResponses(s.profile);
  const ageYears = s.profile.demographics?.age ?? null;

  const atlasAgent = ai.createPipelineAgent("risk_analyzer");
  const atlasRaw = await atlasAgent.run(
    RiskNarrativeOutputSchema,
    ai.buildAtlasPrompt({
      ageYears,
      responses,
      uploadSummaries: [],
      engineBaseline: engine,
    }),
  );
  const atlas = clampAtlasOutput(atlasRaw);

  const sageAgent = ai.createPipelineAgent("supplement_advisor");
  const sage = await sageAgent.run(
    SupplementOutputSchema,
    ai.buildSagePrompt({
      ageYears,
      responses,
      riskSummary: riskSummaryFromAtlas(atlas),
      uploadSummaries: [],
    }),
  );

  return { sample: s, engine, atlas, sage };
}

function profileSummary(p: PatientInput): string {
  const d = p.demographics;
  const bmi = d?.weight_kg && d?.height_cm
    ? (d.weight_kg / Math.pow(d.height_cm / 100, 2)).toFixed(1)
    : "—";
  const parts = [
    `${d?.sex ?? "—"}, age ${d?.age ?? "—"}, BMI ${bmi}`,
    `Smoking: ${p.lifestyle?.smoking_status ?? "—"}`,
    `Exercise: ${p.lifestyle?.exercise_minutes_weekly ?? 0} min/wk`,
  ];
  return parts.join(". ") + ".";
}

function renderNarrativeEntry(r: Result): string {
  const { sample: s, engine, atlas } = r;
  const lines: string[] = [];
  lines.push(`## ${s.label} · ${s.persona}`);
  lines.push("");
  lines.push(`**De-identified profile:** ${profileSummary(s.profile)}`);
  if (s.profile.medical_history?.conditions?.length) {
    lines.push(`**Conditions:** ${s.profile.medical_history.conditions.join(", ")}`);
  }
  if (s.profile.medical_history?.medications?.length) {
    lines.push(`**Medications:** ${s.profile.medical_history.medications.join(", ")}`);
  }
  lines.push("");
  lines.push("### Engine baseline (deterministic anchor)");
  lines.push("");
  lines.push(`- Biological age: ${engine.biological_age} (chronological ${s.profile.demographics?.age ?? "—"})`);
  lines.push(`- Composite risk: ${engine.composite_risk} → \`${engine.risk_level}\``);
  lines.push(`- Confidence: \`${engine.score_confidence}\` · Data completeness: ${(engine.data_completeness * 100).toFixed(0)}%`);
  lines.push(`- Domain scores: CV ${engine.domains.cardiovascular.score} · Met ${engine.domains.metabolic.score} · Neuro ${engine.domains.neurodegenerative.score} · Onco ${engine.domains.oncological.score} · MSK ${engine.domains.musculoskeletal.score}`);
  lines.push("");
  lines.push("### Atlas LLM output");
  lines.push("");
  lines.push(`- **Biological age:** ${atlas.biological_age} · **Longevity score:** ${atlas.longevity_score}/100`);
  lines.push(`- **Confidence:** \`${atlas.confidence_level}\``);
  lines.push(`- **Domain scores:** CV ${atlas.cv_risk} · Met ${atlas.metabolic_risk} · Neuro ${atlas.neuro_risk} · Onco ${atlas.onco_risk} · MSK ${atlas.msk_risk}`);
  lines.push("");
  lines.push("**Narrative:**");
  lines.push("");
  lines.push("> " + atlas.narrative.replace(/\n/g, "\n> "));
  lines.push("");
  if (atlas.top_risk_drivers.length > 0) {
    lines.push("**Top risk drivers:** " + atlas.top_risk_drivers.map((d) => `\`${d}\``).join(", "));
  }
  if (atlas.top_protective_levers.length > 0) {
    lines.push("**Top protective levers:** " + atlas.top_protective_levers.map((d) => `\`${d}\``).join(", "));
  }
  if (atlas.recommended_screenings.length > 0) {
    lines.push("**Recommended screenings:** " + atlas.recommended_screenings.join("; "));
  }
  if (atlas.data_gaps.length > 0) {
    lines.push("**Data gaps flagged by Atlas:** " + atlas.data_gaps.join("; "));
  }
  lines.push("");
  lines.push("### GP-panel notes");
  lines.push("");
  lines.push("- [ ] Narrative is clinically defensible and free of overstatement.");
  lines.push("- [ ] Top risk drivers match the underlying biomarker signal.");
  lines.push("- [ ] Atlas's domain scores are consistent with the engine baseline (≤10-point deviation is OK if explained).");
  lines.push("- [ ] Confidence level is appropriately calibrated to the data shown.");
  lines.push("- [ ] Recommended screenings are sensible and proportionate.");
  lines.push("- [ ] No safety-critical statement that would require clinician oversight.");
  lines.push("");
  lines.push("**Free-text feedback:**");
  lines.push("");
  lines.push("> _Reviewer to fill in._");
  lines.push("");
  lines.push("---");
  lines.push("");
  return lines.join("\n");
}

function renderProtocolEntry(r: Result): string {
  const { sample: s, atlas, sage } = r;
  const lines: string[] = [];
  lines.push(`## ${s.label} · ${s.persona}`);
  lines.push("");
  lines.push(`**De-identified profile:** ${profileSummary(s.profile)}`);
  if (s.profile.medical_history?.conditions?.length) {
    lines.push(`**Conditions:** ${s.profile.medical_history.conditions.join(", ")}`);
  }
  if (s.profile.medical_history?.medications?.length) {
    lines.push(`**Medications:** ${s.profile.medical_history.medications.join(", ")}`);
  }
  lines.push(`**Risk profile (Atlas):** CV ${atlas.cv_risk} · Met ${atlas.metabolic_risk} · Neuro ${atlas.neuro_risk} · Onco ${atlas.onco_risk} · MSK ${atlas.msk_risk}`);
  lines.push("");
  lines.push(`### Sage protocol — ${sage.supplements.length} items`);
  lines.push("");
  lines.push(`*${sage.data_completeness_note}* · interactions_checked: \`${sage.interactions_checked}\``);
  lines.push("");
  lines.push("| # | Supplement | Form | Dosage | Timing | Priority | Domains | Rationale |");
  lines.push("|---:|---|---|---|---|---|---|---|");
  sage.supplements.forEach((sup, i) => {
    const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
    lines.push(
      `| ${i + 1} | ${cell(sup.name)} | ${cell(sup.form)} | ${cell(sup.dosage)} | ${cell(sup.timing)} | ${sup.priority} | ${sup.domains.join(", ")} | ${cell(sup.rationale)} |`,
    );
  });
  lines.push("");
  if (sage.supplements.some((s) => s.note)) {
    lines.push("**Per-item notes:**");
    sage.supplements.forEach((sup, i) => {
      if (sup.note) lines.push(`- ${i + 1}. **${sup.name}** — ${sup.note}`);
    });
    lines.push("");
  }
  lines.push("### Integrative-medicine review notes");
  lines.push("");
  lines.push("- [ ] Items are evidence-grounded (no homeopathy, no proprietary blends).");
  lines.push("- [ ] Dosages are safe for this patient's age, sex, and conditions.");
  lines.push("- [ ] No drug-supplement interactions with the patient's medication list.");
  lines.push("- [ ] Priority labels (`critical`/`high`/`recommended`/`performance`) match clinical urgency.");
  lines.push("- [ ] Rationales reference the patient's specific risk drivers, not generic claims.");
  lines.push("- [ ] Forms (e.g., methylated B12 vs cyanocobalamin) are clinically sensible.");
  lines.push("- [ ] Timing instructions are practical and account for absorption.");
  lines.push("- [ ] Total daily pill burden is reasonable for sustained adherence.");
  lines.push("");
  lines.push("**Free-text feedback:**");
  lines.push("");
  lines.push("> _Reviewer to fill in._");
  lines.push("");
  lines.push("---");
  lines.push("");
  return lines.join("\n");
}

function renderNarrativeHeader(date: string): string {
  return [
    "# GP-Panel Review Pack — Risk Narrative (Atlas)",
    "",
    `**Generated:** ${date} by \`tests/integration/_review-packs.test.ts\``,
    "**Reviewers:** Clinical advisory panel (GP)",
    "**Agent:** `risk_analyzer` (Atlas) — Claude Sonnet 4.6",
    "**Companion:** [`docs/qa/2026-04-28-gp-panel-pack.md`](./2026-04-28-gp-panel-pack.md) (engine numbers; same 10 fixtures).",
    "",
    "## Purpose",
    "",
    "The risk-narrative pipeline (`risk_analyzer`) wraps the deterministic engine in an LLM-authored explanation. Reviewers have already vetted the engine numbers; this pack asks whether **Atlas's narrative grounded in those numbers is clinically defensible** before we promote the loop to a member pilot.",
    "",
    "Each entry shows: the de-identified profile, the engine baseline (the same anchor Atlas saw), and Atlas's full output (scores, narrative, drivers, screenings, confidence).",
    "",
    "## What we'd like you to check",
    "",
    "1. **Narrative defensibility** — language is grounded in the data, free of overstatement.",
    "2. **Driver fidelity** — top risk drivers actually map to the patient's biomarker signal.",
    "3. **Engine alignment** — Atlas's scores stay within ~10 points of the engine baseline, or any deviation is explained.",
    "4. **Confidence calibration** — `low`/`moderate`/`high`/`insufficient` matches the data shown.",
    "5. **Screening proportionality** — recommended next tests are sensible for the risk profile.",
    "6. **Safety boundaries** — nothing that would require clinician oversight is stated as fact.",
    "",
    "Please tick the checkboxes inline and add free-text feedback under each sample.",
    "",
    "---",
    "",
  ].join("\n");
}

function renderProtocolHeader(date: string): string {
  return [
    "# Integrative-Medicine Review Pack — Supplement Protocol (Sage)",
    "",
    `**Generated:** ${date} by \`tests/integration/_review-packs.test.ts\``,
    "**Reviewers:** Integrative-medicine panel",
    "**Agent:** `supplement_advisor` (Sage) — Claude Sonnet 4.6",
    "**Companion:** narrative pack at `docs/qa/" + date + "-narrative-review-pack.md` (same 10 fixtures, same Atlas output Sage saw).",
    "",
    "## Purpose",
    "",
    "Sage produces a personalised 30-day supplement protocol from the patient's risk profile + questionnaire + uploaded labs. Before promoting to a member pilot we want a clinical review across 10 representative profiles spanning the demographic and risk landscape.",
    "",
    "Each entry shows: the de-identified profile, the Atlas risk signal Sage was given, and Sage's full protocol (item, form, dosage, timing, priority, domains, rationale).",
    "",
    "## What we'd like you to check",
    "",
    "1. **Evidence grounding** — every item has clinical evidence at the proposed dose.",
    "2. **Drug-supplement safety** — no interactions with the patient's medication list (statin + CoQ10, levothyroxine + calcium timing, SSRI + 5-HTP, etc.).",
    "3. **Dose appropriateness** — safe for this patient's age, sex, and renal/hepatic status.",
    "4. **Priority calibration** — `critical` / `high` / `recommended` / `performance` reflects urgency.",
    "5. **Personalisation** — rationales reference the patient's specific drivers, not generic claims.",
    "6. **Adherence realism** — total daily pill burden is sustainable for 12+ months.",
    "",
    "Please tick the checkboxes inline and add free-text feedback under each sample.",
    "",
    "---",
    "",
  ].join("\n");
}

const SHOULD_RUN = process.env.GENERATE_REVIEW_PACKS === "1";

describe.skipIf(!SHOULD_RUN)("clinical review pack generator", () => {
  it(
    "generates narrative + protocol packs for 10 fixtures",
    async () => {
      const date = new Date().toISOString().slice(0, 10);
      const narrativePath = `docs/qa/${date}-narrative-review-pack.md`;
      const protocolPath = `docs/qa/${date}-protocol-review-pack.md`;
      mkdirSync(dirname(narrativePath), { recursive: true });

      // Dynamic-import the AI modules AFTER env is loaded so providers.ts
      // captures the real ANTHROPIC_API_KEY rather than the empty string.
      const ai: AiModules = {
        createPipelineAgent: (await import("@/lib/ai/agent-factory")).createPipelineAgent,
        buildAtlasPrompt: (await import("@/lib/ai/pipelines/risk-narrative")).buildAtlasPrompt,
        buildSagePrompt: (await import("@/lib/ai/pipelines/supplement-protocol")).buildSagePrompt,
      };

      // Run all 10 fixtures concurrently — Anthropic rate limit is comfortable
      // at this scale (10 in flight × ~2 calls each = 20 simultaneous, well
      // under the per-org RPM ceiling on Sonnet 4.6).
      const results = await Promise.all(samples.map((s) => runOne(s, ai)));
      // Deterministic ordering by label so the pack is stable across re-runs.
      results.sort((a, b) => a.sample.label.localeCompare(b.sample.label, "en", { numeric: true }));

      const narrativeOut = [renderNarrativeHeader(date), ...results.map(renderNarrativeEntry)].join("\n");
      const protocolOut = [renderProtocolHeader(date), ...results.map(renderProtocolEntry)].join("\n");

      writeFileSync(narrativePath, narrativeOut);
      writeFileSync(protocolPath, protocolOut);
      // eslint-disable-next-line no-console
      console.log(`Wrote ${narrativePath} and ${protocolPath} — ${results.length} samples`);
    },
    600_000,
  );
});

import { describe, it } from 'vitest';
import { createPipelineAgent } from '@/lib/ai/agent-factory';
import { buildSagePrompt } from '@/lib/ai/pipelines/supplement-protocol';
import { judgeOutput, type JudgeRubric } from './judge';
import { writeEvalReport } from './runner';
import { SEED_PATIENT_CONTEXT } from './fixtures/patient-context.fixture';
import { z } from 'zod';

const SupplementItemSchema = z.object({
  name: z.string(),
  form: z.string(),
  dosage: z.string(),
  timing: z.string(),
  priority: z.enum(['critical', 'high', 'recommended', 'performance']),
  domains: z.array(z.string()),
  rationale: z.string(),
  note: z.string().optional(),
});

const SupplementOutputSchema = z.object({
  supplements: z.array(SupplementItemSchema).min(1).max(20),
  generated_at: z.string(),
  data_completeness_note: z.string(),
  interactions_checked: z.boolean(),
});

const RUBRICS: JudgeRubric[] = [
  {
    name: 'Rationale specificity',
    criteria:
      "Each supplement item's rationale must name a specific risk driver from the patient's profile (elevated LDL, high CV risk, HbA1c 5.9%, family history MI) rather than generic language like 'supports heart health' or 'good for metabolism'. Rationales that use patient-specific biomarker values score higher.",
    passMark: 7,
  },
  {
    name: 'Item-to-driver linkage',
    criteria:
      "At least 3 supplement items must explicitly link to cv or metabolic domain in their rationale. The output must demonstrate clear reasoning chains from patient risk drivers (elevated LDL 4.8, TG 2.3, HbA1c 5.9) to supplement selection.",
    passMark: 8,
  },
  {
    name: 'No overclaim',
    criteria:
      "No supplement rationale should use language that claims to 'cure', 'eliminate', 'proven to reverse', or guarantee outcomes. Language must be evidence-informed and hedged appropriately (e.g. 'associated with', 'may reduce', 'supports'). Even one overclaim fails this rubric.",
    passMark: 9,
  },
  {
    name: 'Tier discipline',
    criteria:
      "At least one supplement must be marked as 'critical' priority. Every supplement marked as 'critical' must have a rationale longer than 50 characters that justifies the urgency. Items marked critical without sufficient justification should reduce the score.",
    passMark: 8,
  },
];

describe('Sage eval', () => {
  it('runs Sage on seed patient data and scores 4 rubrics', async () => {
    const ctx = SEED_PATIENT_CONTEXT;

    const ageYears = ctx.profile.dateOfBirth
      ? Math.floor((Date.now() - new Date(ctx.profile.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    const riskSummary = ctx.riskScores
      ? `CV=${ctx.riskScores.cvRisk}, Metabolic=${ctx.riskScores.metabolicRisk}, Neuro=${ctx.riskScores.neuroRisk}, Onco=${ctx.riskScores.oncoRisk}, MSK=${ctx.riskScores.mskRisk}\nTop risk drivers: ${ctx.riskScores.topRiskDrivers.join(', ')}\nNarrative: ${ctx.riskScores.narrative}`
      : null;

    const uploadSummaries = ctx.uploads
      .filter((u) => u.janetSummary)
      .map((u) => `${u.originalFilename}: ${u.janetSummary}`);

    const prompt = buildSagePrompt({
      ageYears,
      responses: ctx.healthProfile?.responses ?? {},
      riskSummary,
      uploadSummaries,
    });

    const output = await createPipelineAgent('sage').run(SupplementOutputSchema, prompt);
    const serialised = JSON.stringify(output, null, 2);

    const scores = [];
    for (const rubric of RUBRICS) {
      scores.push(await judgeOutput(rubric, serialised));
    }

    writeEvalReport('sage', scores);
  }, 300_000);
});

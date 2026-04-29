import { zodSchema, type Tool } from 'ai';
import { z } from 'zod';
import { createPipelineAgent } from '@/lib/ai/agent-factory';
import type { PatientContext } from '@/lib/ai/patient-context';

const RiskAnalyzerOutputSchema = z.object({
  narrative: z.string().min(50).max(600),
  top_drivers: z.array(z.string()).max(4),
  key_action: z.string().max(200),
});

function buildRiskAnalyzerPrompt(ctx: PatientContext): string {
  const parts: string[] = [];

  const r = ctx.riskScores;
  if (r) {
    parts.push(
      `Patient risk scores (0–100, higher = worse): CV=${r.cvRisk ?? '?'}, Metabolic=${r.metabolicRisk ?? '?'}, Neuro=${r.neuroRisk ?? '?'}, Onco=${r.oncoRisk ?? '?'}, MSK=${r.mskRisk ?? '?'}`,
    );
    if (r.biologicalAge) parts.push(`Biological age: ${r.biologicalAge}`);
    if (r.topRiskDrivers.length) parts.push(`Top risk drivers: ${r.topRiskDrivers.join(', ')}`);
    if (r.topProtectiveLevers.length) parts.push(`Protective levers: ${r.topProtectiveLevers.join(', ')}`);
    if (r.confidenceLevel) parts.push(`Assessment confidence: ${r.confidenceLevel}`);
  }

  if (ctx.healthProfile?.responses && Object.keys(ctx.healthProfile.responses).length > 0) {
    parts.push(`\nQuestionnaire highlights: ${JSON.stringify(ctx.healthProfile.responses)}`);
  }

  if (ctx.uploads.length > 0) {
    const summaries = ctx.uploads
      .filter((u) => u.janetSummary)
      .map((u) => `${u.originalFilename}: ${u.janetSummary}`)
      .join('\n');
    if (summaries) parts.push(`\nPathology highlights:\n${summaries}`);
  }

  parts.push(
    '\nProvide: a 2–4 sentence plain-English narrative of the patient\'s risk profile, up to 4 specific risk drivers, and one high-impact action the patient can take now.',
  );

  return parts.join('\n');
}

export function riskAnalyzerTool(ctx: PatientContext): Tool {
  return {
    description:
      'Get a specialist risk narrative for this patient. Returns a structured 2–4 sentence interpretation of their five-domain risk scores, top drivers, and one key action. Call this when the patient asks to explain their risk results in depth or wants to understand what is driving their health risk.',
    inputSchema: zodSchema(z.object({ _context: z.string().optional() })),
    execute: async () => {
      return createPipelineAgent('risk_analyzer').run(RiskAnalyzerOutputSchema, buildRiskAnalyzerPrompt(ctx));
    },
  };
}

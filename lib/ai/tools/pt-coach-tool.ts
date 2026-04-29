import { zodSchema, type Tool } from 'ai';
import { z } from 'zod';
import { createPipelineAgent } from '@/lib/ai/agent-factory';
import type { PatientContext } from '@/lib/ai/patient-context';

const PtCoachOutputSchema = z.object({
  advice: z.string().min(50).max(600),
  exercises_referenced: z.array(z.string()).max(5),
  safety_note: z.string().optional(),
});

function buildPtCoachPrompt(ctx: PatientContext): string {
  const parts: string[] = [];

  if (ctx.riskScores) {
    parts.push(`MSK risk: ${ctx.riskScores.mskRisk ?? '?'}/100`);
    if (ctx.riskScores.topRiskDrivers.length)
      parts.push(`Risk drivers: ${ctx.riskScores.topRiskDrivers.join(', ')}`);
  }

  if (ctx.ptPlan) {
    parts.push(`\nActive PT Plan: ${ctx.ptPlan.planName ?? 'unnamed'} (from ${ctx.ptPlan.planStartDate ?? 'unknown'})`);
    if (ctx.ptPlan.notes) parts.push(`MSK considerations: ${ctx.ptPlan.notes}`);
    if (ctx.ptPlan.exercises.length > 0) {
      parts.push(`Exercises:`);
      ctx.ptPlan.exercises.slice(0, 10).forEach((ex: unknown) => {
        const e = ex as Record<string, unknown>;
        parts.push(`  Day ${e.day}: ${e.exercise} (${e.intensity} intensity)`);
      });
    }
  } else {
    parts.push('\nNo PT plan yet generated for this patient.');
  }

  parts.push(
    "\nProvide specific exercise advice grounded in this patient's PT plan. Reference specific exercises by name. Include a safety note if MSK risk is above 60.",
  );

  return parts.join('\n');
}

export function ptCoachTool(ctx: PatientContext): Tool {
  return {
    description:
      "Consult the PT Coach specialist for exercise, fitness, training, or rehabilitation advice. Returns grounded exercise recommendations based on the patient's active PT plan and MSK risk profile. Call this when the patient asks about exercise, workout routines, rehabilitation, or physical training.",
    inputSchema: zodSchema(z.object({ _context: z.string().optional() })),
    execute: async () => {
      return createPipelineAgent('pt_coach_live').run(PtCoachOutputSchema, buildPtCoachPrompt(ctx));
    },
  };
}

import { zodSchema, type Tool } from 'ai';
import { z } from 'zod';
import { createPipelineAgent } from '@/lib/ai/agent-factory';
import type { PatientContext } from '@/lib/ai/patient-context';

const SupplementAdvisorOutputSchema = z.object({
  summary: z.string().min(50).max(600),
  highlighted_items: z
    .array(
      z.object({
        name: z.string(),
        rationale: z.string(),
        linked_driver: z.string(),
      }),
    )
    .max(5),
});

function buildSupplementAdvisorPrompt(ctx: PatientContext, focus?: string): string {
  const parts: string[] = [];

  if (ctx.supplementPlan?.items.length) {
    const itemLines = ctx.supplementPlan.items
      .map(
        (item) =>
          `- ${item.name} (${item.priority}): ${item.dosage}, ${item.timing}. Domains: ${item.domains.join(', ')}. Rationale: ${item.rationale}`,
      )
      .join('\n');
    parts.push(`Patient supplement protocol:\n${itemLines}`);
  }

  if (ctx.riskScores) {
    parts.push(
      `\nPatient risk context: Top drivers: ${ctx.riskScores.topRiskDrivers.join(', ')}. CV=${ctx.riskScores.cvRisk}, Metabolic=${ctx.riskScores.metabolicRisk}`,
    );
  }

  if (focus) {
    parts.push(`\nFocus specifically on: ${focus}`);
  }

  parts.push(
    '\nProvide: a 2–3 sentence plain-English summary of the protocol rationale, and up to 5 highlighted items each with supplement name, why it was chosen, and which specific risk driver it addresses.',
  );

  return parts.join('\n');
}

export function supplementAdvisorTool(ctx: PatientContext): Tool {
  return {
    description:
      "Get a specialist explanation of this patient's supplement protocol. Returns a rationale for the top supplements linked to their specific risk drivers. Call this when the patient asks why they are taking a specific supplement, or asks for a deep-dive on their protocol.",
    inputSchema: zodSchema(
      z.object({
        focus: z
          .string()
          .optional()
          .describe('Optional: specific supplement name or domain to focus on (e.g. "omega-3", "metabolic")'),
      }),
    ),
    execute: async ({ focus }: { focus?: string }) => {
      if (!ctx.supplementPlan) {
        return { summary: 'No supplement protocol has been generated yet.', highlighted_items: [] };
      }
      return createPipelineAgent('supplement_advisor').run(SupplementAdvisorOutputSchema, buildSupplementAdvisorPrompt(ctx, focus));
    },
  };
}

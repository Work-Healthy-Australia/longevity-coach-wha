import { zodSchema, type Tool } from 'ai';
import { after } from 'next/server';
import { z } from 'zod';
import type { PatientContext } from '@/lib/ai/patient-context';
import { runPtPlanPipeline } from '@/lib/ai/pipelines/pt-plan';

export function ptPlanTool(ctx: PatientContext): Tool {
  return {
    description:
      'Request a personalised 30-day exercise / training plan. Call this when the patient asks for a workout plan, training plan, exercise program, or asks you to update / regenerate / refresh their PT plan. The plan generates in the background — Janet should respond immediately with a "generating…" message and not wait for the result.',
    inputSchema: zodSchema(z.object({ _context: z.string().optional() })),
    execute: async () => {
      const since = new Date().toISOString();
      console.log(`[pt-plan tool] invoked for user ${ctx.userId} at ${since}`);

      after(async () => {
        console.log(`[pt-plan tool] starting pipeline for user ${ctx.userId}`);
        try {
          await runPtPlanPipeline(ctx.userId);
          console.log(`[pt-plan tool] pipeline completed for user ${ctx.userId}`);
        } catch (err) {
          console.error(`[pt-plan tool] pipeline failed for user ${ctx.userId}:`, err);
        }
      });

      return {
        status: 'generating',
        since,
        message:
          "I'm generating your personalised 30-day exercise plan — it'll be ready in about a minute and will be in your report shortly.",
      };
    },
  };
}

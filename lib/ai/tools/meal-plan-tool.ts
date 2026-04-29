import { zodSchema, type Tool } from 'ai';
import { after } from 'next/server';
import { z } from 'zod';
import type { PatientContext } from '@/lib/ai/patient-context';
import { runMealPlanPipeline } from '@/lib/ai/pipelines/meal-plan';

export function mealPlanTool(ctx: PatientContext): Tool {
  return {
    description:
      'Request a personalised 7-day meal plan and shopping list. Call this when the patient asks for a meal plan, asks what to eat this week, or requests a shopping list. The plan generates in the background — Janet should respond immediately with a "generating…" message and not wait for the result.',
    inputSchema: zodSchema(z.object({ _context: z.string().optional() })),
    execute: async () => {
      // Stamp `since` BEFORE kicking the pipeline so the client polls against
      // a timestamp guaranteed to be earlier than any new last_run_at.
      const since = new Date().toISOString();
      console.log(`[meal-plan tool] invoked for user ${ctx.userId} at ${since}`);

      // Run the pipeline in the same function instance via `after()` so the
      // serverless lifecycle keeps it alive past the streamed response.
      after(async () => {
        console.log(`[meal-plan tool] starting pipeline for user ${ctx.userId}`);
        try {
          await runMealPlanPipeline(ctx.userId);
          console.log(`[meal-plan tool] pipeline completed for user ${ctx.userId}`);
        } catch (err) {
          console.error(`[meal-plan tool] pipeline failed for user ${ctx.userId}:`, err);
        }
      });

      return {
        status: 'generating',
        since,
        message:
          "I'm generating your personalised meal plan for the week — it'll be ready in about a minute and will appear in your report automatically.",
      };
    },
  };
}

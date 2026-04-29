import { zodSchema, type Tool } from 'ai';
import { z } from 'zod';
import type { PatientContext } from '@/lib/ai/patient-context';

export function mealPlanTool(ctx: PatientContext): Tool {
  return {
    description:
      'Request a personalised 7-day meal plan and shopping list. Call this when the patient asks for a meal plan, asks what to eat this week, or requests a shopping list. The plan generates in the background — Janet should respond immediately with a "generating…" message and not wait for the result.',
    inputSchema: zodSchema(z.object({ _context: z.string().optional() })),
    execute: async () => {
      const base = process.env.NEXT_PUBLIC_SITE_URL;
      const secret = process.env.PIPELINE_SECRET;

      if (base && secret) {
        // Fire-and-forget — no await
        fetch(`${base}/api/pipelines/meal-plan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-pipeline-secret': secret,
          },
          body: JSON.stringify({ userId: ctx.userId }),
        }).catch((err: unknown) => {
          console.warn('[meal-plan tool] Fire-and-forget fetch failed:', err);
        });
      }

      return {
        status: 'generating',
        message: "I'm generating your personalised meal plan for the week — it'll be ready in about a minute. Refresh the page to see your meal plan once it's done.",
      };
    },
  };
}

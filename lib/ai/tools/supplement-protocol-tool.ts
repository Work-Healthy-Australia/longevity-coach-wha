import { zodSchema, type Tool } from 'ai';
import { z } from 'zod';
import type { PatientContext } from '@/lib/ai/patient-context';

export function supplementProtocolTool(ctx: PatientContext): Tool {
  return {
    description:
      'Trigger generation of a personalised supplement protocol for this patient. Call this when the patient asks to generate, create, or update their supplement protocol, or when supplement_advisor_summary returns that no protocol exists yet. The protocol generates in the background — respond immediately with a generating message.',
    inputSchema: zodSchema(z.object({ _context: z.string().optional() })),
    execute: async () => {
      const base = process.env.NEXT_PUBLIC_SITE_URL;
      const secret = process.env.PIPELINE_SECRET;

      if (base && secret) {
        fetch(`${base}/api/pipelines/supplement-protocol`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-pipeline-secret': secret,
          },
          body: JSON.stringify({ userId: ctx.userId }),
        }).catch((err: unknown) => {
          console.warn('[supplement-protocol tool] Fire-and-forget fetch failed:', err);
        });
      }

      return {
        status: 'generating',
        message: "I'm generating your personalised supplement protocol now — it'll be ready in about a minute and will appear in your report automatically.",
      };
    },
  };
}

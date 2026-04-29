import { type UIMessage } from 'ai';
import { createStreamingAgent } from '@/lib/ai/agent-factory';
import { loadPatientContext, summariseContext, type PatientContext } from '@/lib/ai/patient-context';
import { createAdminClient } from '@/lib/supabase/admin';
import { compressConversation } from '@/lib/ai/compression';

export async function streamPtCoachTurn(userId: string, messages: UIMessage[]) {
  const ctx = await loadPatientContext(userId, { includeConversation: true, agent: 'pt_coach_live' });

  const ptSuffix = buildPtContextSuffix(ctx);

  const agent = createStreamingAgent('pt_coach_live');
  return agent.stream(messages, {
    systemSuffix: '\n\n' + summariseContext(ctx) + '\n\n' + ptSuffix,
    onFinish: async ({ text }) => {
      const admin = createAdminClient();
      const lastUserMsg = messages.findLast((m) => m.role === 'user');
      const userText = lastUserMsg?.parts?.find((p) => p.type === 'text')?.text ?? '';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const agentsDb = (admin as any).schema('agents');
      await Promise.allSettled([
        agentsDb.from('agent_conversations').insert({
          user_uuid: userId,
          agent: 'pt_coach_live',
          role: 'user',
          content: userText,
        }),
        agentsDb.from('agent_conversations').insert({
          user_uuid: userId,
          agent: 'pt_coach_live',
          role: 'assistant',
          content: text,
        }),
      ]);
      compressConversation(userId, 'pt_coach_live').catch(() => {});
    },
  });
}

function buildPtContextSuffix(ctx: PatientContext): string {
  if (!ctx.ptPlan) return 'PT plan: not yet generated.';
  const lines: string[] = [
    `## Active PT Plan`,
    `Plan: ${ctx.ptPlan.planName ?? 'unnamed'} (started ${ctx.ptPlan.planStartDate ?? 'unknown'})`,
  ];
  if (ctx.ptPlan.notes) lines.push(`MSK considerations: ${ctx.ptPlan.notes}`);
  if (ctx.ptPlan.exercises.length > 0) {
    lines.push(`Exercises (${ctx.ptPlan.exercises.length} total):`);
    const sample = ctx.ptPlan.exercises.slice(0, 5);
    sample.forEach((ex: unknown) => {
      const e = ex as Record<string, unknown>;
      lines.push(`  Day ${e.day}: ${e.exercise} — ${e.intensity} intensity`);
    });
    if (ctx.ptPlan.exercises.length > 5) lines.push(`  ...and ${ctx.ptPlan.exercises.length - 5} more exercises`);
  }
  return lines.join('\n');
}

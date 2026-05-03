import { type UIMessage } from 'ai';
import { createStreamingAgent } from '@/lib/ai/agent-factory';
import { loadPatientContext, summariseContext } from '@/lib/ai/patient-context';
import { createAdminClient } from '@/lib/supabase/admin';
import { compressConversation } from '@/lib/ai/compression';
import { riskAnalyzerTool } from '@/lib/ai/tools/risk-analyzer-tool';
import { supplementAdvisorTool } from '@/lib/ai/tools/supplement-advisor-tool';
import { ptCoachTool } from '@/lib/ai/tools/pt-coach-tool';
import { mealPlanTool } from '@/lib/ai/tools/meal-plan-tool';
import { ptPlanTool } from '@/lib/ai/tools/pt-plan-tool';
import { supplementProtocolTool } from '@/lib/ai/tools/supplement-protocol-tool';

export async function streamJanetTurn(userId: string, messages: UIMessage[]) {
  const t0 = Date.now();

  const [ctx] = await Promise.all([
    loadPatientContext(userId, { includeConversation: true, agent: 'janet' }),
  ]);

  const ctxMs = Date.now() - t0;

  const agent = createStreamingAgent('janet');
  return agent.stream(messages, {
    systemSuffix: '\n\n' + summariseContext(ctx),
    tools: {
      risk_analyzer_summary: riskAnalyzerTool(ctx),
      supplement_advisor_summary: supplementAdvisorTool(ctx),
      request_supplement_protocol: supplementProtocolTool(ctx),
      consult_pt_coach: ptCoachTool(ctx),
      request_meal_plan: mealPlanTool(ctx),
      request_pt_plan: ptPlanTool(ctx),
    },
    onFinish: async ({ text, steps }) => {
      const totalMs = Date.now() - t0;
      const toolsInvoked = (steps ?? []).flatMap((s) =>
        (s.toolCalls ?? []).map((c) => c.toolName),
      );
      console.log(JSON.stringify({
        event: 'janet_turn',
        patient_context_ms: ctxMs,
        tools_invoked: toolsInvoked,
        total_ms: totalMs,
      }));
      const admin = createAdminClient();
      const lastUserMsg = messages.findLast((m) => m.role === 'user');
      const userText = lastUserMsg?.parts?.find((p) => p.type === 'text')?.text ?? '';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const agentsDb = (admin as any).schema('agents');

      // Insert sequentially with explicit timestamps so the user message is
      // guaranteed to sort before the assistant response. Default `now()` can
      // collide at µs precision and produce undefined ordering on read.
      const userCreatedAt = new Date(t0).toISOString();
      const assistantCreatedAt = new Date(Math.max(Date.now(), t0 + 1)).toISOString();

      const { error: userInsertErr } = await agentsDb.from('agent_conversations').insert({
        user_uuid: userId,
        agent: 'janet',
        role: 'user',
        content: userText,
        created_at: userCreatedAt,
      });
      if (userInsertErr) {
        console.error('[janet] user message insert failed:', userInsertErr);
      }

      const { error: assistantInsertErr } = await agentsDb.from('agent_conversations').insert({
        user_uuid: userId,
        agent: 'janet',
        role: 'assistant',
        content: text,
        created_at: assistantCreatedAt,
      });
      if (assistantInsertErr) {
        console.error('[janet] assistant message insert failed:', assistantInsertErr);
      }

      // Non-blocking: compress older turns if window exceeded
      compressConversation(userId, 'janet').catch(() => {});
    },
  });
}

import { type UIMessage } from 'ai';
import { createStreamingAgent } from '@/lib/ai/agent-factory';
import { loadPatientContext, summariseContext } from '@/lib/ai/patient-context';
import { createAdminClient } from '@/lib/supabase/admin';

export async function streamJanetTurn(userId: string, messages: UIMessage[]) {
  const [ctx] = await Promise.all([
    loadPatientContext(userId, { includeConversation: false }),
  ]);

  const agent = createStreamingAgent('janet');
  return agent.stream(messages, {
    systemSuffix: '\n\n' + summariseContext(ctx),
    onFinish: async ({ text }) => {
      const admin = createAdminClient();
      const lastUserMsg = messages.findLast((m) => m.role === 'user');
      const userText = lastUserMsg?.parts?.find((p) => p.type === 'text')?.text ?? '';
      await Promise.allSettled([
        admin.from('agent_conversations').insert({
          user_uuid: userId,
          agent: 'janet',
          role: 'user',
          content: userText,
        }),
        admin.from('agent_conversations').insert({
          user_uuid: userId,
          agent: 'janet',
          role: 'assistant',
          content: text,
        }),
      ]);
    },
  });
}

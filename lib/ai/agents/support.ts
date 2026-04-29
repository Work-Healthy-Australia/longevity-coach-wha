import { type UIMessage } from 'ai';
import { createStreamingAgent } from '@/lib/ai/agent-factory';

export async function streamSupportTurn(messages: UIMessage[], currentPath: string) {
  const agent = createStreamingAgent('support');
  return agent.stream(messages, {
    systemSuffix: `\n\nCurrent member page: ${currentPath}`,
  });
}

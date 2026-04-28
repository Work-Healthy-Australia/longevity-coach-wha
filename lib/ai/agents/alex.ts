import { type UIMessage } from 'ai';
import { createStreamingAgent } from '@/lib/ai/agent-factory';

export async function streamAlexTurn(messages: UIMessage[], currentPath: string) {
  const agent = createStreamingAgent('alex');
  return agent.stream(messages, {
    systemSuffix: `\n\nCurrent member page: ${currentPath}`,
  });
}

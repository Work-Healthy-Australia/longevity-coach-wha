// Nova research digest pipeline — Phase 4 stub
// Populates health_knowledge via pgvector embeddings for RAG retrieval.
// Triggered by cron or admin action — never called from a user request.

import { z } from 'zod';
import { createPipelineAgent } from '@/lib/ai/agent-factory';

// Phase 4 placeholder — schema and prompt will be defined when Nova is implemented.
export const NovaOutputSchema = z.object({
  digest: z.string(),
});

export async function runNovaDigestPipeline(_userId: string): Promise<void> {
  // When implementing:
  //   const agent = createPipelineAgent('nova');
  //   await agent.run(NovaOutputSchema, buildPrompt(_userId));
  void createPipelineAgent;
  throw new Error('Nova pipeline not yet implemented (Phase 4)');
}

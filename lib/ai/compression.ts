import { generateText, Output } from 'ai';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { anthropic } from '@/lib/ai/providers';

const SummarySchema = z.object({
  summary: z.string().min(20).max(600),
});

export async function compressConversation(userId: string, agent: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentsDb = (createAdminClient() as any).schema('agents');

    const [turnsResult, summaryResult] = await Promise.all([
      agentsDb
        .from('agent_conversations')
        .select('id, role, content')
        .eq('user_uuid', userId)
        .eq('agent', agent)
        .order('created_at', { ascending: true }),
      agentsDb
        .from('conversation_summaries')
        .select('summary, last_compressed_turn_id')
        .eq('user_uuid', userId)
        .eq('agent', agent)
        .maybeSingle(),
    ]);

    const turns: Array<{ id: string; role: string; content: string }> = turnsResult.data ?? [];
    const existing = summaryResult.data as { summary: string; last_compressed_turn_id: string | null } | null;

    if (turns.length <= 20) return;

    const oldTurns = turns.slice(0, turns.length - 20);
    if (existing?.last_compressed_turn_id === oldTurns[oldTurns.length - 1].id) return;

    const priorSummaryLine = existing?.summary
      ? `Prior summary to extend: ${existing.summary}\n\n`
      : '';

    const turnLines = oldTurns
      .map((t) => `${t.role === 'user' ? 'Patient' : 'Janet'}: ${t.content}`)
      .join('\n');

    const prompt = `${priorSummaryLine}Summarise the following patient–Janet conversation history in 1–3 sentences.
Focus on: what the patient was concerned about, what Janet recommended, any follow-up agreed.
Be factual and concise. Do not invent details. Keep the summary under 300 characters.

Turns to summarise:
${turnLines}`;

    const result = await generateText({
      model: anthropic('claude-haiku-4.5'),
      temperature: 0,
      prompt,
      output: Output.object({ schema: SummarySchema }),
    });

    await agentsDb.from('conversation_summaries').upsert(
      {
        user_uuid: userId,
        agent,
        summary: result.output.summary,
        last_compressed_turn_id: oldTurns[oldTurns.length - 1].id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_uuid,agent' },
    );
  } catch (err) {
    console.error(`[Compression] failed for user ${userId}:`, err);
  }
}

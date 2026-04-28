import { openrouter } from '@/lib/ai/providers';
import { createAdminClient } from '@/lib/supabase/admin';

export async function embedText(texts: string[]): Promise<number[][]> {
  const result = await openrouter.embeddings.generate({
    requestBody: {
      model: 'perplexity/pplx-embed-v1-4b',
      input: texts,
    },
  });
  if (typeof result === 'string') throw new Error(`[RAG] Embeddings error: ${result}`);
  return result.data.map((d) => d.embedding as number[]);
}

export async function retrieveKnowledge(query: string, limit = 5): Promise<string[]> {
  const admin = createAdminClient();

  // Attempt to generate query embedding for hybrid search; fall back to BM25-only if unavailable
  let queryVec: number[] | null = null;
  try {
    const vecs = await embedText([query]);
    queryVec = vecs[0] ?? null;
  } catch {
    // OpenRouter unavailable or OPENROUTER_API_KEY absent — use BM25-only mode
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any).rpc('hybrid_search_health', {
    query_text: query,
    query_vec: queryVec,
    match_count: limit,
  });
  return (data ?? []).map((r: { content: string }) => r.content);
}

import { describe, expect, it, vi } from 'vitest';

// --- hoisted mocks ---
const mockRpc = vi.hoisted(() => vi.fn());
const mockGenerate = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: mockRpc,
  }),
}));

vi.mock('@/lib/ai/providers', () => ({
  openrouter: {
    embeddings: {
      generate: mockGenerate,
    },
  },
}));

import { retrieveKnowledge } from '@/lib/ai/rag';

describe('retrieveKnowledge', () => {
  it('returns content strings from RPC data', async () => {
    mockGenerate.mockResolvedValueOnce({
      data: [{ embedding: [0.1, 0.2] }],
    });
    mockRpc.mockResolvedValueOnce({ data: [{ content: 'A' }, { content: 'B' }] });

    const result = await retrieveKnowledge('test query');
    expect(result).toEqual(['A', 'B']);
  });

  it('returns empty array when RPC returns null', async () => {
    mockGenerate.mockResolvedValueOnce({
      data: [{ embedding: [0.1, 0.2] }],
    });
    mockRpc.mockResolvedValueOnce({ data: null });

    const result = await retrieveKnowledge('test query');
    expect(result).toEqual([]);
  });

  it('passes query_vec: null when embedText throws', async () => {
    mockGenerate.mockRejectedValueOnce(new Error('OpenRouter unavailable'));
    mockRpc.mockResolvedValueOnce({ data: [] });

    await retrieveKnowledge('test query', 3);

    expect(mockRpc).toHaveBeenCalledWith('hybrid_search_health', {
      query_text: 'test query',
      query_vec: null,
      match_count: 3,
    });
  });

  it('passes query_vec array when embedText succeeds', async () => {
    mockGenerate.mockResolvedValueOnce({
      data: [{ embedding: [0.1, 0.2] }],
    });
    mockRpc.mockResolvedValueOnce({ data: [] });

    await retrieveKnowledge('test query', 5);

    expect(mockRpc).toHaveBeenCalledWith('hybrid_search_health', {
      query_text: 'test query',
      query_vec: [0.1, 0.2],
      match_count: 5,
    });
  });
});

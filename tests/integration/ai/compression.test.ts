import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerateText, mockOutput } = vi.hoisted(() => {
  const mockGenerateText = vi.fn();
  const mockOutput = { object: vi.fn((opts: unknown) => opts) };
  return { mockGenerateText, mockOutput };
});

vi.mock('ai', () => ({
  generateText: mockGenerateText,
  Output: mockOutput,
}));

vi.mock('@/lib/ai/providers', () => ({
  anthropic: vi.fn(() => ({ modelId: 'claude-haiku-4.5' })),
}));

// Build 25 turns for the integration scenario
function make25Turns() {
  return Array.from({ length: 25 }, (_, i) => ({
    id: `turn-${String(i + 1).padStart(3, '0')}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Message ${i + 1}`,
  }));
}

const turns25 = make25Turns();

const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockSchema = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ schema: mockSchema }),
}));

import { compressConversation } from '@/lib/ai/compression';

beforeEach(() => {
  vi.clearAllMocks();

  mockGenerateText.mockResolvedValue({ output: { summary: 'Integration: patient asked about CV risk.' } });

  mockSchema.mockReturnValue({
    from: (table: string) => {
      if (table === 'agent_conversations') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: turns25, error: null }),
        };
      }
      if (table === 'conversation_summaries') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          upsert: mockUpsert,
        };
      }
      return {};
    },
  });
});

describe('compressConversation integration — 25 turns', () => {
  it('calls LLM with turns 1-5 (the 25-20=5 old turns)', async () => {
    await compressConversation('user-integration', 'janet');

    expect(mockGenerateText).toHaveBeenCalledOnce();
    const { prompt } = mockGenerateText.mock.calls[0][0];

    // Old turns 1-5 must appear
    for (let i = 1; i <= 5; i++) {
      expect(prompt).toContain(`Message ${i}`);
    }
    // Recent window turns 6-25 must NOT appear
    expect(prompt).not.toContain('Message 6');
    expect(prompt).not.toContain('Message 25');
  });

  it('upserts with last_compressed_turn_id equal to turn-5 (last old turn)', async () => {
    await compressConversation('user-integration', 'janet');

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        last_compressed_turn_id: 'turn-005',
      }),
      { onConflict: 'user_uuid,agent' },
    );
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- hoisted mocks ---
const { mockGenerateText, mockOutput } = vi.hoisted(() => {
  const mockGenerateText = vi.fn();
  const mockOutput = { object: vi.fn((opts: unknown) => opts) };
  return { mockGenerateText, mockOutput };
});

vi.mock('ai', () => ({
  generateText: mockGenerateText,
  Output: mockOutput,
}));

const { mockAnthropic } = vi.hoisted(() => {
  const mockAnthropic = vi.fn(() => ({ modelId: 'claude-haiku-4.5' }));
  return { mockAnthropic };
});

vi.mock('@/lib/ai/providers', () => ({ anthropic: mockAnthropic }));

// Supabase chain mock
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();
const mockSchema = vi.fn();
const mockAdminClient = { schema: mockSchema };

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockAdminClient,
}));

import { compressConversation } from '@/lib/ai/compression';

function makeTurns(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `turn-${i + 1}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Message ${i + 1}`,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();

  mockSchema.mockReturnValue({ from: mockFrom });
  mockFrom.mockImplementation((table: string) => {
    if (table === 'agent_conversations') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: makeTurns(25), error: null }),
      };
    }
    if (table === 'conversation_summaries') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: () => mockMaybeSingle(),
        upsert: mockUpsert,
      };
    }
    return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null }) };
  });

  mockMaybeSingle.mockResolvedValue({ data: null });
  mockGenerateText.mockResolvedValue({ output: { summary: 'Patient discussed CV risk and LDL levels with Janet.' } });
});

describe('compressConversation', () => {
  it('returns early without LLM call when total turns <= 20', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'agent_conversations') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: makeTurns(20), error: null }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null }) };
    });

    await compressConversation('user-1', 'janet');

    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('returns early without LLM call when summary is already current', async () => {
    const turns = makeTurns(25);
    // last_compressed_turn_id matches the 5th turn (index 4), which is the last "old" turn
    mockMaybeSingle.mockResolvedValue({
      data: { summary: 'Prior summary text.', last_compressed_turn_id: 'turn-5' },
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'agent_conversations') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: turns, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: () => mockMaybeSingle(),
        upsert: mockUpsert,
      };
    });

    await compressConversation('user-1', 'janet');

    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('calls LLM with old turns concatenated when compression is needed', async () => {
    await compressConversation('user-1', 'janet');

    expect(mockGenerateText).toHaveBeenCalledOnce();
    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs.temperature).toBe(0);
    // Prompt should contain the first 5 turns (25 - 20 = 5 old turns)
    expect(callArgs.prompt).toContain('Message 1');
    expect(callArgs.prompt).toContain('Message 5');
    // Should NOT contain turn 6+ (those are in the recent window)
    expect(callArgs.prompt).not.toContain('Message 6');
  });

  it('includes prior summary in prompt when one exists', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { summary: 'Prior: patient asked about omega-3.', last_compressed_turn_id: 'old-id' },
    });

    await compressConversation('user-1', 'janet');

    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs.prompt).toContain('Prior: patient asked about omega-3.');
  });

  it('upserts summary with correct last_compressed_turn_id', async () => {
    await compressConversation('user-1', 'janet');

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_uuid: 'user-1',
        agent: 'janet',
        summary: 'Patient discussed CV risk and LDL levels with Janet.',
        last_compressed_turn_id: 'turn-5',
      }),
      { onConflict: 'user_uuid,agent' },
    );
  });

  it('swallows errors without throwing', async () => {
    mockGenerateText.mockRejectedValue(new Error('LLM timeout'));

    await expect(compressConversation('user-1', 'janet')).resolves.toBeUndefined();
  });
});

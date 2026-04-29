import { describe, it, expect } from 'vitest';
import { costCents, normaliseModelId, pricingFor } from '@/lib/ai/pricing';

describe('normaliseModelId', () => {
  it('strips anthropic/ prefix', () => {
    expect(normaliseModelId('anthropic/claude-sonnet-4-6')).toBe('claude-sonnet-4-6');
  });
  it('strips openrouter/anthropic/ prefix', () => {
    expect(normaliseModelId('openrouter/anthropic/claude-opus-4-7')).toBe('claude-opus-4-7');
  });
  it('strips [1m] context suffix', () => {
    expect(normaliseModelId('claude-opus-4-7[1m]')).toBe('claude-opus-4-7');
  });
});

describe('pricingFor', () => {
  it('returns Sonnet pricing as the default for unknown models', () => {
    expect(pricingFor('not-a-real-model')).toEqual(pricingFor('claude-sonnet-4-6'));
  });
  it('returns distinct rates for opus vs haiku', () => {
    expect(pricingFor('claude-opus-4-7').inputPerMillion).toBeGreaterThan(
      pricingFor('claude-haiku-4-5').inputPerMillion,
    );
  });
});

describe('costCents', () => {
  it('rounds up to the nearest cent', () => {
    // Sonnet input rate $3/M → 1000 input tokens = $0.003 → 1 cent (ceil)
    expect(costCents('claude-sonnet-4-6', { inputTokens: 1000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBe(1);
  });

  it('charges separately for input, output, cache_read, cache_write', () => {
    // Sonnet: in=$3/M, out=$15/M, cacheR=$0.30/M, cacheW=$3.75/M
    // 1M of each: 3 + 15 + 0.30 + 3.75 = $22.05 → 2205 cents
    const cents = costCents('claude-sonnet-4-6', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
    });
    expect(cents).toBe(2205);
  });

  it('returns 0 cents for an all-zero usage record', () => {
    expect(costCents('claude-opus-4-7', { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBe(0);
  });

  it('opus output costs 5× more per token than input', () => {
    const inputOnly = costCents('claude-opus-4-7', { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
    const outputOnly = costCents('claude-opus-4-7', { inputTokens: 0, outputTokens: 1_000_000, cacheReadTokens: 0, cacheWriteTokens: 0 });
    expect(outputOnly).toBe(inputOnly * 5);
  });
});

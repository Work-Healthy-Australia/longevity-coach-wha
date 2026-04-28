import { describe, it, expect } from 'vitest';
import { chunkText } from '@/lib/ai/pipelines/nova';

describe('chunkText', () => {
  it('returns empty array for empty string', () => {
    expect(chunkText('')).toEqual([]);
  });

  it('returns single chunk for text shorter than chunkWords', () => {
    const text = 'hello world foo bar';
    const result = chunkText(text, 300, 60);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(text);
  });

  it('produces chunks where each chunk has at most chunkWords words', () => {
    const words = Array.from({ length: 1000 }, (_, i) => `word${i}`);
    const text = words.join(' ');
    const chunks = chunkText(text, 300, 60);
    for (const chunk of chunks) {
      expect(chunk.split(' ').length).toBeLessThanOrEqual(300);
    }
  });

  it('produces overlapping chunks', () => {
    const words = Array.from({ length: 700 }, (_, i) => `w${i}`);
    const text = words.join(' ');
    const [chunk1, chunk2] = chunkText(text, 300, 60);
    const end1 = chunk1!.split(' ').slice(-60);
    const start2 = chunk2!.split(' ').slice(0, 60);
    expect(end1).toEqual(start2);
  });

  it('covers all words — no content dropped', () => {
    const words = Array.from({ length: 850 }, (_, i) => `w${i}`);
    const text = words.join(' ');
    const chunks = chunkText(text, 300, 60);
    // Last chunk must contain the last word
    const lastChunk = chunks[chunks.length - 1]!;
    expect(lastChunk).toContain(`w849`);
  });
});

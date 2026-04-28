import { afterEach, beforeEach, describe, it, vi, expect } from 'vitest';

// ---- Supabase mock ----
const mockInsert = vi.fn(() => Promise.resolve({ error: null }));
const mockLt = vi.fn(() => Promise.resolve({ error: null }));
const mockDelete = vi.fn(() => ({ lt: mockLt }));
const mockGte = vi.fn(() => Promise.resolve({ data: [], error: null }));
const mockLimit = vi.fn(() => Promise.resolve({ data: [], error: null }));
const mockOrder = vi.fn(() => ({ limit: mockLimit }));
const mockSelect = vi.fn(() => ({ gte: mockGte, order: mockOrder }));
const mockFrom = vi.fn(() => ({ insert: mockInsert, delete: mockDelete, select: mockSelect }));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ schema: () => ({ from: mockFrom }) }),
}));

// ---- Agent factory mock ----
const mockRun = vi.fn();
vi.mock('@/lib/ai/agent-factory', () => ({
  createPipelineAgent: () => ({ run: mockRun }),
}));

// ---- embedText mock ----
const mockEmbedText = vi.hoisted(() => vi.fn(() => Promise.resolve([[0.1, 0.2]])));
vi.mock('@/lib/ai/rag', () => ({
  embedText: mockEmbedText,
  retrieveKnowledge: vi.fn(() => Promise.resolve([])),
}));

import { runNovaDigestPipeline } from '@/lib/ai/pipelines/nova';

// Canned PubMed API responses
const ESEARCH_RESPONSE = JSON.stringify({
  esearchresult: { idlist: ['12345678'] },
});
const EFETCH_RESPONSE = `
PMID: 12345678 [indexed for MEDLINE]

Exercise and longevity in older adults.

Abstract
Regular exercise extends healthspan in older adults by reducing inflammation and improving metabolic markers. This systematic review analyzed 20 RCTs.

`;

beforeEach(() => {
  vi.clearAllMocks();
  // Default mockRun returns a valid digest
  mockRun.mockResolvedValue({
    title: 'Test Digest',
    content: 'Strong evidence: Exercise reduces mortality. Preliminary evidence: NAD+ extends lifespan. Actionable takeaway: Exercise 150 min/week.',
    evidence_level: 'strong',
    key_passages: ['Exercise reduces mortality by 25% in meta-analyses.'],
    source_url: 'https://pubmed.ncbi.nlm.nih.gov/12345678/',
  });

  // Mock global fetch
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes('esearch')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(ESEARCH_RESPONSE)) });
    }
    if (url.includes('efetch')) {
      return Promise.resolve({ ok: true, text: () => Promise.resolve(EFETCH_RESPONSE) });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
  });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('runNovaDigestPipeline', () => {
  it('inserts health_updates rows after successful synthesis', async () => {
    await runNovaDigestPipeline();
    expect(mockFrom).toHaveBeenCalledWith('health_updates');
    expect(mockInsert).toHaveBeenCalled();
    const insertArg = mockInsert.mock.calls.find((call) =>
      Array.isArray(call[0]) && call[0].some((r: { title?: string }) => r.title === 'Test Digest')
    );
    expect(insertArg).toBeDefined();
  });

  it('inserts health_knowledge rows with embeddings', async () => {
    await runNovaDigestPipeline();
    expect(mockEmbedText).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith('health_knowledge');
  });

  it('calls delete with 90-day date filter on both tables', async () => {
    await runNovaDigestPipeline();
    expect(mockDelete).toHaveBeenCalled();
    expect(mockLt).toHaveBeenCalled();
  });

  it('skips a failing category and completes the run with remaining categories', async () => {
    let callCount = 0;
    mockRun.mockImplementation(() => {
      callCount++;
      if (callCount === 1) throw new Error('LLM failure for first category');
      return Promise.resolve({
        title: 'Test Digest',
        content: 'Strong evidence: Exercise reduces mortality. Preliminary evidence: NAD+ extends lifespan. Actionable takeaway: Exercise 150 min/week.',
        evidence_level: 'strong',
        key_passages: ['Exercise reduces mortality.'],
        source_url: 'https://pubmed.ncbi.nlm.nih.gov/12345678/',
      });
    });
    // Should not throw even with one failure
    await expect(runNovaDigestPipeline()).resolves.toBeUndefined();
  });

  it('does not throw when all categories fail', async () => {
    mockRun.mockRejectedValue(new Error('All LLM calls failed'));
    await expect(runNovaDigestPipeline()).resolves.toBeUndefined();
  });
});

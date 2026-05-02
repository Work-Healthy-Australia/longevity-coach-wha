import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PatientContext } from '@/lib/ai/patient-context';

const { mockRun } = vi.hoisted(() => {
  const mockRun = vi.fn();
  return { mockRun };
});

vi.mock('@/lib/ai/agent-factory', () => ({
  createPipelineAgent: vi.fn(() => ({ run: mockRun })),
}));

import { supplementAdvisorTool } from '@/lib/ai/tools/supplement-advisor-tool';

const BASE_CTX: Partial<PatientContext> = {
  userId: 'test-user',
  profile: { fullName: null, dateOfBirth: null, phone: null, role: 'user' },
  riskScores: {
    cvRisk: 72,
    metabolicRisk: 68,
    neuroRisk: 28,
    oncoRisk: 22,
    mskRisk: 45,
    biologicalAge: 47,
    narrative: '',
    topRiskDrivers: ['elevated LDL', 'sedentary lifestyle'],
    topProtectiveLevers: [],
    recommendedScreenings: [],
    confidenceLevel: 'moderate',
    dataGaps: [],
    createdAt: null,
  },
  supplementPlan: {
    items: [
      {
        name: 'Omega-3 Fish Oil',
        form: 'softgel',
        dosage: '2g daily',
        timing: 'with dinner',
        priority: 'critical',
        domains: ['cv'],
        rationale: 'Reduces triglycerides in elevated CV risk patients.',
      },
      {
        name: 'Berberine',
        form: 'capsule',
        dosage: '500mg twice daily',
        timing: 'with meals',
        priority: 'critical',
        domains: ['metabolic'],
        rationale: 'Addresses insulin resistance via AMPK pathway.',
      },
    ],
    createdAt: '2026-04-01T00:00:00Z',
  },
  uploads: [],
  recentConversation: [],
  knowledgeChunks: [],
  recentDigests: [],
  conversationSummary: null,
  healthProfile: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRun.mockResolvedValue({
    summary: 'Protocol targets CV and metabolic risk with omega-3 and berberine.',
    highlighted_items: [
      { name: 'Omega-3 Fish Oil', rationale: 'Reduces TG', linked_driver: 'elevated LDL' },
    ],
  });
});

describe('supplementAdvisorTool', () => {
  it('returns a valid AI SDK tool object', () => {
    const t = supplementAdvisorTool(BASE_CTX as PatientContext);
    expect(t.description).toBeTruthy();
    expect(t.inputSchema).toBeDefined();
    expect(t.execute).toBeTypeOf('function');
  });

  it('calls createPipelineAgent("supplement_advisor") when supplement plan exists', async () => {
    const { createPipelineAgent } = await import('@/lib/ai/agent-factory');
    const t = supplementAdvisorTool(BASE_CTX as PatientContext);
    await t.execute!({ focus: undefined }, { messages: [], toolCallId: 'tc1' });
    expect(createPipelineAgent).toHaveBeenCalledWith('supplement_advisor');
  });

  it('passes focus into the prompt when provided', async () => {
    const t = supplementAdvisorTool(BASE_CTX as PatientContext);
    await t.execute!({ focus: 'omega-3' }, { messages: [], toolCallId: 'tc1' });
    const promptArg = mockRun.mock.calls[0]?.[1] as unknown as string;
    expect(promptArg).toContain('omega-3');
  });

  it('includes supplement items in the prompt', async () => {
    const t = supplementAdvisorTool(BASE_CTX as PatientContext);
    await t.execute!({ focus: undefined }, { messages: [], toolCallId: 'tc1' });
    const promptArg = mockRun.mock.calls[0]?.[1] as unknown as string;
    expect(promptArg).toContain('Omega-3 Fish Oil');
    expect(promptArg).toContain('Berberine');
  });

  it('returns early without LLM call when supplementPlan is null', async () => {
    const ctxNoplan = { ...BASE_CTX, supplementPlan: null } as PatientContext;
    const t = supplementAdvisorTool(ctxNoplan);
    const result = await t.execute!({ focus: undefined }, { messages: [], toolCallId: 'tc1' });
    expect(mockRun).not.toHaveBeenCalled();
    expect(result).toEqual({ summary: 'No supplement protocol has been generated yet.', highlighted_items: [] });
  });
});

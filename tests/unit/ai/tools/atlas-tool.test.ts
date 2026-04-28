import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PatientContext } from '@/lib/ai/patient-context';

const { mockRun } = vi.hoisted(() => {
  const mockRun = vi.fn();
  return { mockRun };
});

vi.mock('@/lib/ai/agent-factory', () => ({
  createPipelineAgent: vi.fn(() => ({ run: mockRun })),
}));

import { atlasRiskSummaryTool } from '@/lib/ai/tools/atlas-tool';

const SEED_CTX: Pick<PatientContext, 'riskScores' | 'healthProfile' | 'uploads' | 'supplementPlan' | 'recentConversation' | 'knowledgeChunks' | 'recentDigests' | 'conversationSummary' | 'userId' | 'profile'> = {
  userId: 'test-user',
  profile: { fullName: null, dateOfBirth: '1984-03-15', phone: null, role: 'user' },
  riskScores: {
    cvRisk: 72,
    metabolicRisk: 68,
    neuroRisk: 28,
    oncoRisk: 22,
    mskRisk: 45,
    biologicalAge: 47,
    narrative: 'Elevated CV and metabolic risk.',
    topRiskDrivers: ['elevated LDL', 'sedentary lifestyle', 'family history MI'],
    topProtectiveLevers: ['non-smoker'],
    recommendedScreenings: [],
    confidenceLevel: 'moderate',
    dataGaps: [],
    createdAt: null,
  },
  healthProfile: { responses: { exercise: '1_per_week' }, completedAt: null },
  uploads: [
    {
      id: 'u1',
      originalFilename: 'blood-panel.pdf',
      janetCategory: 'pathology',
      janetSummary: 'LDL 4.8, HDL 1.1',
      janetFindings: null,
      createdAt: '2026-04-01T00:00:00Z',
    },
  ],
  supplementPlan: null,
  recentConversation: [],
  knowledgeChunks: [],
  recentDigests: [],
  conversationSummary: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRun.mockResolvedValue({
    narrative: 'Patient has elevated CV risk driven by LDL and family history.',
    top_drivers: ['elevated LDL', 'sedentary lifestyle'],
    key_action: 'Increase aerobic exercise to 150 min/week.',
  });
});

describe('atlasRiskSummaryTool', () => {
  it('returns a valid AI SDK tool object with description and parameters', () => {
    const t = atlasRiskSummaryTool(SEED_CTX as PatientContext);
    expect(t.description).toBeTruthy();
    expect(t.inputSchema).toBeDefined();
    expect(t.execute).toBeTypeOf('function');
  });

  it('calls createPipelineAgent("atlas") when executed', async () => {
    const { createPipelineAgent } = await import('@/lib/ai/agent-factory');
    const t = atlasRiskSummaryTool(SEED_CTX as PatientContext);
    await t.execute({}, { messages: [], toolCallId: 'tc1' });
    expect(createPipelineAgent).toHaveBeenCalledWith('atlas');
  });

  it('includes risk scores in the prompt passed to atlas', async () => {
    const t = atlasRiskSummaryTool(SEED_CTX as PatientContext);
    await t.execute({}, { messages: [], toolCallId: 'tc1' });
    const promptArg = mockRun.mock.calls[0][1] as string;
    expect(promptArg).toContain('CV=72');
    expect(promptArg).toContain('elevated LDL');
  });

  it('includes pathology summary in the prompt', async () => {
    const t = atlasRiskSummaryTool(SEED_CTX as PatientContext);
    await t.execute({}, { messages: [], toolCallId: 'tc1' });
    const promptArg = mockRun.mock.calls[0][1] as string;
    expect(promptArg).toContain('LDL 4.8');
  });

  it('does not call createAdminClient (no DB writes)', async () => {
    const adminMock = vi.fn();
    vi.doMock('@/lib/supabase/admin', () => ({ createAdminClient: adminMock }));
    const t = atlasRiskSummaryTool(SEED_CTX as PatientContext);
    await t.execute({}, { messages: [], toolCallId: 'tc1' });
    expect(adminMock).not.toHaveBeenCalled();
  });
});

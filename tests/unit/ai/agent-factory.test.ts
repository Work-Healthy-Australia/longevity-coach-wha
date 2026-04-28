import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- hoisted mocks ---
const { mockLoadAgentDef, mockGetAnthropicModel, mockModel } = vi.hoisted(() => {
  const mockModel = { modelId: 'claude-sonnet-4-6' };
  const mockLoadAgentDef = vi.fn();
  const mockGetAnthropicModel = vi.fn(() => mockModel);
  return { mockLoadAgentDef, mockGetAnthropicModel, mockModel };
});

vi.mock('@/lib/ai/loader', () => ({
  loadAgentDef: mockLoadAgentDef,
  getAnthropicModel: mockGetAnthropicModel,
}));

const { mockStreamText, mockGenerateText, mockConvertToModelMessages, mockOutput } = vi.hoisted(() => {
  const mockStreamText = vi.fn();
  const mockGenerateText = vi.fn();
  const mockConvertToModelMessages = vi.fn(async (msgs: unknown) => msgs);
  const mockOutput = { object: vi.fn((opts: unknown) => opts) };
  return { mockStreamText, mockGenerateText, mockConvertToModelMessages, mockOutput };
});

vi.mock('ai', () => ({
  streamText: mockStreamText,
  generateText: mockGenerateText,
  convertToModelMessages: mockConvertToModelMessages,
  Output: mockOutput,
}));

// --- import after mocks ---
import { createStreamingAgent, createPipelineAgent } from '@/lib/ai/agent-factory';
import type { UIMessage } from 'ai';
import { z } from 'zod';

// --- helpers ---
const makeDef = (overrides = {}) => ({
  id: 'def-1',
  slug: 'janet',
  display_name: 'Janet',
  model: 'claude-sonnet-4-6',
  provider: 'anthropic' as const,
  system_prompt: 'You are Janet.',
  temperature: 0.7,
  max_tokens: 1024,
  enabled: true,
  mcp_servers: [],
  ...overrides,
});

const messages: UIMessage[] = [
  { id: '1', role: 'user', content: 'Hello', parts: [{ type: 'text', text: 'Hello' }] },
];

// --- tests ---
describe('createStreamingAgent', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.resetAllMocks());

  it('calls loadAgentDef with the correct slug', async () => {
    mockLoadAgentDef.mockResolvedValue(makeDef());
    mockStreamText.mockReturnValue({ stream: {} });

    await createStreamingAgent('janet').stream(messages);

    expect(mockLoadAgentDef).toHaveBeenCalledWith('janet');
  });

  it('builds system string as def.system_prompt + systemSuffix when provided', async () => {
    const def = makeDef();
    mockLoadAgentDef.mockResolvedValue(def);
    mockStreamText.mockReturnValue({});

    await createStreamingAgent('janet').stream(messages, { systemSuffix: '\n\nExtra context.' });

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({ system: 'You are Janet.\n\nExtra context.' })
    );
  });

  it('uses def.system_prompt alone when no systemSuffix provided', async () => {
    const def = makeDef();
    mockLoadAgentDef.mockResolvedValue(def);
    mockStreamText.mockReturnValue({});

    await createStreamingAgent('janet').stream(messages);

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({ system: 'You are Janet.' })
    );
  });

  it('passes onFinish through to streamText when provided', async () => {
    mockLoadAgentDef.mockResolvedValue(makeDef());
    mockStreamText.mockReturnValue({});
    const onFinish = vi.fn();

    await createStreamingAgent('janet').stream(messages, { onFinish });

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({ onFinish })
    );
  });

  it('omits onFinish from streamText when not provided', async () => {
    mockLoadAgentDef.mockResolvedValue(makeDef());
    mockStreamText.mockReturnValue({});

    await createStreamingAgent('janet').stream(messages);

    const call = mockStreamText.mock.calls[0][0] as Record<string, unknown>;
    expect(call.onFinish).toBeUndefined();
  });

  it('passes maxOutputTokens and temperature from def', async () => {
    const def = makeDef({ max_tokens: 2048, temperature: 0.3 });
    mockLoadAgentDef.mockResolvedValue(def);
    mockStreamText.mockReturnValue({});

    await createStreamingAgent('janet').stream(messages);

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({ maxOutputTokens: 2048, temperature: 0.3 })
    );
  });

  it('propagates errors when loadAgentDef throws', async () => {
    mockLoadAgentDef.mockRejectedValue(new Error("Agent 'unknown' not found or disabled"));

    await expect(createStreamingAgent('unknown').stream(messages)).rejects.toThrow(
      "Agent 'unknown' not found or disabled"
    );
  });
});

describe('createPipelineAgent', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.resetAllMocks());

  it('calls loadAgentDef with the correct slug', async () => {
    mockLoadAgentDef.mockResolvedValue(makeDef({ slug: 'sage' }));
    mockGenerateText.mockResolvedValue({ output: {} });

    const schema = z.object({ result: z.string() });
    await createPipelineAgent('sage').run(schema, 'Analyse health data.');

    expect(mockLoadAgentDef).toHaveBeenCalledWith('sage');
  });

  it('calls generateText with system prompt from def', async () => {
    const def = makeDef({ system_prompt: 'You are Sage.' });
    mockLoadAgentDef.mockResolvedValue(def);
    mockGenerateText.mockResolvedValue({ output: { recommendation: 'Take vitamin D.' } });

    const schema = z.object({ recommendation: z.string() });
    await createPipelineAgent('sage').run(schema, 'Analyse health data.');

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({ system: 'You are Sage.' })
    );
  });

  it('returns the output value directly, not the full result object', async () => {
    mockLoadAgentDef.mockResolvedValue(makeDef());
    const output = { recommendation: 'Take vitamin D.' };
    mockGenerateText.mockResolvedValue({ output, text: 'some text', usage: {} });

    const schema = z.object({ recommendation: z.string() });
    const result = await createPipelineAgent('sage').run(schema, 'Analyse.');

    expect(result).toBe(output);
  });

  it('propagates errors when loadAgentDef throws', async () => {
    mockLoadAgentDef.mockRejectedValue(new Error("Agent 'unknown' not found or disabled"));

    const schema = z.object({ x: z.string() });
    await expect(createPipelineAgent('unknown').run(schema, 'prompt')).rejects.toThrow(
      "Agent 'unknown' not found or disabled"
    );
  });
});

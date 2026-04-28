import { createAnthropic } from '@ai-sdk/anthropic';
import { OpenRouter } from '@openrouter/sdk';
import type { AgentDefinition } from './types';

export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
});

export const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
});

export function getAnthropicModel(def: Pick<AgentDefinition, 'model' | 'provider'>) {
  if (def.provider !== 'anthropic') {
    throw new Error(`Streaming chat agents require provider='anthropic'. Got: ${def.provider}`);
  }
  return anthropic(def.model);
}

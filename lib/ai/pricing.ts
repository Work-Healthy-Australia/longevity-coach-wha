// Anthropic Claude pricing — USD per million tokens.
// Source: https://www.anthropic.com/pricing (verified 2026-04-30).
// Update quarterly. Unknown models default to the Sonnet rate to avoid
// silently undercounting.

export type ModelPricing = {
  /** Standard input tokens (no cache hit). */
  inputPerMillion: number;
  /** Output tokens. */
  outputPerMillion: number;
  /** Tokens written into the prompt cache (5m TTL). */
  cacheWritePerMillion: number;
  /** Tokens read from the prompt cache (cheap path). */
  cacheReadPerMillion: number;
};

const PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-7': {
    inputPerMillion: 15,
    outputPerMillion: 75,
    cacheWritePerMillion: 18.75,
    cacheReadPerMillion: 1.5,
  },
  'claude-sonnet-4-6': {
    inputPerMillion: 3,
    outputPerMillion: 15,
    cacheWritePerMillion: 3.75,
    cacheReadPerMillion: 0.3,
  },
  'claude-haiku-4-5': {
    inputPerMillion: 1,
    outputPerMillion: 5,
    cacheWritePerMillion: 1.25,
    cacheReadPerMillion: 0.1,
  },
};

const DEFAULT_PRICING: ModelPricing = PRICING['claude-sonnet-4-6'];

export type UsageInputs = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

/** Strip provider prefixes ("anthropic/", "openrouter/anthropic/") and "[1m]" context suffix. */
export function normaliseModelId(model: string): string {
  return model
    .replace(/^.*?anthropic\//, '')
    .replace(/\[\d+[km]\]$/i, '')
    .trim();
}

export function pricingFor(model: string): ModelPricing {
  return PRICING[normaliseModelId(model)] ?? DEFAULT_PRICING;
}

/** Compute call cost in whole US cents (rounded up to avoid undercounting). */
export function costCents(model: string, usage: UsageInputs): number {
  const p = pricingFor(model);
  const dollars =
    (usage.inputTokens * p.inputPerMillion) / 1_000_000 +
    (usage.outputTokens * p.outputPerMillion) / 1_000_000 +
    (usage.cacheReadTokens * p.cacheReadPerMillion) / 1_000_000 +
    (usage.cacheWriteTokens * p.cacheWritePerMillion) / 1_000_000;
  return Math.ceil(dollars * 100);
}

import { createAdminClient } from '@/lib/supabase/admin';
import { costCents, normaliseModelId, type UsageInputs } from '@/lib/ai/pricing';

export type UsagePath = 'stream' | 'pipeline_t1' | 'pipeline_t2' | 'pipeline_t3';

export type RecordUsageArgs = {
  agentSlug: string;
  model: string;
  userUuid?: string | null;
  usage: Partial<UsageInputs>;
  latencyMs: number;
  success: boolean;
  path: UsagePath;
};

/**
 * Insert one row into public.agent_usage. Fire-and-forget — every error is
 * swallowed so a telemetry failure can never bubble into a user-facing AI
 * response. Never logs prompt or completion bodies (per security.md).
 */
export async function recordUsage(args: RecordUsageArgs): Promise<void> {
  try {
    const u = args.usage;
    const inputTokens = u.inputTokens ?? 0;
    const outputTokens = u.outputTokens ?? 0;
    const cacheReadTokens = u.cacheReadTokens ?? 0;
    const cacheWriteTokens = u.cacheWriteTokens ?? 0;

    const cost = costCents(args.model, {
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
    });

    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).from('agent_usage').insert({
      agent_slug: args.agentSlug,
      model: normaliseModelId(args.model),
      user_uuid: args.userUuid ?? null,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_tokens: cacheReadTokens,
      cache_write_tokens: cacheWriteTokens,
      cost_usd_cents: cost,
      latency_ms: args.latencyMs,
      success: args.success,
      path: args.path,
    });
    if (error) {
      console.warn('[agent_usage] insert failed (non-fatal):', error.message);
    }
  } catch (err) {
    console.warn(
      '[agent_usage] capture threw (non-fatal):',
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Pull token counts from a Vercel AI SDK v6 usage object. */
export function extractUsage(raw: unknown): Partial<UsageInputs> {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const inputDetails = (r.inputTokenDetails as Record<string, unknown> | undefined) ?? {};
  return {
    inputTokens: numberOrZero(r.inputTokens),
    outputTokens: numberOrZero(r.outputTokens),
    cacheReadTokens: numberOrZero(inputDetails.cacheReadTokens),
    cacheWriteTokens: numberOrZero(inputDetails.cacheWriteTokens),
  };
}

function numberOrZero(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

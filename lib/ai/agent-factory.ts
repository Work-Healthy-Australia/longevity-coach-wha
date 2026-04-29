import {
  generateText,
  Output,
  streamText,
  stepCountIs,
  convertToModelMessages,
  NoObjectGeneratedError,
  type UIMessage,
  type Tool,
} from 'ai';
import { type ZodTypeAny, type infer as ZodInfer } from 'zod';
import { loadAgentDef, getAnthropicModel } from '@/lib/ai/loader';
import { recordUsage, extractUsage, type UsagePath } from '@/lib/ai/usage';

export interface StreamingAgentOptions {
  /** Appended after def.system_prompt — caller must include \n\n prefix if a blank line is needed. */
  systemSuffix?: string;
  /** Non-blocking callback fired after the full response is written. */
  onFinish?: (opts: {
    text: string;
    steps?: ReadonlyArray<{ toolCalls?: ReadonlyArray<{ toolName: string }> }>;
  }) => Promise<void>;
  /** Tool_use sub-agents Janet can call mid-turn (one level deep only). */
  tools?: Record<string, Tool>;
  /** Max tool→response cycles when tools are provided. Defaults to 3. */
  maxToolSteps?: number;
  /** Optional caller user UUID — recorded against the cost row for per-user spend reporting. */
  userUuid?: string | null;
}

export function createStreamingAgent(slug: string) {
  return {
    async stream(messages: UIMessage[], opts?: StreamingAgentOptions) {
      const def = await loadAgentDef(slug);
      const startedAt = Date.now();
      return streamText({
        model: getAnthropicModel(def),
        system: def.system_prompt + (opts?.systemSuffix ?? ''),
        messages: await convertToModelMessages(messages),
        maxOutputTokens: def.max_tokens,
        temperature: def.temperature,
        tools: opts?.tools,
        stopWhen: opts?.tools ? stepCountIs(opts.maxToolSteps ?? 3) : undefined,
        onFinish: async (event) => {
          // Telemetry first — fire-and-forget so a caller onFinish failure
          // can't suppress it. Errors inside recordUsage are already swallowed.
          void recordUsage({
            agentSlug: slug,
            model: def.model,
            userUuid: opts?.userUuid ?? null,
            usage: extractUsage((event as unknown as { usage?: unknown }).usage),
            latencyMs: Date.now() - startedAt,
            success: true,
            path: 'stream',
          });
          if (opts?.onFinish) {
            await opts.onFinish(event as Parameters<NonNullable<StreamingAgentOptions['onFinish']>>[0]);
          }
        },
      });
    },
  };
}

// ─── JSON extraction helpers ──────────────────────────────────────────────

/**
 * Try every extraction strategy to get a JSON value from arbitrary text.
 * Returns null only if nothing parseable is found.
 */
function extractJson(text: string): unknown {
  // 1. Direct parse
  try { return JSON.parse(text.trim()); } catch {}

  // 2. Fenced code block: ```json … ``` or ``` … ```
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }

  // 3. First { … last } or first [ … last ]
  for (const [open, close] of [['{', '}'], ['[', ']']] as const) {
    const start = text.indexOf(open);
    const end = text.lastIndexOf(close);
    if (start !== -1 && end > start) {
      try { return JSON.parse(text.slice(start, end + 1)); } catch {}
    }
  }

  return null;
}

/** Return field names from a ZodObject schema. Returns [] for non-object schemas. */
function getFieldNames(schema: ZodTypeAny): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shape = (schema as any).shape;
  return shape ? Object.keys(shape as object) : [];
}

/**
 * Parse a format-escape response where each field is preceded by ===FIELD: name===.
 * Split produces: [pre-text, field1, content1, field2, content2, …]
 */
function extractLabeledFields(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const parts = text.split(/===FIELD:\s*(\w+)===\n?/);
  for (let i = 1; i < parts.length - 1; i += 2) {
    result[parts[i].trim()] = (parts[i + 1] ?? '').trim();
  }
  return result;
}

/**
 * Convert labeled sections into a plain object.
 * Tries JSON.parse on each section value; falls back to the raw string.
 */
function assembleFromSections(sections: Record<string, string>): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(sections)) {
    const asJson = extractJson(value);
    obj[key] = asJson !== null ? asJson : value;
  }
  return obj;
}

/**
 * Attempt to heal a failed LLM response by extracting JSON from raw text and
 * running it through the schema. Returns null if either step fails.
 */
function tryHeal<T extends ZodTypeAny>(rawText: string, schema: T): ZodInfer<T> | null {
  const json = extractJson(rawText);
  if (json === null) return null;
  const parsed = schema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

// ─── Pipeline agent ───────────────────────────────────────────────────────

/**
 * Three-tier resilience chain for structured LLM output:
 *
 *   Tier 1 — Output.object (tool_use) at configured temperature
 *   Tier 2 — Output.object (tool_use) at temperature=0
 *             ↳ After each tool_use failure: attempt raw-text JSON extraction (no extra LLM call)
 *   Tier 3 — Format-escape: plain generateText with labeled sections, no tool_use at all
 *             ↳ Labeled extraction → JSON extraction fallback
 *
 * Only infrastructure failures (timeouts, auth errors) can escape all three tiers.
 */
export function createPipelineAgent(slug: string) {
  return {
    async run<T extends ZodTypeAny>(schema: T, prompt: string): Promise<ZodInfer<T>> {
      const def = await loadAgentDef(slug);
      const fields = getFieldNames(schema);
      let lastRawText: string | undefined;
      let lastErr: unknown;

      for (let attempt = 1; attempt <= 3; attempt++) {
        const path: UsagePath = attempt === 1 ? 'pipeline_t1' : attempt === 2 ? 'pipeline_t2' : 'pipeline_t3';
        const startedAt = Date.now();
        try {
          if (attempt <= 2) {
            // ── Tier 1 & 2: structured output via Anthropic tool_use ──────────
            const result = await generateText({
              model: getAnthropicModel(def),
              system: def.system_prompt,
              prompt,
              output: Output.object({ schema }),
              maxOutputTokens: def.max_tokens,
              temperature: attempt === 1 ? def.temperature : 0,
            });

            void recordUsage({
              agentSlug: slug,
              model: def.model,
              usage: extractUsage((result as unknown as { usage?: unknown }).usage),
              latencyMs: Date.now() - startedAt,
              success: result.output != null,
              path,
            });

            if (result.output == null) {
              throw new Error('Output.object returned null — model did not invoke the tool');
            }

            return result.output as ZodInfer<T>;

          } else {
            // ── Tier 3: format-escape — no tool_use, labeled sections ─────────
            // Bypass the tool_use mechanism entirely. Ask the model to emit each
            // field under a deterministic ===FIELD: name=== header so we can
            // extract values with a regex split rather than relying on JSON fidelity.
            const fieldBlock = fields
              .map((f) => `===FIELD: ${f}===\n<value for ${f}>`)
              .join('\n\n');

            const escapePrompt =
              `${prompt}\n\n` +
              `---\n` +
              `IMPORTANT: previous attempts to get a JSON response failed. ` +
              `You MUST respond using ONLY the labeled format below — one section per field. ` +
              `Replace each placeholder with the real value. ` +
              `For array or object fields, write valid JSON after the === header line. ` +
              `Write NOTHING outside these labeled sections.\n\n` +
              fieldBlock;

            const result = await generateText({
              model: getAnthropicModel(def),
              system: def.system_prompt,
              prompt: escapePrompt,
              maxOutputTokens: def.max_tokens,
              temperature: 0,
            });

            void recordUsage({
              agentSlug: slug,
              model: def.model,
              usage: extractUsage((result as unknown as { usage?: unknown }).usage),
              latencyMs: Date.now() - startedAt,
              success: true,
              path,
            });

            lastRawText = result.text;

            // Strategy A: labeled section extraction → Zod parse
            const sections = extractLabeledFields(result.text);
            if (Object.keys(sections).length > 0) {
              const assembled = assembleFromSections(sections);
              const parsed = schema.safeParse(assembled);
              if (parsed.success) {
                console.warn(JSON.stringify({ event: 'pipeline_format_escape_success', agent: slug }));
                return parsed.data;
              }
              console.warn(JSON.stringify({
                event: 'pipeline_format_escape_zod_fail',
                agent: slug,
                error: parsed.error.message.slice(0, 300),
              }));
            }

            // Strategy B: fall back to plain JSON extraction from the escape response
            const rawJson = extractJson(result.text);
            if (rawJson !== null) {
              return schema.parse(rawJson);
            }

            throw new Error('format-escape produced no parseable content');
          }

        } catch (err) {
          lastErr = err;

          // Capture raw text emitted by the model before tool_use parsing failed
          if (NoObjectGeneratedError.isInstance(err) && err.text) {
            lastRawText = err.text;
          }

          // Telemetry — record the failed attempt with whatever usage info is
          // attached to the thrown error (Vercel SDK exposes usage on
          // NoObjectGeneratedError). Token counts may be 0 for hard failures.
          const errUsage = (err as { usage?: unknown } | undefined)?.usage;
          void recordUsage({
            agentSlug: slug,
            model: def.model,
            usage: extractUsage(errUsage),
            latencyMs: Date.now() - startedAt,
            success: false,
            path,
          });

          // Before spending another LLM call, try to heal from whatever raw text we have
          if (lastRawText && attempt < 3) {
            const healed = tryHeal(lastRawText, schema);
            if (healed !== null) {
              console.warn(JSON.stringify({ event: 'pipeline_healed_from_raw', agent: slug, attempt }));
              return healed;
            }
          }

          console.warn(JSON.stringify({
            event: 'pipeline_parse_attempt_failed',
            agent: slug,
            attempt,
            error: err instanceof Error ? err.message : String(err),
            raw_preview: lastRawText?.slice(0, 400),
          }));

          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      }

      throw lastErr;
    },
  };
}

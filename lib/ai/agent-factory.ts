import { generateText, Output, streamText, stepCountIs, convertToModelMessages, NoObjectGeneratedError, type UIMessage, type Tool } from 'ai';
import type { ZodTypeAny, infer as ZodInfer } from 'zod';
import { loadAgentDef, getAnthropicModel } from '@/lib/ai/loader';

export interface StreamingAgentOptions {
  /** Appended after def.system_prompt — caller must include \n\n prefix if a blank line is needed. */
  systemSuffix?: string;
  /** Non-blocking callback fired after the full response is written. */
  onFinish?: (opts: { text: string }) => Promise<void>;
  /** Tool_use sub-agents Janet can call mid-turn (one level deep only). */
  tools?: Record<string, Tool>;
  /** Max tool→response cycles when tools are provided. Defaults to 3. */
  maxToolSteps?: number;
}

export function createStreamingAgent(slug: string) {
  return {
    async stream(messages: UIMessage[], opts?: StreamingAgentOptions) {
      const def = await loadAgentDef(slug);
      return streamText({
        model: getAnthropicModel(def),
        system: def.system_prompt + (opts?.systemSuffix ?? ''),
        messages: await convertToModelMessages(messages),
        maxOutputTokens: def.max_tokens,
        temperature: def.temperature,
        tools: opts?.tools,
        stopWhen: opts?.tools ? stepCountIs(opts.maxToolSteps ?? 3) : undefined,
        onFinish: opts?.onFinish,
      });
    },
  };
}

export function createPipelineAgent(slug: string) {
  return {
    async run<T extends ZodTypeAny>(schema: T, prompt: string): Promise<ZodInfer<T>> {
      const def = await loadAgentDef(slug);

      let lastErr: unknown;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const result = await generateText({
            model: getAnthropicModel(def),
            system: def.system_prompt,
            prompt,
            output: Output.object({ schema }),
            maxOutputTokens: def.max_tokens,
            // Use temperature=0 on retry for maximally deterministic JSON output
            temperature: attempt === 1 ? def.temperature : 0,
          });

          if (result.output == null) {
            throw new Error('Output.object returned null — model did not call the tool');
          }

          return result.output as ZodInfer<T>;
        } catch (err) {
          lastErr = err;
          if (attempt < 2) {
            console.warn(JSON.stringify({
              event: 'pipeline_parse_retry',
              agent: slug,
              attempt,
              error: err instanceof Error ? err.message : String(err),
              // Capture the raw model text to aid diagnosis
              raw_preview: NoObjectGeneratedError.isInstance(err) ? err.text?.slice(0, 400) : undefined,
            }));
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      }

      throw lastErr;
    },
  };
}

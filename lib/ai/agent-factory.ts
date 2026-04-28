import { generateText, Output, streamText, stepCountIs, convertToModelMessages, type UIMessage, type Tool } from 'ai';
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
      const result = await generateText({
        model: getAnthropicModel(def),
        system: def.system_prompt,
        prompt,
        output: Output.object({ schema }),
        maxOutputTokens: def.max_tokens,
        temperature: def.temperature,
      });
      return result.output as ZodInfer<T>;
    },
  };
}

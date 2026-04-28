# Plan: Agent Blueprint — Shared Factory Layer
Date: 2026-04-28
Phase: Phase 2 (Intelligence) + Phase 3 (Engagement) — infrastructure
Status: Draft

## Objective

Extract the repeated `loadAgentDef + getAnthropicModel + AI SDK call options` boilerplate that
exists in every agent and pipeline worker into two thin factory functions:
`createStreamingAgent` (real-time conversational agents) and `createPipelineAgent` (async batch
workers). The public API of every agent stays identical — only the internals change. This gives
future agents (Marco, PT Coach, Nova, Janet-Clinician Brief) a single consistent pattern to follow,
and gives the team one place to add cross-cutting concerns (timeouts, observability, fallback
behaviour) without touching every agent file.

Done looks like: `lib/ai/agent-factory.ts` exists, all four existing agents use it, `pnpm build`
is clean, and `pnpm test` passes with new unit tests for the factory.

## Scope

- In scope:
  - Create `lib/ai/agent-factory.ts` with `createStreamingAgent` and `createPipelineAgent`
  - Refactor `lib/ai/agents/janet.ts` to use `createStreamingAgent`
  - Refactor `lib/ai/agents/alex.ts` to use `createStreamingAgent`
  - Refactor `lib/ai/pipelines/risk-narrative.ts` to use `createPipelineAgent`
  - Refactor `lib/ai/pipelines/supplement-protocol.ts` to use `createPipelineAgent`
  - Update `lib/ai/pipelines/nova.ts` stub to show `createPipelineAgent` pattern
  - Add unit tests for the factory functions in `tests/unit/ai/agent-factory.test.ts`

- Out of scope:
  - MCP tools injection (deferred per original plan item 4e)
  - OpenRouter streaming path for chat agents (stretch goal, deferred)
  - pgvector / RAG (deferred until Supabase Dashboard toggle)
  - Nova pipeline implementation (Phase 4)
  - Any DB schema, migration, or env var changes
  - Any API route, UI, or server action changes

## Data model changes

None. This is a pure refactor of `lib/ai/` internals.

## Tasks

---

### Task 1 — Create `lib/ai/agent-factory.ts`

**Files affected:**
- `lib/ai/agent-factory.ts` (new)
- `tests/unit/ai/agent-factory.test.ts` (new)

**What to build:**

Create `lib/ai/agent-factory.ts` with two exported factory functions.

```typescript
import { generateText, Output, streamText, convertToModelMessages, type UIMessage } from 'ai';
import type { ZodTypeAny, infer as ZodInfer } from 'zod';
import { loadAgentDef, getAnthropicModel } from '@/lib/ai/loader';

export interface StreamingAgentOptions {
  /** Appended after the def's system_prompt with no separator — caller must include \n\n if needed. */
  systemSuffix?: string;
  /** Non-blocking callback fired after the full response is written. */
  onFinish?: (opts: { text: string }) => Promise<void>;
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
```

**Why factory functions, not classes:**
The existing codebase uses plain async functions throughout (`streamJanetTurn`, `runRiskNarrativePipeline`). A factory function returning an object gives the same grouping benefit as a class without introducing inheritance hierarchies or `this` binding complexity.

**Acceptance criteria:**
- [ ] `createStreamingAgent(slug)` returns an object with a `stream(messages, opts?)` method
- [ ] `stream()` loads the agent def, resolves the model, builds the system string, calls `streamText` with `maxOutputTokens` and `temperature` from the def
- [ ] `opts.systemSuffix` is appended to `def.system_prompt` when provided; omitted when not
- [ ] `opts.onFinish` is passed through to `streamText` when provided; omitted when not
- [ ] `createPipelineAgent(slug)` returns an object with a `run(schema, prompt)` method
- [ ] `run()` loads the agent def, resolves the model, calls `generateText` with `Output.object`, returns the typed output directly (no raw result object)
- [ ] `pnpm build` clean
- [ ] Unit tests cover: `stream()` with and without opts, `run()` success, both throw correctly when the agent slug is not found

**Rules to apply:** `.claude/rules/ai-agents.md`, `.claude/rules/nextjs-conventions.md`

---

### Task 2 — Refactor `janet.ts` and `alex.ts`

**Files affected:**
- `lib/ai/agents/janet.ts` (modify)
- `lib/ai/agents/alex.ts` (modify)

**What to build:**

Replace the inline `loadAgentDef + streamText` call in each file with the factory.

**`janet.ts` before:**
```typescript
const [def, ctx] = await Promise.all([loadAgentDef('janet'), loadPatientContext(...)]);
const result = streamText({
  model: getAnthropicModel(def),
  system: def.system_prompt + '\n\n' + summariseContext(ctx),
  messages: await convertToModelMessages(messages),
  maxOutputTokens: def.max_tokens,
  temperature: def.temperature,
  onFinish: async ({ text }) => { /* persist */ },
});
```

**`janet.ts` after:**
```typescript
const [ctx] = await Promise.all([loadPatientContext(userId, { includeConversation: false })]);
const agent = createStreamingAgent('janet');
return agent.stream(messages, {
  systemSuffix: '\n\n' + summariseContext(ctx),
  onFinish: async ({ text }) => { /* persist — same logic as before */ },
});
```

Note: `loadAgentDef` is now called inside the factory. Janet's `Promise.all` only needs to load `PatientContext` now; if more context sources are added later, they are still parallelised in the outer `Promise.all`.

**`alex.ts` before:**
```typescript
const def = await loadAgentDef('alex');
return streamText({
  model: getAnthropicModel(def),
  system: def.system_prompt + `\n\nCurrent member page: ${currentPath}`,
  messages: await convertToModelMessages(messages),
  maxOutputTokens: def.max_tokens,
});
```

**`alex.ts` after:**
```typescript
const agent = createStreamingAgent('alex');
return agent.stream(messages, {
  systemSuffix: `\n\nCurrent member page: ${currentPath}`,
});
```

**Acceptance criteria:**
- [ ] `streamJanetTurn` public signature unchanged
- [ ] `streamAlexTurn` public signature unchanged
- [ ] Janet's `PatientContext` is still loaded in parallel before calling `agent.stream()`
- [ ] Janet's `onFinish` persistence logic is unchanged — still inserts user + assistant turns to `agent_conversations`
- [ ] Alex still appends `currentPath` to the system prompt
- [ ] Neither file imports `loadAgentDef`, `getAnthropicModel`, `streamText`, or `convertToModelMessages` directly — all go through the factory
- [ ] `pnpm build` clean, `pnpm test` all passing (existing tests unchanged)

**Rules to apply:** `.claude/rules/ai-agents.md`

---

### Task 3 — Refactor `risk-narrative.ts` and `supplement-protocol.ts`

**Files affected:**
- `lib/ai/pipelines/risk-narrative.ts` (modify)
- `lib/ai/pipelines/supplement-protocol.ts` (modify)

**What to build:**

Replace the inline `loadAgentDef + generateText` block inside each try/catch with a
`createPipelineAgent` call. The pipeline's data loading (profile, health, uploads) is unchanged.

**`risk-narrative.ts` before:**
```typescript
const def = await loadAgentDef('atlas');
let output: RiskNarrativeOutput;
try {
  const result = await generateText({
    model: getAnthropicModel(def),
    system: def.system_prompt,
    prompt: buildPrompt({ ageYears, responses, uploadSummaries }),
    output: Output.object({ schema: RiskNarrativeOutputSchema }),
    maxOutputTokens: def.max_tokens,
    temperature: def.temperature,
  });
  output = result.output;
} catch (err) {
  console.error(...);
  return;
}
```

**`risk-narrative.ts` after:**
```typescript
const agent = createPipelineAgent('atlas');
let output: RiskNarrativeOutput;
try {
  output = await agent.run(RiskNarrativeOutputSchema, buildPrompt({ ageYears, responses, uploadSummaries }));
} catch (err) {
  console.error(...);
  return;
}
```

Same pattern for `supplement-protocol.ts` with `'sage'` and `SupplementOutputSchema`.

The `try/catch` wrapper stays — pipeline workers must be non-fatal per `.claude/rules/ai-agents.md`.

**Acceptance criteria:**
- [ ] `runRiskNarrativePipeline` public signature unchanged
- [ ] `runSupplementProtocolPipeline` public signature unchanged
- [ ] All DB data loading (profile, health, risk, uploads) code is unchanged
- [ ] All `risk_scores.upsert` and `supplement_plans.insert` write logic is unchanged
- [ ] Neither file imports `loadAgentDef`, `getAnthropicModel`, `generateText`, or `Output` directly — all go through the factory
- [ ] The non-fatal `try/catch` wrapper remains in both pipelines
- [ ] `pnpm build` clean, `pnpm test` all passing (existing tests unchanged)

**Rules to apply:** `.claude/rules/ai-agents.md`

---

### Task 4 — Update `nova.ts` stub

**Files affected:**
- `lib/ai/pipelines/nova.ts` (modify)

**What to build:**

Update the Phase 4 stub to show the `createPipelineAgent` pattern so the next engineer who
implements Nova has a clear starting point. The function still throws "not yet implemented" — only
the shape and imports change.

```typescript
import { z } from 'zod';
import { createPipelineAgent } from '@/lib/ai/agent-factory';

// Phase 4 placeholder — schema and prompt will be defined when Nova is implemented.
const NovaOutputSchema = z.object({
  digest: z.string(),
});

export async function runNovaDigestPipeline(_userId: string): Promise<void> {
  // createPipelineAgent('nova').run(NovaOutputSchema, buildPrompt(_userId))
  throw new Error('Nova pipeline not yet implemented (Phase 4)');
}
```

**Acceptance criteria:**
- [ ] File imports `createPipelineAgent` from `@/lib/ai/agent-factory`
- [ ] A placeholder Zod schema exists showing the intended output shape
- [ ] The function still throws `'Nova pipeline not yet implemented (Phase 4)'`
- [ ] `pnpm build` clean

**Rules to apply:** `.claude/rules/ai-agents.md`

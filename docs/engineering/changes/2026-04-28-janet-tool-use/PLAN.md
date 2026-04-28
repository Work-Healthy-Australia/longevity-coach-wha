# Plan: janet-tool-use
Date: 2026-04-28
Phase: Phase 3 — Epic 6 (Janet), Epic 4 (Sage/Atlas)
Status: Draft

## Objective

Wire Atlas (risk narrative) and Sage (supplement protocol) as inline tool_use sub-agents that Janet can call during a conversation turn. When a patient asks a question that requires deep specialist reasoning (e.g. "explain my risk scores" or "what supplements should I take?"), Janet issues a `tool_use` call to the relevant specialist; the specialist runs a focused LLM inference and returns a `tool_result`; Janet synthesises that result before streaming the final response.

These tools run fresh lightweight LLM inference against the patient's context — they do NOT call the background pipeline workers (`runRiskNarrativePipeline`, `runSupplementProtocolPipeline`). Background pipelines continue to run on their own schedule for pre-computation; tool_use is for on-demand in-conversation synthesis.

Done means: `streamJanetTurn` passes two tools to the Anthropic API; Janet can invoke `atlas_risk_summary` and `sage_supplement_summary` mid-turn; the tool results are synthesised into Janet's streaming reply; no DB writes happen inside the tool execution path.

## Scope

In scope:
- `lib/ai/agent-factory.ts` — extend `StreamingAgentOptions` to accept `tools` for `createStreamingAgent`
- `lib/ai/tools/atlas-tool.ts` — `atlas_risk_summary` tool definition and handler
- `lib/ai/tools/sage-tool.ts` — `sage_supplement_summary` tool definition and handler
- `lib/ai/agents/janet.ts` — pass tools to `createStreamingAgent`
- Tests for tool invocation and result shape

Out of scope:
- Background pipeline workers (unchanged)
- Atlas/Sage pipeline trigger logic (unchanged)
- Chaining more than one level of sub-agents (Janet → tool, never Janet → tool → tool)
- DB writes inside tool handlers
- PT Coach tool (future sprint)
- Tool invocation UI (no client changes needed — streaming handles it)

## Data model changes

None. Tool results flow through the streaming response; nothing is written to the DB inside the tool execution path.

---

## Tasks

---

### Task 1 — Extend `createStreamingAgent` with tools support

**Files affected:**
- `lib/ai/agent-factory.ts`

**What to build:**

Add an optional `tools` field to `StreamingAgentOptions`:

```ts
import type { Tool } from 'ai';
import { stepCountIs } from 'ai';

export interface StreamingAgentOptions {
  systemSuffix?: string;
  onFinish?: (opts: { text: string }) => Promise<void>;
  tools?: Record<string, Tool>;
  maxToolSteps?: number; // how many tool→response cycles to allow; default 3
}
```

Pass `tools` and `maxSteps` through to the `streamText` call:

```ts
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
```

**Acceptance criteria:**
- [ ] `StreamingAgentOptions.tools` typed as `Record<string, Tool> | undefined`
- [ ] When `tools` is undefined, `streamText` call is unchanged (no regression)
- [ ] When `tools` is provided, `maxSteps` defaults to 3
- [ ] `pnpm build` passes

**Rules:** `.claude/rules/ai-agents.md`

---

### Task 2 — Atlas tool (`lib/ai/tools/atlas-tool.ts`)

**Files affected:**
- `lib/ai/tools/atlas-tool.ts` (new)

**What to build:**

Export `atlasRiskSummaryTool(ctx: PatientContext): Tool`.

The tool takes no parameters (all patient data is in scope from the caller's `ctx` argument).

```ts
import { tool } from 'ai';
import { z } from 'zod';
import { createPipelineAgent } from '@/lib/ai/agent-factory';
import type { PatientContext } from '@/lib/ai/patient-context';

export function atlasRiskSummaryTool(ctx: PatientContext) {
  return tool({
    description:
      'Get a specialist risk narrative for this patient. Returns a structured 2–4 sentence interpretation of their five-domain risk scores, top drivers, and protective levers. Call this when the patient asks to explain their risk results in depth.',
    parameters: z.object({}),
    execute: async () => {
      const AtlasOutputSchema = z.object({
        narrative: z.string().min(50).max(600),
        top_drivers: z.array(z.string()).max(4),
        key_action: z.string().max(200),
      });

      const prompt = buildAtlasPrompt(ctx);
      const result = await createPipelineAgent('atlas').run(AtlasOutputSchema, prompt);
      return result;
    },
  });
}
```

`buildAtlasPrompt(ctx: PatientContext): string` — formats the patient's risk scores, top drivers, and health profile into a focused prompt for Atlas:

```
Patient risk profile:
- Biological age: <value>
- CV: <value>, Metabolic: <value>, Neuro: <value>, Onco: <value>, MSK: <value>
- Top risk drivers: <list>
- Top protective levers: <list>
- Confidence: <level>
- Questionnaire highlights: <responses summary>
- Pathology highlights: <upload summaries>

Provide: a 2–4 sentence plain-English narrative of the patient's risk profile,
up to 4 specific risk drivers, and one high-impact action the patient can take now.
```

**Acceptance criteria:**
- [ ] `atlasRiskSummaryTool` returns a valid AI SDK `Tool` object
- [ ] `execute` calls `createPipelineAgent('atlas').run(...)` — never calls `runRiskNarrativePipeline`
- [ ] Tool description is clear enough for the LLM to know when to invoke it
- [ ] No DB writes inside `execute`
- [ ] `pnpm build` passes

**Rules:** `.claude/rules/ai-agents.md` — "Janet → sub-agent, never Janet → sub-agent → sub-agent"

---

### Task 3 — Sage tool (`lib/ai/tools/sage-tool.ts`)

**Files affected:**
- `lib/ai/tools/sage-tool.ts` (new)

**What to build:**

Export `sageSummaryTool(ctx: PatientContext): Tool`.

```ts
import { tool } from 'ai';
import { z } from 'zod';
import { createPipelineAgent } from '@/lib/ai/agent-factory';
import type { PatientContext } from '@/lib/ai/patient-context';

export function sageSummaryTool(ctx: PatientContext) {
  return tool({
    description:
      'Get a specialist explanation of this patient\'s supplement protocol. Returns a rationale for the top supplements linked to their specific risk drivers. Call this when the patient asks why they are taking a specific supplement, or asks for a deep-dive on their protocol.',
    parameters: z.object({
      focus: z.string().optional().describe('Optional: specific supplement name or domain to focus on'),
    }),
    execute: async ({ focus }) => {
      const SageOutputSchema = z.object({
        summary: z.string().min(50).max(600),
        highlighted_items: z.array(z.object({
          name: z.string(),
          rationale: z.string(),
          linked_driver: z.string(),
        })).max(5),
      });

      const prompt = buildSageToolPrompt(ctx, focus);
      const result = await createPipelineAgent('sage').run(SageOutputSchema, prompt);
      return result;
    },
  });
}
```

`buildSageToolPrompt(ctx: PatientContext, focus?: string): string` — formats the patient's active supplement plan plus risk context:

```
Patient supplement protocol:
<items from ctx.supplementPlan.items — name, dosage, priority, domains, rationale>

Patient risk context:
- Top drivers: <list>
- CV=<n>, Metabolic=<n>

<if focus>: Focus specifically on: <focus>

Provide: a 2–3 sentence plain-English summary of the protocol rationale, and up to 5
highlighted items each explaining the supplement name, why it was chosen, and which
specific risk driver it addresses.
```

If `ctx.supplementPlan` is null, return a static `{ summary: 'No supplement protocol has been generated yet.', highlighted_items: [] }` without calling the LLM.

**Acceptance criteria:**
- [ ] `sageSummaryTool` returns a valid AI SDK `Tool` object
- [ ] `execute` calls `createPipelineAgent('sage').run(...)` — never calls `runSupplementProtocolPipeline`
- [ ] Returns early with no LLM call when `ctx.supplementPlan` is null
- [ ] `focus` parameter correctly filters the prompt
- [ ] No DB writes inside `execute`
- [ ] `pnpm build` passes

**Rules:** `.claude/rules/ai-agents.md`

---

### Task 4 — Wire tools into `janet.ts`

**Files affected:**
- `lib/ai/agents/janet.ts`

**What to build:**

Import the two tool factories and pass them to `createStreamingAgent`:

```ts
import { atlasRiskSummaryTool } from '@/lib/ai/tools/atlas-tool';
import { sageSummaryTool } from '@/lib/ai/tools/sage-tool';

// Inside streamJanetTurn, after ctx is loaded:
const agent = createStreamingAgent('janet');
return agent.stream(messages, {
  systemSuffix: '\n\n' + summariseContext(ctx),
  tools: {
    atlas_risk_summary: atlasRiskSummaryTool(ctx),
    sage_supplement_summary: sageSummaryTool(ctx),
  },
  onFinish: async ({ text }) => {
    // ...existing turn-save logic unchanged...
    compressConversation(userId, 'janet').catch(() => {});
  },
});
```

**Acceptance criteria:**
- [ ] Both tools are registered under `atlas_risk_summary` and `sage_supplement_summary`
- [ ] Tools receive the loaded `ctx` — no additional DB calls inside tool handlers
- [ ] `onFinish` logic is unchanged
- [ ] `pnpm build` passes

**Rules:** `.claude/rules/ai-agents.md` — one LLM call per user message (tool_use adds one more — this is explicitly permitted by the rules for specialist answers)

---

### Task 5 — Tests

**Files affected:**
- `tests/unit/ai/tools/atlas-tool.test.ts` (new)
- `tests/unit/ai/tools/sage-tool.test.ts` (new)

**What to build:**

**Atlas tool tests** — `tests/unit/ai/tools/atlas-tool.test.ts`:

Mock `createPipelineAgent`. Test:
- `execute()` calls `createPipelineAgent('atlas').run(...)` with a prompt that includes the patient's risk scores
- Prompt includes top_risk_drivers from ctx
- No DB writes occur (no `createAdminClient` calls)

**Sage tool tests** — `tests/unit/ai/tools/sage-tool.test.ts`:

Mock `createPipelineAgent`. Test:
- `execute({ focus: undefined })` calls `createPipelineAgent('sage').run(...)` with full protocol
- `execute({ focus: 'omega-3' })` passes focus into the prompt
- When `ctx.supplementPlan` is null, returns early without LLM call

Use `SEED_PATIENT_CONTEXT` from the fixtures once Task 1 of eval-suites is complete; otherwise construct a minimal inline fixture.

**Acceptance criteria:**
- [ ] All tests pass
- [ ] No real network calls or DB in tests
- [ ] `pnpm test` passes

---

## Build order

Task 1 → Task 2 + Task 3 (parallel) → Task 4 → Task 5

Task 1 (agent-factory extension) must exist before Tasks 2 and 3 import `Tool` type conventions. Tasks 2 and 3 can be built in parallel. Task 4 requires both tools to exist. Task 5 requires tools to exist.

## Dependency on other plans

This plan is independent of `conversation-compression` but benefits from it being complete (so `janet.ts` already has the `compressConversation` call in `onFinish`). If compression is not yet merged, Task 4 should omit the `compressConversation` line and note it as a follow-up.

This plan has no dependency on `eval-suites`, though the eval fixture in Task 5 can be shared once eval-suites Task 1 is merged.

# Changelog: Agent Blueprint — Shared Factory Layer
Date: 2026-04-28
Phase: Phase 2 (Intelligence) + Phase 3 (Engagement) — infrastructure

## What was built

- `lib/ai/agent-factory.ts` — two factory functions:
  - `createStreamingAgent(slug)` — for real-time conversational agents; wraps `loadAgentDef + streamText + convertToModelMessages`; accepts `systemSuffix` and `onFinish` options
  - `createPipelineAgent(slug)` — for async batch workers; wraps `loadAgentDef + generateText + Output.object`; returns typed structured output directly
- `tests/unit/ai/agent-factory.test.ts` — 11 unit tests covering all factory behaviours

## What changed

| File | Change |
|---|---|
| `lib/ai/agents/janet.ts` | Replaced inline `loadAgentDef + streamText` with `createStreamingAgent('janet').stream()`; PatientContext loading and onFinish persistence unchanged |
| `lib/ai/agents/alex.ts` | Replaced inline `loadAgentDef + streamText` with `createStreamingAgent('alex').stream()`; currentPath injection via `systemSuffix` |
| `lib/ai/pipelines/risk-narrative.ts` | Replaced `loadAgentDef('atlas') + generateText + Output.object` block with `createPipelineAgent('atlas').run()`; all DB logic unchanged |
| `lib/ai/pipelines/supplement-protocol.ts` | Same pattern with `'sage'`; all DB logic unchanged |
| `lib/ai/pipelines/nova.ts` | Stub updated to import `createPipelineAgent` and show placeholder `NovaOutputSchema`; function still throws Phase 4 sentinel |
| `tests/integration/ai/risk-narrative.test.ts` | Replaced deep `ai` + `@/lib/ai/loader` mocks with `@/lib/ai/agent-factory` mock; tests now assert at the correct abstraction level |
| `tests/integration/ai/supplement-protocol.test.ts` | Same mock migration |

## Migrations applied

None.

## Deviations from plan

- **`void createPipelineAgent` in nova.ts:** The plan suggested exporting `NovaOutputSchema` to prevent unused-import errors. The subagent additionally added `void createPipelineAgent` — TypeScript does not error on unused imports by default in this project, so both approaches are equivalent. Kept as-is since build is clean.
- **`loadAgentDef` sequencing in Janet:** Previously `loadAgentDef('janet')` and `loadPatientContext(...)` were in the same `Promise.all`. After the refactor, `loadAgentDef` is called inside the factory (after `PatientContext` loads). On a cold cache miss this adds ~50 ms sequentially. Acceptable at current scale; noted in QA report for future resolution.

## Known gaps / deferred items

- **MCP runtime wiring:** `buildMCPTools` pattern is documented in the sprint plan under item 4e. Will be wired into `createStreamingAgent` when MCP servers are actively used.
- **OpenRouter chat path:** `getAnthropicModel` throws if `provider !== 'anthropic'`. OpenRouter streaming for Janet/Alex is a post-MVP stretch goal.
- **Nova pipeline:** Phase 4 — stub only.

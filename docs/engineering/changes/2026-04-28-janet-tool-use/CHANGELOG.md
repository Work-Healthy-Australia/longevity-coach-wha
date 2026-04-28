# Changelog: janet-tool-use
Date: 2026-04-28
Phase: Phase 3

## What was built
- `lib/ai/agent-factory.ts` — `StreamingAgentOptions` extended with optional `tools?: Record<string, Tool>` and `maxToolSteps?: number`; `streamText` call updated to pass both when present.
- `lib/ai/tools/atlas-tool.ts` — `atlasRiskSummaryTool(ctx): Tool` — calls `createPipelineAgent('atlas')` with `buildAtlasPrompt(ctx)`; uses `inputSchema` (AI SDK v6 field name, not `parameters`); constructed as a direct object literal (not `tool()` helper — see deviations).
- `lib/ai/tools/sage-tool.ts` — `sageSummaryTool(ctx): Tool` — calls `createPipelineAgent('sage')` with `buildSageToolPrompt(ctx, focus)`; short-circuits and returns a "no plan" message when `supplementPlan` is null.
- `lib/ai/agents/janet.ts` — passes `atlas_risk_summary` and `sage_supplement_summary` tools to `createStreamingAgent`.
- `tests/unit/ai/tools/atlas-tool.test.ts` — 5 unit tests covering: tool shape, execution path, prompt content, pathology inclusion, and no-DB-write guarantee.
- `tests/unit/ai/tools/sage-tool.test.ts` — 5 unit tests covering: tool shape, execution path, focus parameter, supplement items in prompt, and null-plan short-circuit.

## What changed
| File | Change |
|---|---|
| `lib/ai/agent-factory.ts` | Added `tools` and `maxToolSteps` to options and streamText call |
| `lib/ai/agents/janet.ts` | Wired atlas and sage tools |

## Migrations applied
None.

## Deviations from plan
- Tool objects are constructed as direct object literals with `inputSchema` rather than using the `tool()` helper from the AI SDK. This is required because the `tool()` helper's TypeScript overload resolution breaks with Zod v4 schemas in AI SDK v6. Runtime behaviour is identical to using the helper.

## Known gaps / deferred items
- No integration test for the full streaming tool-use loop (Janet → tool call → synthesis).
- `maxToolSteps` default is not tested; relies on AI SDK default behaviour.
- Latency impact of sub-agent tool calls not benchmarked.

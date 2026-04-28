# QA Report: janet-tool-use
Date: 2026-04-28
Reviewer: QA subagent

## Build status
pnpm build: PASS
pnpm test: PASS (173 tests across 25 test files)

## Test results
| Suite | Tests | Pass | Fail |
|---|---|---|---|
| tests/unit/ai/tools/atlas-tool.test.ts | 5 | 5 | 0 |
| tests/unit/ai/tools/sage-tool.test.ts | 5 | 5 | 0 |

## Findings
### Confirmed working
- `atlasRiskSummaryTool` returns a valid AI SDK tool object with description and input schema.
- `atlasRiskSummaryTool` executes correctly: calls `createPipelineAgent("atlas")` with the right prompt.
- Risk scores and pathology summary are included in the prompt passed to Atlas.
- Atlas tool makes no DB writes — confirmed by asserting `createAdminClient` is not called.
- `sageSummaryTool` returns a valid AI SDK tool object.
- `sageSummaryTool` calls `createPipelineAgent("sage")` when a supplement plan exists.
- `focus` parameter is passed into the Sage prompt when provided.
- Supplement items are included in the Sage prompt.
- `sageSummaryTool` returns early without an LLM call when `supplementPlan` is null — short-circuit guard works.
- `StreamingAgentOptions` accepts optional `tools` and `maxToolSteps`; both are passed through to `streamText`.
- Janet is wired with `atlas_risk_summary` and `sage_supplement_summary` tools.
- All prior agent-factory, chat-route, and pipeline tests continue to pass (0 regressions).

### Deferred items
- No integration test verifies the end-to-end flow of Janet invoking a tool and synthesising the result into a streamed response. This requires a full streaming harness and is deferred.
- `maxToolSteps` default value (when omitted) is not explicitly tested; falls through to AI SDK default.

### Known limitations
- Tool construction uses a direct object literal with `inputSchema` rather than the `tool()` helper. This is a deliberate workaround for a TypeScript overload resolution issue between the AI SDK v6 `tool()` helper and Zod v4 schemas. Runtime behaviour is identical; the limitation is cosmetic.
- Sub-agent calls add one additional LLM round-trip per tool invocation. No latency budget test exists at this stage.

## Verdict
APPROVED

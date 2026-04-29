# Changelog: Pipeline JSON Parse Stability
Date: 2026-04-29
Phase: Phase 3 — Intelligence

## What was built
- Zod schema hardening + `extractJson` + retry-once in `lib/uploads/janet.ts` (raw Anthropic SDK path, separate from `createPipelineAgent`)
- Three-tier JSON parse recovery chain in `createPipelineAgent`:
  - Tier 1: structured tool_use output at configured temperature
  - Tier 2: structured tool_use output at temperature=0 + raw-text JSON healing (no extra LLM call)
  - Tier 3: format-escape — plain text generation with labeled `===FIELD: name===` sections, bypasses tool_use entirely, assembles output manually before Zod parse
- Structured warning logs (`pipeline_parse_attempt_failed`, `pipeline_healed_from_raw`, `pipeline_format_escape_success`, `pipeline_format_escape_zod_fail`) capturing raw model text for diagnosis

## What changed

| File | Change |
|---|---|
| `lib/ai/agent-factory.ts` | Complete rewrite of `createPipelineAgent` — 3-tier chain, `extractJson`, `getFieldNames`, `extractLabeledFields`, `assembleFromSections`, `tryHeal` helpers |
| `lib/ai/pipelines/clinician-brief.ts` | Removed string length constraints; `DomainHighlightSchema` hardened with `.catch()` on all fields, `z.coerce.number()` on score |
| `lib/ai/pipelines/pt-plan.ts` | `PtPlanItemSchema` hardened with `z.coerce.number()` and `.catch()` on required fields; removed `exercises.min(7)` |
| `lib/uploads/janet.ts` | Added `BiomarkerExtractionSchema` and `JanetResultSchema` with `.catch()` hardening on all fields; `extractJson` helper; `parseJanetResult` helper; retry-once with stronger JSON prompt on attempt 2 and thinking disabled on retry |

## Migrations applied
None.

## Deviations from plan
None.

## Known gaps / deferred items
- Unit tests for the five pure helper functions in `agent-factory.ts` would be a useful addition. Added as a QA note.
- Optional numeric fields in `PtPlanItemSchema` (`sets`, `duration_min`) do not have `.catch(undefined)` — if the model produces a non-numeric string for those optional fields, the item parse fails. Low risk; defer to a future cleanup.
- Model upgrade (sonnet → opus) is a DB configuration change in `agents.agent_definitions`, not code.

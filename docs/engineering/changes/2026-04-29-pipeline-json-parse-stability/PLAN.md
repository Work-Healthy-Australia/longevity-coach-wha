# Plan: Pipeline JSON Parse Stability
Date: 2026-04-29
Phase: Phase 3 — Intelligence
Status: Complete

## Objective
Occasional JSON parse failures were silently dropping clinician brief and PT plan pipeline runs without any output being written to the database. The failures were caused by Zod validation constraints (string length, array minimum count) that get translated into JSON Schema `minLength`/`maxLength`/`minItems` properties — properties the model cannot reliably satisfy when counting characters. A single failure meant the entire pipeline run was lost with no retry. This change eliminates the unreliable schema constraints and adds automatic retry-once recovery.

## Scope
- In scope: `createPipelineAgent` retry logic, schema constraint cleanup in clinician-brief and pt-plan pipelines
- Out of scope: streaming agent (Janet conversational), new pipeline features, DB schema changes

## Data model changes
None — no migrations required.

## Waves

### Wave 1 — Retry logic + schema constraint cleanup
**What James can see after this wave merges:** Clinician brief and PT plan pipelines complete reliably. Pipeline parse failures are logged with the raw model output for diagnosis rather than silently dropped.

Tasks:

#### Task 1.1 — Add retry-once to createPipelineAgent
Files affected: `lib/ai/agent-factory.ts`
What to build:
- Import `NoObjectGeneratedError` from `ai`
- Wrap `generateText` call in a retry loop (max 2 attempts)
- Attempt 1: use agent's configured temperature
- Attempt 2 (after 500ms): use `temperature: 0` for deterministic output
- On attempt 1 failure: log structured `pipeline_parse_retry` warning including `err.text` (raw model output) truncated to 400 chars
- Guard `result.output == null` — throw if output is missing without an error

Acceptance criteria:
- A `NoObjectGeneratedError` on attempt 1 triggers attempt 2
- Attempt 2 uses `temperature: 0`
- Warning log includes `event`, `agent`, `attempt`, `error`, `raw_preview` fields
- If both attempts fail, the error propagates to the pipeline's outer catch

#### Task 1.2 — Remove unreliable string constraints from ClinicianBriefOutputSchema
Files affected: `lib/ai/pipelines/clinician-brief.ts`
What to build: Remove `.min(100)`, `.max(1200)`, `.max(400)`, `.max(300)` from string fields. Keep `.max(5)` on array fields (item-count constraints are reliable).
Acceptance criteria: Schema has no `minLength`/`maxLength` JSON Schema properties.

#### Task 1.3 — Remove unreliable array min constraint from PtPlanOutputSchema
Files affected: `lib/ai/pipelines/pt-plan.ts`
What to build: Remove `.min(7)` from `exercises` array. Keep `.max(60)`.
Acceptance criteria: `exercises` array schema has only `maxItems: 60`.

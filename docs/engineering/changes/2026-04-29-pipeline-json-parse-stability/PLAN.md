# Plan: Pipeline JSON Parse Stability
Date: 2026-04-29
Phase: Phase 3 — Intelligence
Status: Complete

## Objective
Pipeline workers (clinician brief, PT plan) were occasionally failing silently — the job ran, hit a JSON parse error, and produced no output. Three classes of failure were identified: (1) string length constraints in Zod schemas converted to `minLength`/`maxLength` in JSON Schema that Claude cannot reliably satisfy; (2) enum constraints violated when the model produces synonyms ("declining" vs "worsening"); (3) the Anthropic tool_use mechanism occasionally failing to produce parseable output entirely. This change eliminates all three root causes and adds a three-tier healing chain so a pipeline run only fails on genuine infrastructure errors.

## Scope
- In scope: `createPipelineAgent` retry/healing logic, schema constraint cleanup and hardening in clinician-brief and pt-plan pipelines
- Out of scope: streaming agent (Janet conversational), new pipeline features, DB schema changes, model upgrade (model is configurable per agent in `agents.agent_definitions`)

## Data model changes
None — no migrations required.

## Waves

### Wave 1 — Three-tier healing chain + schema hardening
**What James can see after this wave merges:** Clinician brief and PT plan pipelines complete reliably. Parse failures auto-recover without any intervention. Logs capture structured warnings with raw model text when recovery is needed, enabling diagnosis.

Tasks:

#### Task 1.1 — Three-tier healing chain in createPipelineAgent
Files affected: `lib/ai/agent-factory.ts`
What to build:
- Tier 1: `Output.object({ schema })` at agent's configured temperature
- Tier 2: `Output.object({ schema })` at `temperature: 0` (max determinism)
  - After each tool_use failure: attempt raw-text JSON extraction (no extra LLM call) via `extractJson()` + `schema.safeParse()`
- Tier 3 (format-escape): plain `generateText` (no tool_use), labeled sections prompt, manual extraction + Zod parse
  - Strategy A: regex-split on `===FIELD: name===` headers → assemble object → Zod parse
  - Strategy B: fallback `extractJson()` on the full escape response
- Structured `pipeline_parse_attempt_failed` warning log at each failure with raw text preview
- `pipeline_healed_from_raw` and `pipeline_format_escape_success` events logged on recovery

Acceptance criteria:
- `NoObjectGeneratedError` on attempt 1 → raw text healing attempt → attempt 2 → raw text healing attempt → format-escape attempt 3
- Format-escape bypasses `Output.object` entirely (no tool_use)
- All logs are structured JSON with `event`, `agent`, `attempt`, `error`, `raw_preview`
- Only non-infrastructure errors (network, auth, timeout) propagate past tier 3

#### Task 1.2 — Harden DomainHighlightSchema
Files affected: `lib/ai/pipelines/clinician-brief.ts`
- Remove string length constraints (already done in previous round)
- `score: z.coerce.number().catch(0)` — handles `"0.7"`, null
- `trend: z.enum([...]).catch('unknown')` — handles "declining", "N/A", synonyms
- `domain: z.string().catch('')`, `note: z.string().catch('')` — handles null/missing

#### Task 1.3 — Harden PtPlanItemSchema + remove array min
Files affected: `lib/ai/pipelines/pt-plan.ts`
- `day: z.coerce.number().catch(1)` — handles "Day 5", null
- `intensity: z.enum(['low', 'moderate', 'high']).catch('moderate')` — handles "medium", "hard"
- `sets`, `duration_min`: `z.coerce.number().optional()` — handles numeric strings
- Remove `.min(7)` from `exercises` array (already done in previous round)

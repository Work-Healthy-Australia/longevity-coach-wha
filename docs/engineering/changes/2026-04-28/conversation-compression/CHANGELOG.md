# Changelog: conversation-compression
Date: 2026-04-28
Phase: Phase 3

## What was built
- `supabase/migrations/0030_conversation_summaries.sql` — new `agents.conversation_summaries` table with `UNIQUE(user_uuid, agent)` constraint, RLS authenticated SELECT policy, and index on the composite key.
- `lib/ai/compression.ts` — `compressConversation(userId, agent)` async function. Loads conversation turns, returns early if total ≤ 20 or if the summary is already current. Calls Anthropic directly (claude-haiku-4.5, temperature 0) to produce a 1–3 sentence rolling summary, upserts to `conversation_summaries`, and swallows all errors.
- `lib/ai/patient-context.ts` — `PatientContext` interface extended with `conversationSummary: string | null`; loaded from `conversation_summaries` as the 9th item in the existing `Promise.all`. `summariseContext` output extended with a `## Prior session summary` section when present.
- `lib/ai/agents/janet.ts` — imports `compressConversation`; fires it non-blockingly (no await) in `onFinish` after each turn.
- `tests/unit/ai/compression.test.ts` — 6 unit tests covering early-return conditions, LLM call shape, prior summary inclusion, upsert correctness, and error swallowing.
- `tests/integration/ai/compression.test.ts` — 2 integration tests covering LLM turn selection and upsert correctness with 25 turns.

## What changed
| File | Change |
|---|---|
| `lib/ai/patient-context.ts` | Added `conversationSummary` field to interface; added 9th DB read in Promise.all; extended `summariseContext` |
| `lib/ai/agents/janet.ts` | Added non-blocking `compressConversation` call in `onFinish` |

## Migrations applied
- `supabase/migrations/0030_conversation_summaries.sql`

## Deviations from plan
None identified. Implementation matches the plan specification.

## Known gaps / deferred items
- No LLM eval rubric for summary quality (deferred to eval-suites change).
- Model/temperature not asserted in unit tests — low risk, specified in implementation code.

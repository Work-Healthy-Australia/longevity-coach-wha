# QA Report: conversation-compression
Date: 2026-04-28
Reviewer: QA subagent

## Build status
pnpm build: PASS
pnpm test: PASS (173 tests across 25 test files)

## Test results
| Suite | Tests | Pass | Fail |
|---|---|---|---|
| tests/unit/ai/compression.test.ts | 6 | 6 | 0 |
| tests/integration/ai/compression.test.ts | 2 | 2 | 0 |

## Findings
### Confirmed working
- `compressConversation` returns early without an LLM call when total turns ≤ 20.
- Returns early without an LLM call when the summary is already current (last_compressed_turn_id matches the oldest surviving turn).
- Calls the LLM with only the old turns (total − 20) concatenated as context.
- Includes any prior rolling summary in the prompt when one already exists.
- Upserts the summary row with the correct `last_compressed_turn_id`.
- Swallows all errors silently — the function never throws, maintaining the non-blocking contract.
- Integration: with 25 turns, sends exactly turns 1–5 (the 5 surplus turns) to the LLM.
- Integration: upserts with `last_compressed_turn_id` equal to turn-5 (the last old turn).
- `PatientContext` loads `conversationSummary` in the same `Promise.all` as the other 8 DB reads.
- `summariseContext` emits a `## Prior session summary` section when the field is present.
- Janet fires `compressConversation` non-blockingly in `onFinish` — no await, no user-path latency.

### Deferred items
- No test currently verifies the Anthropic model used (claude-haiku-4.5) or temperature (0). Acceptable at this stage.
- No test covers the `## Prior session summary` section being absent when `conversationSummary` is null (implied by other coverage but not explicit).

### Known limitations
- `conversation_summaries` table migration (0030) must be applied to production before this feature is active; the code path is safe before migration because all DB errors are swallowed.
- Rolling summary quality depends entirely on the prompt. No automated rubric validates summary coherence — that is deferred to eval suites.

## Verdict
APPROVED

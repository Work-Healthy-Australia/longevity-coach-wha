# QA Report: eval-suites
Date: 2026-04-28
Reviewer: QA subagent

## Build status
pnpm build: PASS
pnpm test: PASS (173 tests across 25 test files)

## Test results
Eval suites are excluded from `pnpm test` by design (separate `vitest.eval.config.ts`). They run via `pnpm eval:janet`, `pnpm eval:sage`, and `pnpm eval:all` against the live Anthropic API.

| Suite | Tests | Pass | Fail |
|---|---|---|---|
| Unit / integration (pnpm test) | 173 | 173 | 0 |
| eval:janet (LLM eval — not run in CI) | 5 rubrics | n/a | n/a |
| eval:sage (LLM eval — not run in CI) | 4 rubrics | n/a | n/a |

## Findings
### Confirmed working
- `vitest.eval.config.ts` is correctly excluded from the default `pnpm test` run — no eval API calls occur in CI.
- `package.json` eval scripts (`eval:janet`, `eval:sage`, `eval:all`) are present and correctly point to the eval config.
- `lib/ai/pipelines/supplement-protocol.ts` — `buildPrompt` has been renamed and re-exported as `buildSagePrompt`; existing integration tests for the supplement protocol pipeline continue to pass (0 regressions).
- Fixtures (`SEED_PATIENT_CONTEXT`, `SEED_SUPPLEMENT_PLAN`) are structured to exercise real patient-context shapes without PII.
- `judgeOutput()` uses `generateText` directly with temperature 0 — deterministic judging behaviour.
- `writeEvalReport()` emits a stdout table, writes a JSON artifact, and exits with code 1 on failure — CI-compatible.

### Deferred items
- Eval suites require `ANTHROPIC_API_KEY` at runtime. They are intentionally excluded from the automated test run and must be triggered manually or via a scheduled CI job.
- No threshold configuration file exists yet; pass/fail is hardcoded per rubric. Threshold tuning is deferred.

### Known limitations
- LLM-as-judge accuracy depends on the judge model (Anthropic, temp 0). Rubric wording has not been reviewed by a clinical advisor.
- Memory rubric in `janet.eval.ts` relies on `recentConversation` being seeded in the fixture — any change to the fixture shape will break that rubric silently unless the eval is re-run.

## Verdict
APPROVED

# Changelog: eval-suites
Date: 2026-04-28
Phase: Phase 3

## What was built
- `tests/evals/fixtures/patient-context.fixture.ts` — `SEED_PATIENT_CONTEXT`: a synthetic 42-year-old male patient with cardiovascular score 72 and metabolic score 68, including a `recentConversation` array to exercise the memory rubric.
- `tests/evals/fixtures/supplement-plan.fixture.ts` — `SEED_SUPPLEMENT_PLAN`: 5-item supplement plan fixture used by the Sage eval.
- `tests/evals/judge.ts` — `judgeOutput()`: LLM-as-judge using `generateText` directly (not `createPipelineAgent`), Anthropic provider, temperature 0, returns a structured pass/fail + reasoning object.
- `tests/evals/runner.ts` — `writeEvalReport()`: writes a formatted stdout table, writes a JSON artifact to disk, and calls `process.exit(1)` when any rubric fails.
- `tests/evals/janet.eval.ts` — 5 scripted turns with rubrics: context utilisation, no hallucination, protocol grounding, tone, and memory.
- `tests/evals/sage.eval.ts` — 4 rubrics exercising `buildSagePrompt` directly: completeness, safety language, personalisation, and citation of supplement items.
- `vitest.eval.config.ts` — separate Vitest config for eval suites; excluded from the default `pnpm test` command.
- `package.json` — added `eval:janet`, `eval:sage`, and `eval:all` scripts.

## What changed
| File | Change |
|---|---|
| `lib/ai/pipelines/supplement-protocol.ts` | `buildPrompt` renamed and exported as `buildSagePrompt` |
| `package.json` | Three eval scripts added |

## Migrations applied
None.

## Deviations from plan
None identified.

## Known gaps / deferred items
- Eval pass/fail thresholds are hardcoded per rubric. A threshold config file is deferred.
- Eval suites are not run in automated CI; scheduling is deferred to a future CI pipeline update.
- Clinical review of rubric wording is deferred.

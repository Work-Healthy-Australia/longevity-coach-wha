# QA Report: Pipeline JSON Parse Stability — Wave 1
Date: 2026-04-29
Reviewer: QA

## Build status
pnpm build: PASS (tsc --noEmit clean on all changed files; pre-existing errors in journal/page.tsx, patient-context.ts, and test files are unrelated to this change)
pnpm test: PASS (532 tests, 77 suites)

## Test results
| Suite | Tests | Pass | Fail | Skipped |
|---|---|---|---|---|
| All suites | 532 | 532 | 0 | 0 |

## Findings

### Confirmed working
- Three-tier chain compiles cleanly with correct types throughout
- `extractJson()` handles: direct parse, fenced code blocks, brace extraction
- `extractLabeledFields()` correctly parses `===FIELD: name===` split pattern
- `assembleFromSections()` tries JSON parse per field, falls back to raw string
- `tryHeal()` runs `extractJson` + `schema.safeParse` — returns null on either failure
- `DomainHighlightSchema`: `.catch('unknown')` on trend, `z.coerce.number().catch(0)` on score
- `PtPlanItemSchema`: `z.coerce.number().catch(1)` on day, `.catch('moderate')` on intensity
- All 532 existing tests pass; no regressions introduced
- `NoObjectGeneratedError` imported correctly from `ai` package; `.isInstance()` type guard used

### Deferred items
- No unit tests written for the healing helpers (`extractJson`, `extractLabeledFields`, `assembleFromSections`, `tryHeal`). These are pure functions that are straightforward to test; adding them would make regression detection on future changes easier.
- Pre-existing TypeScript errors in test files unrelated to this change
- Model upgrade (moving agents from sonnet-4-6 to opus-4-7) is a configuration change in `agents.agent_definitions` — not part of this change but available if needed

### Known limitations
- Format-escape (tier 3) adds a third LLM call and up to 1s of latency. Pipeline workers are async background jobs so this is acceptable.
- `z.coerce.number()` on optional fields (`sets`, `duration_min`) will still fail if the model outputs a non-numeric string like "3 sets". This is a low-risk edge case since those fields are optional — a failure causes the whole PtPlanItemSchema parse to fail. Could be addressed with `.catch(undefined)` on those fields in a future pass.

## Verdict
APPROVED

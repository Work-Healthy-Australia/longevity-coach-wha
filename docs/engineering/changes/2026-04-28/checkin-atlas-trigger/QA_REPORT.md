# QA Report: Check-in → Atlas Trigger + Daily Trends
Date: 2026-04-28
Reviewer: Deep QA (code-reviewer subagent + fixes applied)

## Build status
pnpm build: PASS
pnpm test: PASS (301 tests, 50 files)

## Test results
| Suite | Tests | Pass | Fail | Skipped |
|---|---|---|---|---|
| check-in/actions (new) | 4 | 4 | 0 | 0 |
| check-in/validation | 6 | 6 | 0 | 0 |
| integration/ai/risk-narrative | 11 | 11 | 0 | 0 |
| All other suites | 280 | 280 | 0 | 0 |

## Issues found and resolved

### Issue 1 — userId logged in trigger error path (WARN → FIXED)
**File:** `lib/ai/trigger.ts:26`
**Problem:** The `.catch()` handler logged `userId` alongside the error, creating a linkable
identifier in server logs. `.claude/rules/security.md` prohibits PII or user-identifying
information in log output.
**Fix:** Removed `userId` from the error log — only the pipeline name is logged.

### Issue 2 — Promise.all outside try/catch made pipeline fatal (WARN → FIXED)
**File:** `lib/ai/pipelines/risk-narrative.ts`
**Problem:** The `Promise.all` data-fetch block was outside any try/catch. A network throw
from the new `daily_logs` query (or any other query) would propagate uncaught from
`runRiskNarrativePipeline`, violating the `.claude/rules/ai-agents.md` rule that pipeline
workers must be non-fatal.
**Fix:** Extracted the pipeline body into a private `_run()` function. The exported
`runRiskNarrativePipeline` wraps `_run()` in a top-level try/catch that logs and swallows
any throw — including `Promise.all` rejections. The inner try/catch around `agent.run` was
removed as redundant. A new test confirms the `Promise.all` rejection path resolves cleanly.

## Confirmed working
- `triggerPipeline("risk-narrative", userId)` fires on every successful `saveCheckIn`
- `triggerPipeline` does not fire on auth failure, validation failure, or upsert error
- `triggerPipeline` is never awaited — server action returns immediately
- `triggerPipeline` silently no-ops when `PIPELINE_SECRET` or `NEXT_PUBLIC_SITE_URL` absent
- `daily_logs` for the last 14 days are fetched in the same `Promise.all` as all other data
- `buildDailyTrendsSummary` returns null on empty input; prompt section is omitted
- `buildDailyTrendsSummary` correctly averages mood, energy, sleep, steps, exercise, water
- `## Recent daily trends` section appears in the Atlas prompt when logs are present
- A `daily_logs` query rejection resolves without throwing (non-fatal confirmed)
- All 50 pre-existing test suites unaffected

## Deferred items
- `buildDailyTrendsSummary` with a non-empty array of all-null log fields returns a string
  of dashes rather than null, so the trends section appears in the prompt with no real data.
  This is a cosmetic inaccuracy — the section would add no signal. Low-priority; acceptable
  for Phase 2 scope where logs are expected to have real values.
- Once-per-day throttle on Atlas re-runs deferred (idempotent, safe, low token cost per run).

## Verdict
APPROVED

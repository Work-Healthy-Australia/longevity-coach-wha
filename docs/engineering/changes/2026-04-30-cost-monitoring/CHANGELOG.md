# Changelog: Cost monitoring
Date: 2026-04-30
Phase: Epic 14 — Platform Foundation

## What was built
- `agent_usage` table — one row per Claude API call.
- `agent_cost_alerts` table — one row per breached daily-budget period.
- Pricing table for Opus 4.7 / Sonnet 4.6 / Haiku 4.5 with `costCents()` helper.
- Token capture in both `streamText` and `generateText` paths in `lib/ai/agent-factory.ts`.
- `/admin/cost` dashboard: today's spend, range total, daily totals, by-agent breakdown, recent failures, open alerts banner.
- Daily 01:00 UTC cron `/api/cron/cost-rollup` that sums yesterday's usage, upserts an alert row when over `COST_DAILY_BUDGET_USD` (default $50), and emails admins.

## Migrations applied
- `0063_agent_usage.sql` — telemetry tables, RLS, indexes.

## Files added
- `lib/ai/pricing.ts`, `lib/ai/usage.ts`
- `app/(admin)/admin/cost/page.tsx`
- `lib/email/cost-alert.ts`, `app/api/cron/cost-rollup/route.ts`
- `tests/unit/ai/pricing.test.ts` — 9 tests

## Files modified
- `lib/ai/agent-factory.ts` — token capture wrapped around the three pipeline tiers and the streaming `onFinish`. `userUuid` opt-in on `StreamingAgentOptions` for per-user spend reporting.
- `app/(admin)/layout.tsx` — Cost nav link.
- `vercel.json` — cron schedule.
- `.env.example` — `COST_DAILY_BUDGET_USD`.
- `tests/unit/ai/agent-factory.test.ts` — updated streaming test expectations (telemetry wrapper now always present).

## Deviations from plan
None.

## Known gaps / deferred items
- Pricing table is hand-maintained — schedule a quarterly check.
- No per-user spend caps (out of scope; could be next iteration).
- No retroactive backfill — telemetry is forward-looking.
- Cache-write tokens may report 0 on Vercel AI SDK responses where Anthropic didn't expose `cacheWriteTokens` — falls back to standard input pricing.

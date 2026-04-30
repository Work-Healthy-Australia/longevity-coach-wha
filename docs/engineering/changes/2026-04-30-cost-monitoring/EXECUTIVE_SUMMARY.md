# Executive Summary: Cost monitoring
Date: 2026-04-30
Audience: Product owner

## What was delivered
Every time a Longevity Coach AI agent calls Anthropic's Claude API, the system now records exactly how many tokens were used and what that call cost. James can visit a new admin page (`/admin/cost`) to see today's spend, last-week totals, a breakdown by agent (Janet, Atlas, Sage, etc.), and any recent failures. If a single day's spend exceeds the configured budget (default $50), an alert appears on the dashboard and an email is sent to admins.

## What this advances
Closes a Platform Foundation gap (Epic 14) that has been outstanding since the AI layer landed. We now have visibility and a budget guardrail before scaling member onboarding pushes Anthropic spend into a range where surprises matter.

## What comes next
- Set `COST_DAILY_BUDGET_USD` in Vercel (default $50 is conservative for current load).
- Watch the dashboard for a week — if no false-alarm alerts fire, we know the threshold is right.
- Optional next-iteration: per-user spend caps for free-tier protection.

## Risks or open items
- The pricing table is hand-maintained. If Anthropic changes prices, our cost numbers drift until we update `lib/ai/pricing.ts`. Quarterly check.
- Telemetry is forward-looking only — no backfill of historic spend.
- Cache-write tokens may report zero in some SDK responses; impact is small (cache writes are <5% of typical spend).

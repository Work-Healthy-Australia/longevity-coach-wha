# Plan: Anthropic API cost monitoring
Date: 2026-04-30
Phase: Epic 14 — Platform Foundation
Status: Approved (compact dev-loop — single implementer, no subagent fan-out)

## Objective
Capture every Claude API call's token usage and cost into a typed `agent_usage` table, surface daily/weekly spend on `/admin/cost`, and fire a budget-alert when daily spend exceeds a configured threshold. Telemetry must be non-fatal — never break a user-facing AI response.

## Scope
- In: token capture for `streamText` and `generateText` paths in `lib/ai/agent-factory.ts`; `agent_usage` table + RLS; cost computation from a pricing constants file; `/admin/cost` page with daily totals + per-agent breakdown; daily-budget cron that inserts a row into `agent_cost_alerts` (admin-visible).
- Out: per-user spend caps, retroactive backfill, MTD/YTD billing-cycle reporting, cost dashboards for non-Anthropic models. Stripe spend stays in Stripe.

## Data model
- New table `public.agent_usage` (typed columns — queryable):
  - `id uuid pk`, `created_at timestamptz`, `agent_slug text`, `model text`, `user_uuid uuid null` (nullable for system pipelines), `input_tokens int`, `output_tokens int`, `cache_read_tokens int`, `cache_write_tokens int`, `cost_usd_cents int`, `latency_ms int`, `success boolean`, `path text` (`stream` | `pipeline_t1` | `pipeline_t2` | `pipeline_t3`).
  - RLS: deny all to authenticated; service-role-only insert; admin select via `is_admin` policy.
- New table `public.agent_cost_alerts` (append-only):
  - `id`, `created_at`, `period_date date`, `cost_usd_cents int`, `threshold_usd_cents int`, `severity text`, `notes text`. Admin select; service-role insert.
- No PII in either — `user_uuid` is the one identifier and is FK-cascadable.

## Waves

### Wave 1 — Telemetry capture + admin dashboard
**What James can see:** every Claude call from this point on writes a row to `agent_usage`; he can visit `/admin/cost` and see today's spend, last-7-day trend, and per-agent breakdown.

Tasks:
1. Migration `0063_agent_usage.sql` — `agent_usage` and `agent_cost_alerts` tables + RLS + indexes on `(created_at desc)` and `(agent_slug, created_at desc)`.
2. `lib/ai/pricing.ts` — Claude model price table (USD/million tokens for input, output, cache read, cache write) for `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5`. Pure function `costCents(model, usage) → int`.
3. `lib/ai/usage.ts` — `recordUsage()` helper that inserts into `agent_usage` via admin client, swallowing any error.
4. Wire capture in `lib/ai/agent-factory.ts`:
   - Pipeline path: wrap each tier's `generateText` call, record on success and failure with `path: 'pipeline_t1' | 'pipeline_t2' | 'pipeline_t3'`.
   - Streaming path: capture in `onFinish` (extend `StreamingAgentOptions` to compose with caller's `onFinish`).
5. `/admin/cost/page.tsx` — server component pulling daily totals (today + last 7 days), per-agent breakdown, and recent failures. Range selector `?range=7d|30d|quarter`.
6. Add nav link in `app/(admin)/layout.tsx` between Agents and Clinicians.

### Wave 2 — Daily budget alert
**What James can see:** a daily cron rolls up yesterday's spend; if it crosses `COST_DAILY_BUDGET_USD` (env var, default $50), a row appears in `agent_cost_alerts` and an email goes to admins. The `/admin/cost` page surfaces unresolved alerts at the top.

Tasks:
1. `app/api/cron/cost-rollup/route.ts` — cron handler (CRON_SECRET-guarded) that sums yesterday's `cost_usd_cents` and inserts an `agent_cost_alerts` row when over budget.
2. `lib/email/cost-alert.ts` — Resend template "Daily Anthropic spend exceeded $X".
3. `vercel.json` cron entry: `0 1 * * *` (01:00 UTC, after midnight UTC roll).
4. `/admin/cost/page.tsx` — surface unresolved alerts at the top.

## Constraints applied
- `.claude/rules/ai-agents.md`: pricing capture must not block the user-facing response. All capture is fire-and-forget after the LLM call resolves. Prompt caching is preserved (we record cache_read/cache_write but do not interfere with system-prompt caching).
- `.claude/rules/security.md`: `recordUsage()` does NOT log prompt or completion text — only token counts and the agent slug. `user_uuid` is recorded as the one identifier (no name, email, etc.).
- `.claude/rules/database.md`: typed columns for everything queryable. Both tables have RLS enabled. Only `service_role` inserts.

## Risks / open items
- Vercel AI SDK v6 reports usage on `result.usage` (`inputTokens`, `inputTokenDetails.{cacheReadTokens, cacheWriteTokens}`, `outputTokens`). For some models or older runs, `inputTokenDetails` may be partial — code falls back to `inputTokens` only.
- Pricing table is hand-maintained — schedule a quarterly check.

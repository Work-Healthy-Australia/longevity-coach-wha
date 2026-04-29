# Changelog: Sprint 2 Engineering Completeness
Date: 2026-04-29
Phase: Phase 2 + Phase 3

## What was built

### Wave 1 — Foundation Fixes
- Renamed migration files `0031`→`0039`, `0032`→`0040` to resolve prefix collisions
- Added Playwright E2E and Lighthouse CI jobs to `.github/workflows/ci.yml`
- Added `.lighthouserc.json` (perf ≥ 0.8, a11y ≥ 0.9, best-practices ≥ 0.9)
- Added `repeat-tests` cron to `vercel.json` (`0 6 * * *`)
- Verified PDF report route and branded document already fully implemented

### Wave 2 — Agent Suite Completion
- PT plan pipeline worker: monthly 30-day exercise program generation stored in `training_plans`
- PT Coach real-time agent at `/api/chat/pt-coach` (slug: `pt_coach_live`)
- `consult_pt_coach` tool_use wired into Janet for exercise/fitness questions
- `ptPlan` parallel read added to `PatientContext`
- Latency structured logging in `janet.ts` (`event: janet_turn`, `patient_context_ms`, `total_ms`)
- Janet-Clinician Brief pipeline: monthly patient summary stored in `periodic_reviews`
- Janet eval: PT Coach grounding + supplement advisor grounding rubrics
- E2E Janet conversation loop test

### Wave 3 — Daily Return Features
- Personalised daily goals: `deriveGoals()` pure function; shown on `/check-in`
- Weekly insights digest: 3 pattern detectors; `/insights` page
- Health journal: `/journal` page; last 3 entries surfaced to Janet in context
- Rest-day streak mechanic: 1–2 missed days = rest, 3+ = streak reset; used on dashboard

### Wave 4 — Trust Layer
- Right-to-erasure: `DELETE /api/account` — scrubs PII, removes uploads, optional hard delete
- Account delete flow: two-step confirmation modal
- Pause/freeze account: `paused_at` column; proxy redirects paused users to `/account?paused=true`
- ToS data-use disclosure added to onboarding consent step
- Risk simulator E2E smoke test

## What changed

| File | Change |
|---|---|
| `supabase/migrations/0039_*`, `0040_*` | Renamed from 0031/0032 (collision fix) |
| `supabase/migrations/0041_training_plans_plan_name.sql` | Adds `plan_name`, `plan_start_date` + unique index |
| `supabase/migrations/0042_periodic_reviews_expand.sql` | Adds 9 new columns + unique index |
| `supabase/migrations/0043_daily_goals.sql` | Adds `profiles.daily_goals jsonb` |
| `supabase/migrations/0044_journal.sql` | Creates `journal_entries` table with RLS |
| `supabase/migrations/0045_profile_pause.sql` | Adds `profiles.paused_at timestamptz` |
| `.github/workflows/ci.yml` | Playwright + Lighthouse CI jobs |
| `vercel.json` | 5 cron entries (added pt-plan, clinician-briefs) |
| `lib/ai/patient-context.ts` | Added ptPlan + journalEntries parallel reads |
| `lib/ai/agents/janet.ts` | Added latency logging + consult_pt_coach tool |
| `lib/ai/agents/pt-coach.ts` | New PT Coach streaming agent |
| `lib/ai/tools/pt-coach-tool.ts` | New PT Coach tool_use for Janet |
| `lib/ai/pipelines/pt-plan.ts` | New PT plan pipeline worker |
| `lib/ai/pipelines/clinician-brief.ts` | New clinician brief pipeline worker |
| `lib/goals/derive.ts` | `deriveGoals()` pure function |
| `lib/insights/weekly.ts` | `generateWeeklyInsights()` pattern detector |
| `lib/streaks/index.ts` | `calculateStreak()` with rest-day tolerance |
| `lib/supabase/proxy.ts` | Pause redirect logic (fail-open) |
| `app/(app)/account/` | Delete flow + pause/unfreeze UI |
| `app/(app)/onboarding/onboarding-client.tsx` | ToS data-use disclosure |

## Migrations applied

| Number | File | Purpose |
|---|---|---|
| 0039 | `0039_patient_uploads_file_hash.sql` | Renamed from 0031 |
| 0040 | `0040_seed_admins.sql` | Renamed from 0032 |
| 0041 | `0041_training_plans_plan_name.sql` | `plan_name`, `plan_start_date` + unique index |
| 0042 | `0042_periodic_reviews_expand.sql` | `janet_brief`, `review_month`, `review_status` etc. |
| 0043 | `0043_daily_goals.sql` | `profiles.daily_goals jsonb` |
| 0044 | `0044_journal.sql` | `journal_entries` table + RLS |
| 0045 | `0045_profile_pause.sql` | `profiles.paused_at timestamptz` |

## Deviations from plan

- W2-4 (supplement-advisor-tool) was skipped — already implemented in a prior session
- `database.types.ts` uses `as any` casts for `journal_entries` and new `periodic_reviews` columns until `supabase gen types` can run against the applied migrations
- Janet eval W2-6: `SEED_PATIENT_CONTEXT.ptPlan` is `null` — PT Coach rubric tests against a context with no plan (structurally correct but will score low until fixture is enriched)

## Known gaps / deferred items

- `supabase gen types typescript --local` should be run after applying all 7 migrations to clean up the `as any` casts
- PT Coach eval fixture: enrich `ptPlan` in `patient-context.fixture.ts` for meaningful PT grounding scores
- Journal E2E test: `/journal` not yet covered by Playwright (only unit-tested)
- `ENABLE_HARD_DELETE=true` must be explicitly set in production Vercel env to enable auth user deletion

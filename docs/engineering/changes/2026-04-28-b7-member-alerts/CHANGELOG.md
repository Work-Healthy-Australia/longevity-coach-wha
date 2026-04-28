# Changelog: B7 — Member alerts
Date: 2026-04-28
Phase: Epic 8 (The Living Record), pre-approved sprint-1 stretch

## What was built

- **`public.member_alerts` table.** Append-mostly, per-user alert surface. Columns: `id`, `user_uuid`, `alert_type` (`'lab_out_of_range' | 'repeat_test'`), `severity` (`'info' | 'attention' | 'urgent'`), `source_id`, `title`, `body`, `link_href`, `status` (`'open' | 'dismissed' | 'resolved'`), `created_at`, `dismissed_at`, `resolved_at`. RLS owner-select + owner-update; service-role-only insert. Unique partial index `(user_uuid, alert_type, source_id) where status='open'` enforces idempotent re-runs.
- **Pure evaluators in `lib/alerts/`:**
  - `evaluateLabAlerts(rows)` — flags `low`/`high`/`critical` lab readings. Suppresses `optimal`/`borderline` for noise control. Severity tiebreak via `(test_date desc, id desc)`.
  - `evaluateRepeatTests({ recommendedScreenings, recentLabBiomarkers })` — emits `repeat_test` alerts when an Atlas-recommended screening has no recent matching biomarker on file. Uses **whole-token matching** against a `SCREENING_KEYWORDS` map (no `String.includes` substring foot-guns).
  - `chipPayload(alert)` — picks tone/title/body/link for the dashboard chip.
- **Daily cron `app/api/cron/repeat-tests/route.ts`.** `Authorization: Bearer ${CRON_SECRET}` gating (canonical pattern). Reads each user's latest `risk_scores.recommended_screenings`, fetches their distinct biomarkers from the last 12 months, calls `evaluateRepeatTests`, pre-filters drafts against existing open alerts, bulk-inserts fresh ones. Per-user try/catch — one failure does not abort the batch. Returns `{ ok, scanned, emitted, failed }`.
- **Upload-flow hook in `app/(app)/uploads/actions.ts`.** After Janet's analysis succeeds, runs `evaluateLabAlerts` against the user's full `lab_results` rows; pre-filters against existing open alerts; bulk-inserts fresh drafts. Wrapped in try/catch — never blocks the upload response. **Defensive today** because no Janet → `lab_results` converter exists yet; fires automatically the moment one does.
- **Dashboard hero chip.** Most-recent open alert renders above the today-strip with three severity tones (`info` sage, `attention` amber, `urgent` red), `View →` link to `link_href`, and a `Dismiss` form posting to a server action. Server-rendered; no client component.
- **Dismiss server action** at `app/(app)/dashboard/_actions/dismiss-alert.ts`. Authenticates the user, updates `status='dismissed'` + `dismissed_at`, calls `revalidatePath('/dashboard')`.

## What changed

- `supabase/migrations/0031_member_alerts.sql` (new) — table + RLS + 2 indexes (idempotent).
- `lib/alerts/evaluate-lab-alerts.ts` (new).
- `lib/alerts/evaluate-repeat-tests.ts` (new) — whole-token matching, `SCREENING_KEYWORDS` map.
- `lib/alerts/format-alert.ts` (new).
- `lib/alerts/types.ts` (new) — `AlertSeverity`, `AlertDraft`.
- `lib/alerts/index.ts` (new) — re-exports.
- `lib/supabase/database.types.ts` — `member_alerts` block inserted (kept the rest of the hand-maintained file intact rather than overwriting via `--linked` typegen, which would surface unrelated `agent_conversations` schema drift).
- `app/api/cron/repeat-tests/route.ts` (new) — `GET` + `POST`, `runtime="nodejs"`, `dynamic="force-dynamic"`. Pure helpers `selectLatestPerUser` and `filterAlreadyOpen` exported for testing.
- `app/(app)/uploads/actions.ts` — added imports for `createAdminClient`, `evaluateLabAlerts`, `LabRow`; added best-effort B7 hook after the supplement-protocol pipeline trigger.
- `app/(app)/dashboard/page.tsx` — added `latestAlert` query and chip render block; imports `dismissAlert`.
- `app/(app)/dashboard/dashboard.css` — added 9 new selectors for the chip, three severity tones, and inner button/link styling. Reused existing palette tokens.
- `app/(app)/dashboard/_actions/dismiss-alert.ts` (new) — server action.
- `tests/unit/alerts/evaluate-lab-alerts.test.ts` (new) — 8 cases.
- `tests/unit/alerts/evaluate-repeat-tests.test.ts` (new) — 6 cases including whole-token false-positive guard.
- `tests/unit/alerts/format-alert.test.ts` (new) — 2 cases.
- `tests/unit/alerts/route-helpers.test.ts` (new) — 4 cases.

## Migrations applied

- `0031_member_alerts.sql` — applied to remote (project `Longevity-Coach`, ref `raomphjkuypigdhytbzn`) via the Supabase MCP during this change.

## Deviations from plan

- **Migration number is `0031`, not `0022`** as the original `plan-non-ai.md` said. The chain has moved on since that doc was written. No functional impact.
- **Cron auth is `Authorization: Bearer ${CRON_SECRET}`**, not the custom `x-pipeline-secret` header used in some plan text. Matches `drip-emails` and `nova` canonical pattern (per Phase 4 review addendum #1).
- **`onConflict: 'ignore'` is not a real Supabase API.** Conflict handling uses a deterministic JS pre-filter against existing open alerts (per Phase 4 review addendum #4). The unique partial index remains the safety net.
- **Types maintained by hand** rather than full `--linked` typegen, to avoid surfacing the pre-existing `agent_conversations` `public` vs `agents` schema drift. Same approach used in B4 / C2 changes.

## Known gaps / deferred items

- **Janet → `lab_results` writer.** The biggest follow-up. Without it, the upload hook is a no-op for most users — lab alerts cannot fire today. Repeat-test alerts CAN fire today (cron path).
- Vercel `vercel.json` cron registration. Operator step.
- Cron parallelisation. Sequential per-user is fine for today's user count; chunking via `Promise.all` with concurrency cap is the documented next step.
- Snooze / dismiss-suppression window. A dismissed alert CAN be re-surfaced by a later cron run; intended but flagged for future tightening.
- Auto-resolve when next reading is back in range — separate change.
- `/alerts` index / triage page — separate change.
- Push / SMS / email delivery of alerts — separate change.
- Borderline-tone alerts deliberately suppressed (noise control); revisit if member feedback says we're missing too much.

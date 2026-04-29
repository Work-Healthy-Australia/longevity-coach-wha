# QA Report: B7 — Member alerts
Date: 2026-04-28
Reviewer: dev-loop coordinator

## Build status
- `pnpm build`: PASS (only pre-existing Turbopack workspace-root warning).
- `pnpm test`: PASS — 317 tests across 53 suites, 0 failures, 0 skipped.

## Test results

| Suite | Tests | Pass | Fail | Skipped |
|---|---:|---:|---:|---:|
| `tests/unit/alerts/evaluate-lab-alerts.test.ts` | 8 | 8 | 0 | 0 |
| `tests/unit/alerts/evaluate-repeat-tests.test.ts` | 6 | 6 | 0 | 0 |
| `tests/unit/alerts/format-alert.test.ts` | 2 | 2 | 0 | 0 |
| `tests/unit/alerts/route-helpers.test.ts` | 4 | 4 | 0 | 0 |
| (other) | 297 | 297 | 0 | 0 |
| **Total** | **317** | **317** | **0** | **0** |

Total new tests for B7: **20** (target was ≥14).

## Findings

### Confirmed working
- Migration `0031_member_alerts.sql` applied to remote. RLS owner-select + owner-update; service-role-only insert; unique partial index `(user_uuid, alert_type, source_id) where status='open'`; `member_alerts_user_status_idx` for the dashboard query.
- `lib/supabase/database.types.ts` includes `member_alerts` typed end-to-end. No `as never` casts in the new code.
- `lib/alerts/` pure helpers in place: `evaluateLabAlerts`, `evaluateRepeatTests`, `chipPayload`, plus `SCREENING_KEYWORDS` map.
- `evaluateRepeatTests` uses **whole-token matching** via `Set` lookup against tokenised biomarker names (addendum #2). False-positive guard test: screening "thyroid panel" against biomarker "thyroglobulin" → not covered.
- Screening normalisation + dedupe at the cron route (addendum #3).
- Severity tiebreak: latest row picked by `(test_date desc, id desc)` for deterministic outcome on same-day rows.
- `app/api/cron/repeat-tests/route.ts` gated by `Authorization: Bearer ${CRON_SECRET}` (addendum #1, canonical pattern matching `drip-emails` and `nova`).
- Pure helpers `selectLatestPerUser` + `filterAlreadyOpen` extracted from the cron route and unit-tested (addendum #4 — deterministic JS pre-filter, no fictitious `onConflict: 'ignore'`).
- Upload-flow hook in `app/(app)/uploads/actions.ts` runs `evaluateLabAlerts` against the user's `lab_results` rows and inserts only fresh drafts after pre-filtering against existing open alerts. Wrapped in try/catch — failure cannot block the upload response.
- Dashboard chip query reads `member_alerts` via the user-context client (RLS enforced). Chip renders directly under the hero, above the today-strip.
- Dismiss server action via `<form action={dismissAlert}>` updates `status='dismissed'` + `dismissed_at` and revalidates `/dashboard`.
- Three severity-tone CSS classes (`info` sage, `attention` amber, `urgent` red) reuse existing palette tokens.
- Cron is sequential per-user with try/catch — one user's failure does not abort the batch. Top-of-file note flags chunking as the next-step optimisation.

### Deferred items
- **Janet → `lab_results` writer.** Today the upload hook is a defensive no-op for most users because Janet writes free-text JSONB into `patient_uploads.janet_findings`, not structured rows in `biomarkers.lab_results`. The hook is wired correctly; the moment a converter ships, lab alerts will fire automatically.
- Vercel cron registration (`vercel.json` `crons` block) is an operator step. Route is ready.
- Cron parallelisation when user count grows. Sequential is fine today; chunking with concurrency cap is the documented follow-up.
- Snooze / dismiss-suppression-window mechanism. A dismissed row CAN be re-surfaced by a later cron run — intended but flagged in the plan.
- Auto-resolve when next reading is back in range — separate change.
- `/alerts` index / triage page — separate change.
- Push / SMS / email delivery — separate change.

### Known limitations
- Lab alerts are blocked on Janet's findings being structured into `lab_results`. Repeat-test alerts fire today; lab alerts will start firing the moment that converter exists.
- `SCREENING_KEYWORDS` covers the common screenings Atlas emits today (thyroid, lipid, kidney, liver, iron, hba1c, fasting glucose, vitamin d, b12, homocysteine, inflammatory). Falls back to tokenising the screening string itself for unknown screenings; not perfect but conservative (false negatives → re-prompt members; false positives suppressed by whole-token matching).
- Cron auth lets requests through when `CRON_SECRET` is unset — matches existing convention so dev/preview don't need the secret to test, but operator must set the env var in production.

## Verdict
APPROVED — both tasks passed inline reviews; build + full suite green; migration applied and types updated.

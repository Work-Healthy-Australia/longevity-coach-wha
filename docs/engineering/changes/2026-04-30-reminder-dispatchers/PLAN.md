# Plan: Push/email reminder dispatchers
Date: 2026-04-30
Phase: Epic 7 (Daily Return) + Epic 11 (Trust Layer)
Status: Approved (compact dev-loop)

## Objective
Three new cron handlers — daily check-in nudge, weekly progress digest, member-alert email — wired to Resend, idempotent, opt-out aware, and respecting `profiles.paused_at`.

## Scope
- In: cron handlers + email templates + idempotency + per-user prefs.
- Out: SMS, push notifications (web push / mobile), in-app inbox separate from `member_alerts`.

## Data model
New table `public.notification_prefs` (typed columns):
- `user_uuid uuid pk` (FK auth.users on cascade delete)
- `check_in_reminders boolean default true`
- `weekly_digest boolean default true`
- `alert_emails boolean default true`
- `last_check_in_reminder_sent_at timestamptz null`
- `last_weekly_digest_sent_at timestamptz null`
- `updated_at timestamptz default now()`

RLS: owner select+update; service-role insert+update. Idempotency: cron handlers update `last_*_sent_at` to gate dispatch.

`member_alerts` adds `email_sent_at timestamptz null` for alert-email idempotency.

## Waves

### Wave 1 — Check-in reminder
**What James can see:** a member who's been registered ≥1 day, has not logged a check-in in the last 36 hours, has `check_in_reminders=true`, and is not paused, gets a nudge email each day at 09:00 UTC. The email links to `/check-in`. Members can toggle the preference at `/account`.

Tasks:
1. Migration `0064_notification_prefs.sql` — new table + RLS + default-row backfill for existing users + `member_alerts.email_sent_at` column.
2. `lib/email/check-in-reminder.ts` — Resend template.
3. `app/api/cron/check-in-reminder/route.ts` — daily handler. Selects eligible profiles → sends → stamps `last_check_in_reminder_sent_at`.
4. `vercel.json` — schedule `0 9 * * *`.
5. `/account` — preferences card with three toggles (check-in, digest, alert-email) wired to a server action.

### Wave 2 — Weekly digest + alert-email
**What James can see:** every Monday 08:00 UTC each opted-in member gets a one-paragraph digest of their week (avg sleep, mood, days logged, alerts). Whenever a `member_alerts` row is created with `alert_emails=true` and the alert hasn't been emailed, a daily cron flushes pending alerts to email and stamps `email_sent_at`.

Tasks:
1. `lib/email/weekly-digest.ts` — Resend template. Reads from `biomarkers.daily_logs` + `member_alerts`.
2. `app/api/cron/weekly-digest/route.ts` — Monday handler.
3. `lib/email/alert-notification.ts` — Resend template. One email per `member_alerts` row, body uses `title` and `body` from the row, link uses `link_href`.
4. `app/api/cron/alert-notification/route.ts` — runs every 4 hours; picks up open alerts where `email_sent_at is null` and `notification_prefs.alert_emails = true` and `paused_at is null`, sends, stamps `email_sent_at`.
5. `vercel.json` — schedule both.

## Constraints applied
- All handlers CRON_SECRET-guarded (existing pattern).
- All Resend calls wrapped — silently no-op if `RESEND_API_KEY` unset.
- Never send to a paused account (`profiles.paused_at is not null` filter).
- `notification_prefs` row is created lazily (default `true` for all three) so legacy users still receive reminders but can opt out.
- No PII outside `profiles` — `notification_prefs` keys on `user_uuid` only.

## Risks
- Daily-logs query for digest scales O(N members × 7 days). Acceptable at current pilot scale; revisit at 10k members.
- Email burst on Monday morning — Resend free tier handles 100/sec, well above current pilot.

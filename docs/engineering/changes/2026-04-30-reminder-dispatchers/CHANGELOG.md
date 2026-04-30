# Changelog: Reminder dispatchers
Date: 2026-04-30
Phase: Epic 7 (Daily Return) + Epic 11 (Trust Layer)

## What was built
- `notification_prefs` table — one row per user with three opt-in toggles (`check_in_reminders`, `weekly_digest`, `alert_emails`) and last-sent timestamps.
- `member_alerts.email_sent_at` column for alert-email idempotency.
- `/account` Notifications card with three live toggles (server action upserts on change).
- Three new cron handlers under `app/api/cron/`:
  - `check-in-reminder` — daily 09:00 UTC. Nudges members who haven't logged in 36h.
  - `weekly-digest` — Mondays 08:00 UTC. One-paragraph summary of last week's averages and open alerts.
  - `alert-notification` — every 4 hours. Emails any open `member_alerts` row that hasn't been emailed yet.
- Three new Resend email templates with consistent unsubscribe link to `/account`.

## Migrations applied
- `0064_notification_prefs.sql` — prefs table, RLS, default-true backfill, `member_alerts.email_sent_at`.

## Files added
- `lib/email/check-in-reminder.ts`, `lib/email/weekly-digest.ts`, `lib/email/alert-notification.ts`
- `app/api/cron/check-in-reminder/route.ts`, `app/api/cron/weekly-digest/route.ts`, `app/api/cron/alert-notification/route.ts`
- `app/(app)/account/notification-actions.ts`, `app/(app)/account/_components/NotificationPrefs.tsx`

## Files modified
- `app/(app)/account/page.tsx` — Notifications section.
- `vercel.json` — three cron schedules.

## Deviations from plan
None.

## Known gaps / deferred items
- No SMS, no web push, no mobile push. Email-only, by design.
- `weekly-digest` handler scales O(N members × 7 days). Acceptable at pilot scale; revisit at 10k members.
- New users created after `0064` don't get a `notification_prefs` row automatically — handlers default to opt-in if no row exists, and the toggle action upserts. Could add a trigger if the lazy-create pattern proves noisy.
- All emails respect `profiles.paused_at` and the per-user opt-out, but there's no global "stop all marketing email" kill switch. If we add a marketing/operational distinction later, this layer slots underneath it.

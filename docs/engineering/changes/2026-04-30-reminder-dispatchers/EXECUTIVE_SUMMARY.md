# Executive Summary: Reminder dispatchers
Date: 2026-04-30
Audience: Product owner

## What was delivered
Members now receive three kinds of email automatically. A daily nudge if they haven't logged a check-in in over a day. A Monday morning digest with their averages from the prior week. An email whenever a new health alert appears on their dashboard (e.g. an out-of-range lab result). Each email links to the right page, and every member can switch any of the three off from a new "Notifications" card at the bottom of `/account`. Paused accounts receive no emails.

## What this advances
Closes the final gap on Epic 7 (Daily Return) — daily check-in reminders were the last bundled feature outstanding. Also gives Epic 11 (Trust Layer) the email channel for `member_alerts`, which until now lived only in-app.

## What comes next
- Watch the open-rate and unsubscribe-rate on the three email types over the first two weeks. If unsubscribe rate is over 5%, the cadence is too aggressive and we tune.
- Optional follow-on: SMS for urgent alerts only (lab values out of critical range). Out of scope here.

## Risks or open items
- Resend free tier limits: 100 emails/sec, 3000/day. Current pilot well below; bump to paid plan when active members exceed ~500.
- No web push or mobile push channels yet — email only.
- All three email types default to opt-in for legacy users (the migration backfills a `true, true, true` row for every existing profile). If anyone has previously asked to never be emailed, we should record that and pre-populate `false` before the first cron run.

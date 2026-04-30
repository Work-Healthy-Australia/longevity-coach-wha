# Disaster recovery drill — Supabase point-in-time restore

This runbook covers the only DR scenario we currently care about: recovering patient data from a destructive incident (bad migration, accidental mass delete, ransomware, region outage).

The drill must be run **once per quarter**. A drill that has not been executed in 90 days is treated as untested and the on-call engineer is paged.

## Scope

- **Recoverable:** `auth`, `public`, `biomarkers`, `billing`, `agents` schemas in the production Supabase project. Storage objects (patient uploads, generated PDF reports).
- **Not in scope:** Stripe customer/subscription state (Stripe is the source of truth — re-sync via webhook replay), Resend message log (transient), Sentry events.

## Recovery objectives

| Metric | Target |
|---|---|
| RPO (max data loss) | 1 hour |
| RTO (time to restore) | 4 hours |

Supabase Pro gives us 7-day PITR by default. Bump to the longer retention add-on before any major migration.

## Prerequisites

- Supabase access token with `project:write` for the production project.
- `supabase` CLI ≥ 1.140.
- Read access to the [Supabase project dashboard](https://supabase.com/dashboard) for the `longevity-coach` org.
- The current production project ref (stored in 1Password under "Supabase prod project").
- A dedicated **DR scratch project** in the same org, used as the restore target so production stays live during the drill.

## Quarterly drill procedure

### 1. Pick a target timestamp

Choose a timestamp ~24 h in the past during a low-traffic window. Record it in the drill log (see template below).

### 2. Restore into the scratch project

In the Supabase dashboard for the **scratch project** → Settings → Database → Point in Time Recovery → "Restore from another project":

- Source project: production
- Target time: the timestamp from step 1
- Confirm.

Restore typically takes 10–30 min for our current data volume. Capture the start and end times.

### 3. Verify schema and row counts

Once the scratch project is up, connect with `psql` (connection string from Settings → Database) and run:

```sql
-- Schema sanity
\dn

-- Row counts (compare to baseline taken at the timestamp)
select 'profiles' as t, count(*) from public.profiles
union all select 'health_profiles', count(*) from public.health_profiles
union all select 'risk_scores', count(*) from public.risk_scores
union all select 'consent_records', count(*) from public.consent_records
union all select 'erasure_log', count(*) from public.erasure_log
union all select 'lab_results', count(*) from biomarkers.lab_results
union all select 'daily_logs', count(*) from biomarkers.daily_logs
union all select 'subscriptions', count(*) from billing.subscriptions;
```

Compare against the baseline counts captured immediately before the drill in production.

### 4. Verify a known patient round-trips

Pick one test user (the disposable `dr-drill+YYYYMMDD@longevity-coach.io` account — create one quarterly if it doesn't exist) and confirm:

- `profiles` row present with expected `full_name`, `date_of_birth`.
- `health_profiles.responses` JSONB matches the expected shape (`basics`, `medical`, `family`, `lifestyle`, `goals`, `consent`).
- A consent record exists for the latest privacy policy version.
- A `lab_results` row exists with the expected biomarker values.

### 5. Verify storage bucket

Patient uploads bucket — confirm at least one known file is downloadable from the scratch project's storage and the SHA-256 matches the recorded hash.

### 6. Tear down

Pause the scratch project (don't delete — keep it for forensics until next drill). Note the restore duration in the drill log.

## Real-incident playbook

If this is **not a drill** and production is compromised:

1. **Freeze writes immediately.** Disable the production Vercel deployment (`vercel --prod --force` to a maintenance branch, or pause the project in dashboard).
2. **Identify the bad timestamp.** When did the destructive event start? Use Supabase audit logs and `git log supabase/migrations/`.
3. **Decide: restore-in-place vs restore-to-scratch.** Restore-in-place is faster but irreversible. Restore-to-scratch lets us verify before swapping — preferred unless RTO is critical.
4. **Restore** following steps 2–5 above against the production project (or scratch).
5. **Replay Stripe webhooks** for the gap window using the Stripe dashboard "Resend events" feature so subscription state catches up.
6. **Communicate.** Email all members within 4 h of incident detection per the AHPRA notifiable data-breach window. Template at `docs/operations/breach-comms-template.md` (TODO).
7. **Post-mortem within 5 business days.** Document in `docs/operations/incidents/YYYY-MM-DD-slug.md`.

## Drill log

Every drill appends an entry here with: date, who ran it, target timestamp, restore duration, schema verification outcome, row-count delta, anomalies, and time-to-tear-down.

| Date | Run by | RPO target | Restore duration | Schema OK? | Row counts match? | Notes |
|---|---|---|---|---|---|---|
| _next: 2026-07-31_ | _TBD_ | 1 h | _TBD_ | _TBD_ | _TBD_ | First drill. |

## Known gaps

- No automated row-count baseline — currently manual. Open work: cron job that snapshots row counts hourly into a `dr_baseline` table.
- No paging for "drill not run in 90 days" — currently calendar-only. Open work: GitHub Action that opens an issue when last drill > 80 days old.
- Breach-communications email template not yet drafted.

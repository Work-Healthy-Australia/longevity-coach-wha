# Plan: Re-enable pgTAP RLS regression on PR triggers

Date: 2026-05-04
Phase: Phase 1 — Foundation (v1.1 backlog, CI re-enable PR-B of 2)
Status: Draft

## Objective

Move the pgTAP RLS regression job from `extended-ci.yml` (workflow_dispatch only) to `ci.yml`, so every PR runs the 20-assertion RLS suite (`supabase/tests/rls.sql`) against a fresh Postgres + 71 migrations.

The blocker called out in the workflow comment: bare `supabase/postgres` image lacks `auth.uid()` / `auth.jwt()` / `auth.role()` helper functions (those normally come from GoTrue at runtime). Without them, RLS policies referencing `auth.uid()` fail to apply — and almost every migration creates such a policy.

## Scope

**In scope:**
- New `supabase/tests/_ci_bootstrap.sql` — installs CI-only stubs of `auth.uid()`, `auth.jwt()`, `auth.role()` that read from the `request.jwt.claims` GUC (the same GUC the pgTAP tests already set via `set local`)
- `.github/workflows/ci.yml` — add `pgtap` job after `lighthouse`, applies bootstrap before migrations
- `.github/workflows/extended-ci.yml` — remove `pgtap` job + its block in the documentation header

**Out of scope:**
- Playwright E2E re-enable — needs your test Supabase project + secrets
- Adding new pgTAP assertions for the role system (PR #113) or admin features — separate cleanup
- Lighthouse re-enable — already shipped in PR #140

## Data model changes

None.

## Waves

### Wave 1 — Add pgtap job to ci.yml + auth-helper bootstrap (single wave)

**What James can see after this wave merges:** Every PR run shows a "pgTAP RLS regression" job alongside the other CI gates. First few runs may surface real assertion failures or migration failures — those become follow-up PRs.

#### Task 1.1 — Auth-helper CI bootstrap

Files affected:
- `supabase/tests/_ci_bootstrap.sql` (new)

What to build:
- `auth.uid()` returns uuid, reads `current_setting('request.jwt.claim.sub') OR current_setting('request.jwt.claims')::jsonb ->> 'sub'`
- `auth.jwt()` returns jsonb, reads `current_setting('request.jwt.claim') OR current_setting('request.jwt.claims')`
- `auth.role()` returns text, reads `current_setting('request.jwt.claim.role') OR current_setting('request.jwt.claims')::jsonb ->> 'role'`
- All three use `create or replace` for idempotency

#### Task 1.2 — Move pgtap job to ci.yml

Files affected:
- `.github/workflows/ci.yml`
- `.github/workflows/extended-ci.yml`

What to build:
- Add `pgtap` job to `ci.yml` after `lighthouse`
- Job structure copied from `extended-ci.yml` with one new step inserted between "Enable required extensions" and "Apply migrations": "Apply CI auth-helper bootstrap" runs `psql -f supabase/tests/_ci_bootstrap.sql`
- Remove `pgtap` block from `extended-ci.yml` (job + the doc-comment block at the top)

## Known risk

This is a **first-time end-to-end run of all 71 migrations against a bare Postgres image**. Failure modes I'd expect:
- A migration assumes some Supabase-specific function or extension we haven't stubbed (e.g. `vault`, `pgsodium`)
- A migration references `auth.users` rows that don't exist (insertion needed for FK)
- A pgTAP assertion is stale because RLS policies have evolved since last run (PR #113 role system, etc.)

Each of these would surface as a clear failure in the workflow log; address per-finding via follow-up PRs (mirror the Lighthouse re-enable iteration model).

-- ============================================================================
-- CI bootstrap — auth helper stubs for pgTAP regression
--
-- The pgTAP RLS suite runs against a bare supabase/postgres image which
-- ships the `auth` schema and `auth.users` table but does NOT pre-create
-- the auth.uid() / auth.jwt() / auth.role() helper functions (those are
-- normally installed by the GoTrue auth service when supabase start runs
-- the full local stack).
--
-- Without these functions, every migration that creates an RLS policy
-- like `using (auth.uid() = id)` fails with `function auth.uid() does not
-- exist`. These stubs read from the `request.jwt.claims` GUC which the
-- pgTAP tests set via `set local "request.jwt.claims" = '{...}'` before
-- each role-impersonation block.
--
-- KNOWN INCOMPLETE — bootstrap is only enough to get past the first batch
-- of migrations. Migration 0006 then fails on storage.buckets.public,
-- and later migrations likely need vault / realtime schemas. A full fix
-- requires either the Supabase CLI in CI or a real test Supabase project.
-- See PR #142 (closed) for the iteration that surfaced this.
--
-- Apply ONCE before running any migration. The functions are idempotent
-- (`create or replace`) so re-running the workflow is safe.
-- ============================================================================

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text;
$$;

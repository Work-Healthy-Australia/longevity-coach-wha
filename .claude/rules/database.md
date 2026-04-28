# Database Rules

---

## Migrations

All schema changes go through numbered SQL migration files in `supabase/migrations/`.

Rules:
- Name format: `NNNN_short_description.sql` where NNNN is the next sequential number.
- Every migration must be idempotent: use `IF NOT EXISTS`, `IF EXISTS`, `ON CONFLICT DO NOTHING`.
- Never modify a migration that has already been applied to production. Write a new one.
- Run `supabase db diff` locally before committing a migration to verify the diff matches intent.
- After adding a migration, regenerate TypeScript types: `supabase gen types typescript --local > lib/supabase/database.types.ts`

---

## Row-level security

- RLS is enabled on every table. Never disable it.
- `service_role` bypasses RLS by Supabase default — only use the admin client where explicitly required (webhooks, risk engine writes, PDF generation).
- Patient data is never readable by another patient. User policies use `auth.uid() = user_uuid`.
- Clinicians can read only the patients who have granted them access. Do not add clinician-read policies without a matching `care_team_access` row.

---

## Supabase key naming

The project uses Supabase's new key naming convention:

| Purpose | Env var | Old name (deprecated) |
|---|---|---|
| Client-side | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Server-side service role | `SUPABASE_SECRET_KEY` | `SUPABASE_SERVICE_ROLE_KEY` |

Do not use the old names — they are being deprecated by Supabase.

---

## Schema boundaries

- `public` schema: identity, consent, clinical records, programs, and anything that joins across schemas.
- `biomarkers` schema: all patient health measurements — lab results, uploaded files, biological age tests, daily logs.
- `billing` schema: subscriptions, plans, add-ons, organisations, suppliers, products. Will become a standalone billing platform in Phase 2.

Cross-schema queries are acceptable but foreign keys must be explicit. Avoid implicit coupling between schemas.

---

## JSONB vs typed columns

Use JSONB only for data that is truly opaque — free-text answers, flexible multi-select arrays, or content that will never be directly queried by the application or the risk engine.

Use typed columns for anything that will be filtered, sorted, compared, aggregated, or indexed. See `.claude/rules/data-management.md` Rule 3 for full guidance.

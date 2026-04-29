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

**Bundle small changes — no single-statement migration files.** A migration that adds one column to one table is too small to stand alone. Group related column additions for the same feature into one migration file. Single-statement files create noise in the migration log and make rollbacks harder to reason about. Minimum useful migration: one complete feature slice (e.g. all columns + indexes for a new workflow, not `add column if not exists paused_at timestamptz` in isolation).

---

## Canonical schema definitions

Alongside the sequential migration files, maintain a human-readable canonical schema at:

```
supabase/schema/<schema>/[tables|functions|views|extensions]/<entity-name>.sql
```

Examples:
```
supabase/schema/public/tables/profiles.sql
supabase/schema/public/tables/training_plans.sql
supabase/schema/public/functions/handle_new_user.sql
supabase/schema/biomarkers/tables/daily_logs.sql
```

Rules:
- Each file contains the **current full definition** of the entity (CREATE TABLE ... with all columns, indexes, RLS policies, and triggers).
- These files are the source of truth for what a table looks like — not the migration history.
- When a migration adds columns or indexes to an existing table, update the corresponding canonical file at the same time.
- New tables: create both the migration file and the canonical file together.
- The canonical files are read-only for production — changes go through migrations, then the canonical file is updated to reflect the result.

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
